"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QueryResult } from "@/services/api";

const LOCAL_STORAGE_TABS_KEY = 'phpmyadmin-open-tabs';
const LOCAL_STORAGE_ACTIVE_TAB_KEY = 'phpmyadmin-active-tab';

export interface AppTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users';
  params?: { database?: string; table?: string; };
  closable: boolean;
  // Runtime properties (not directly persisted for all types, or re-fetched)
  queryResult?: QueryResult; // Full result for 'query-result' when active
  sqlQueryContent?: string; // For 'sql-editor' to save its content
  // Persisted property for query-result tabs to re-execute
  originalQuery?: string; // The SQL query string for 'query-result' tabs
}

// How tabs are stored in localStorage (simplified for persistence)
interface PersistedTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users';
  params?: { database?: string; table?: string; };
  closable: boolean;
  sqlQueryContent?: string; // For 'sql-editor'
  originalQuery?: string; // For 'query-result'
}

interface TabContextType {
  tabs: AppTab[];
  activeTabId: string;
  addTab: (tab: Omit<AppTab, 'id'>) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getTabById: (tabId: string) => AppTab | undefined;
  updateTabContent: (tabId: string, content: { sqlQueryContent?: string }) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabProviderProps {
  children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, _setActiveTabId] = useState<string>(''); // Internal state for activeTabId
  const activeTabIdRef = useRef(activeTabId); // Ref para manter o valor mais recente de activeTabId

  // Mantém o ref em sincronia com o estado
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Setter memoizado para activeTabId, atualiza tanto o estado quanto o ref
  const setActiveTab = useCallback((id: string) => {
    _setActiveTabId(id);
    activeTabIdRef.current = id; // Atualiza o ref imediatamente
  }, []);

  // Function to save current tabs to localStorage
  const saveTabsToLocalStorage = useCallback((currentTabs: AppTab[]) => {
    const persistedTabs: PersistedTab[] = currentTabs.map(tab => {
      const pTab: PersistedTab = {
        id: tab.id,
        title: tab.title,
        type: tab.type,
        params: tab.params,
        closable: tab.closable,
      };
      if (tab.type === 'sql-editor' && tab.sqlQueryContent !== undefined) {
        pTab.sqlQueryContent = tab.sqlQueryContent;
      }
      if (tab.type === 'query-result' && tab.originalQuery) {
        pTab.originalQuery = tab.originalQuery;
      }
      return pTab;
    });
    localStorage.setItem(LOCAL_STORAGE_TABS_KEY, JSON.stringify(persistedTabs));
  }, []);

  // Load tabs from localStorage on initial mount
  React.useEffect(() => {
    try {
      const savedTabsJson = localStorage.getItem(LOCAL_STORAGE_TABS_KEY);
      const savedActiveTabId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_TAB_KEY);

      if (savedTabsJson) {
        const loadedTabs: PersistedTab[] = JSON.parse(savedTabsJson);
        const hydratedTabs: AppTab[] = loadedTabs.map(pTab => {
          const appTab: AppTab = { ...pTab };
          // For query-result tabs, we only store originalQuery, not the full result data
          // The QueryResultTable component will be responsible for re-executing the query
          if (appTab.type === 'query-result' && appTab.originalQuery) {
            // We don't set queryResult here, it will be fetched by QueryResultTable
            // But we keep originalQuery for it to use.
          }
          return appTab;
        });
        setTabs(hydratedTabs);
        if (savedActiveTabId && hydratedTabs.some(tab => tab.id === savedActiveTabId)) {
          setActiveTab(savedActiveTabId);
        } else if (hydratedTabs.length > 0) {
          setActiveTab(hydratedTabs[0].id);
        } else {
          // Fallback to default dashboard if no valid tabs or active tab
          const dashboardTab: AppTab = {
            id: uuidv4(),
            title: 'Dashboard',
            type: 'dashboard',
            closable: false,
          };
          setTabs([dashboardTab]);
          setActiveTab(dashboardTab.id);
        }
      } else {
        // No saved tabs, initialize with a default Dashboard tab
        const dashboardTab: AppTab = {
          id: uuidv4(),
          title: 'Dashboard',
          type: 'dashboard',
          closable: false,
        };
        setTabs([dashboardTab]);
        setActiveTab(dashboardTab.id);
      }
    } catch (error) {
      console.error("Failed to load tabs from localStorage:", error);
      // Fallback to default dashboard on error
      const dashboardTab: AppTab = {
        id: uuidv4(),
        title: 'Dashboard',
        type: 'dashboard',
        closable: false,
      };
      setTabs([dashboardTab]);
      setActiveTab(dashboardTab.id);
    }
  }, [saveTabsToLocalStorage, setActiveTab]); // Adicionado setActiveTab às dependências

  // Save activeTabId to localStorage whenever it changes
  React.useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_TAB_KEY, activeTabId);
    }
  }, [activeTabId]);

  const addTab = useCallback((newTab: Omit<AppTab, 'id'>) => {
    setTabs(prevTabs => {
      // Check if a tab of the same type and params already exists
      // For 'query-result' tabs, we always want a new one, so skip this check
      if (newTab.type !== 'query-result') {
        const existingTab = prevTabs.find(tab =>
          tab.type === newTab.type &&
          JSON.stringify(tab.params) === JSON.stringify(newTab.params)
        );

        if (existingTab) {
          setActiveTab(existingTab.id);
          return prevTabs;
        }
      }

      const id = uuidv4();
      const tabToAdd: AppTab = { ...newTab, id };

      // Special handling for query-result tabs: store originalQuery for persistence
      if (tabToAdd.type === 'query-result' && tabToAdd.queryResult?.originalQuery) {
        tabToAdd.originalQuery = tabToAdd.queryResult.originalQuery;
        // We keep the full queryResult for immediate display, but it won't be persisted
      }

      const updatedTabs = [...prevTabs, tabToAdd];
      saveTabsToLocalStorage(updatedTabs); // Save to localStorage
      setActiveTab(id);
      return updatedTabs;
    });
  }, [saveTabsToLocalStorage, setActiveTab]); // Adicionado setActiveTab às dependências

  const removeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      // Usa activeTabIdRef.current para obter o activeTabId mais recente
      if (activeTabIdRef.current === tabId) { // Se a aba removida era a aba ativa atual
        if (newTabs.length > 0) {
          // Ativa a aba à esquerda, ou a primeira se era a primeira
          const newActiveIndex = Math.max(0, tabIndex - 1);
          setActiveTab(newTabs[newActiveIndex].id);
        } else {
          // Nenhuma aba restante, adiciona uma aba de dashboard padrão
          const dashboardTab: AppTab = {
            id: uuidv4(),
            title: 'Dashboard',
            type: 'dashboard',
            closable: false,
          };
          const updatedTabs = [dashboardTab];
          saveTabsToLocalStorage(updatedTabs); // Salva no localStorage
          setActiveTab(dashboardTab.id);
          return updatedTabs;
        }
      }
      saveTabsToLocalStorage(newTabs); // Salva no localStorage
      return newTabs;
    });
  }, [saveTabsToLocalStorage, setActiveTab]); // Adicionado setActiveTab às dependências

  const updateTabContent = useCallback((tabId: string, content: { sqlQueryContent?: string }) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, ...content } : tab
      );
      saveTabsToLocalStorage(updatedTabs); // Save to localStorage
      return updatedTabs;
    });
  }, [saveTabsToLocalStorage]);

  const getTabById = useCallback((tabId: string) => {
    return tabs.find(tab => tab.id === tabId);
  }, [tabs]);

  const value = React.useMemo(() => ({
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    getTabById,
    updateTabContent,
  }), [tabs, activeTabId, addTab, removeTab, setActiveTab, getTabById, updateTabContent]);

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
}