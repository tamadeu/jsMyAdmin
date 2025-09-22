"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidvv4 } from 'uuid';
import { QueryResult } from "@/services/api";
import { useAuth } from './AuthContext'; // Importando o hook de autenticação

export interface AppTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users' | 'database-tables-list';
  params?: { database?: string; table?: string; };
  closable: boolean;
  queryResult?: QueryResult;
  sqlQueryContent?: string;
  originalQuery?: string;
}

interface PersistedTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users' | 'database-tables-list';
  params?: { database?: string; table?: string; };
  closable: boolean;
  sqlQueryContent?: string;
  originalQuery?: string;
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
  const { user } = useAuth(); // Obtendo o usuário autenticado
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, _setActiveTabId] = useState<string>('');
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const setActiveTab = useCallback((id: string) => {
    _setActiveTabId(id);
    activeTabIdRef.current = id;
  }, []);

  const getTabsKey = useCallback(() => {
    if (!user) return null;
    return `phpmyadmin-tabs-${user.username}@${user.host}`;
  }, [user]);

  const getActiveTabKey = useCallback(() => {
    if (!user) return null;
    return `phpmyadmin-active-tab-${user.username}@${user.host}`;
  }, [user]);

  const saveTabsToLocalStorage = useCallback((currentTabs: AppTab[]) => {
    const tabsKey = getTabsKey();
    if (!tabsKey) return;

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
    localStorage.setItem(tabsKey, JSON.stringify(persistedTabs));
  }, [getTabsKey]);

  useEffect(() => {
    const tabsKey = getTabsKey();
    const activeTabKey = getActiveTabKey();

    if (!tabsKey || !activeTabKey) {
      setTabs([]);
      setActiveTab('');
      return;
    }

    try {
      const savedTabsJson = localStorage.getItem(tabsKey);
      const savedActiveTabId = localStorage.getItem(activeTabKey);

      if (savedTabsJson) {
        const loadedTabs: PersistedTab[] = JSON.parse(savedTabsJson);
        const hydratedTabs: AppTab[] = loadedTabs.map(pTab => ({ ...pTab }));
        setTabs(hydratedTabs);

        if (savedActiveTabId && hydratedTabs.some(tab => tab.id === savedActiveTabId)) {
          setActiveTab(savedActiveTabId);
        } else if (hydratedTabs.length > 0) {
          setActiveTab(hydratedTabs[0].id);
        } else {
          const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
          setTabs([dashboardTab]);
          setActiveTab(dashboardTab.id);
        }
      } else {
        const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
        setTabs([dashboardTab]);
        setActiveTab(dashboardTab.id);
      }
    } catch (error) {
      console.error("Failed to load tabs from localStorage:", error);
      const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
      setTabs([dashboardTab]);
      setActiveTab(dashboardTab.id);
    }
  }, [getTabsKey, getActiveTabKey, setActiveTab]);

  useEffect(() => {
    const activeTabKey = getActiveTabKey();
    if (activeTabId && activeTabKey) {
      localStorage.setItem(activeTabKey, activeTabId);
    }
  }, [activeTabId, getActiveTabKey]);

  const addTab = useCallback((newTab: Omit<AppTab, 'id'>) => {
    setTabs(prevTabs => {
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

      const id = uuidvv4();
      const tabToAdd: AppTab = { ...newTab, id };

      if (tabToAdd.type === 'query-result' && tabToAdd.queryResult?.originalQuery) {
        tabToAdd.originalQuery = tabToAdd.queryResult.originalQuery;
      }

      const updatedTabs = [...prevTabs, tabToAdd];
      saveTabsToLocalStorage(updatedTabs);
      setActiveTab(id);
      return updatedTabs;
    });
  }, [saveTabsToLocalStorage, setActiveTab]);

  const removeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      if (activeTabIdRef.current === tabId) {
        if (newTabs.length > 0) {
          const newActiveIndex = Math.max(0, tabIndex - 1);
          setActiveTab(newTabs[newActiveIndex].id);
        } else {
          const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
          const updatedTabs = [dashboardTab];
          saveTabsToLocalStorage(updatedTabs);
          setActiveTab(dashboardTab.id);
          return updatedTabs;
        }
      }
      saveTabsToLocalStorage(newTabs);
      return newTabs;
    });
  }, [saveTabsToLocalStorage, setActiveTab]);

  const updateTabContent = useCallback((tabId: string, content: { sqlQueryContent?: string }) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, ...content } : tab
      );
      saveTabsToLocalStorage(updatedTabs);
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