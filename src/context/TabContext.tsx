"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidvv4 } from 'uuid';
import { QueryResult } from "@/services/api";
import { useAuth } from './AuthContext';
import { getTabPath } from '@/utils/tabUtils'; // Import the new utility

export interface AppTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users' | 'database-tables-list' | 'table-structure';
  params?: { database?: string; table?: string; };
  closable: boolean;
  queryResult?: QueryResult;
  sqlQueryContent?: string;
  originalQuery?: string;
  filterType?: 'all' | 'tables' | 'views';
}

interface PersistedTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config' | 'query-result' | 'users' | 'database-tables-list' | 'table-structure';
  params?: { database?: string; table?: string; };
  closable: boolean;
  sqlQueryContent?: string;
  originalQuery?: string;
  filterType?: 'all' | 'tables' | 'views';
}

interface TabContextType {
  tabs: AppTab[];
  activeTabId: string;
  addTab: (tab: Omit<AppTab, 'id'>) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getTabById: (tabId: string) => AppTab | undefined;
  updateTabContent: (tabId: string, content: { sqlQueryContent?: string }) => void;
  clearUserTabs: () => void; // Add function to clear tabs on logout
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabProviderProps {
  children: ReactNode;
  navigate: (path: string) => void; // Add navigate prop
}

export function TabProvider({ children, navigate }: TabProviderProps) {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, _setActiveTabId] = useState<string>('');
  const activeTabIdRef = useRef(activeTabId);
  const [currentUserKey, setCurrentUserKey] = useState<string>(''); // Track current user

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const getTabsKey = useCallback(() => {
    if (!user) return null;
    return `jsmyadmin-tabs-${user.username}@${user.host}`;
  }, [user]);

  const getActiveTabKey = useCallback(() => {
    if (!user) return null;
    return `jsmyadmin-active-tab-${user.username}@${user.host}`;
  }, [user]);

  const setActiveTab = useCallback((id: string) => {
    _setActiveTabId(id);
    activeTabIdRef.current = id;
    
    // Save active tab to localStorage
    const activeTabKey = getActiveTabKey();
    if (activeTabKey) {
      localStorage.setItem(activeTabKey, id);
    }
    
    const newActiveTab = tabs.find(tab => tab.id === id);
    if (newActiveTab) {
      navigate(getTabPath(newActiveTab));
    }
  }, [tabs, navigate, getActiveTabKey]);

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
      if (tab.type === 'database-tables-list' && tab.filterType) {
        pTab.filterType = tab.filterType;
      }
      return pTab;
    });
    localStorage.setItem(tabsKey, JSON.stringify(persistedTabs));
  }, [getTabsKey]);

  useEffect(() => {
    const tabsKey = getTabsKey();
    const activeTabKey = getActiveTabKey();

    if (!tabsKey || !activeTabKey) {
      // User not logged in - clear tabs
      console.log('TabContext: No user logged in, clearing tabs');
      setTabs([]);
      _setActiveTabId('');
      return;
    }

    console.log(`TabContext: Loading tabs for user with key: ${tabsKey}`);

    try {
      const savedTabsJson = localStorage.getItem(tabsKey);
      const savedActiveTabId = localStorage.getItem(activeTabKey);

      console.log(`TabContext: Found saved tabs:`, savedTabsJson ? 'Yes' : 'No');
      console.log(`TabContext: Found saved active tab:`, savedActiveTabId);

      if (savedTabsJson) {
        const loadedTabs: PersistedTab[] = JSON.parse(savedTabsJson);
        const hydratedTabs: AppTab[] = loadedTabs.map(pTab => ({ ...pTab }));
        setTabs(hydratedTabs);

        if (savedActiveTabId && hydratedTabs.some(tab => tab.id === savedActiveTabId)) {
          console.log(`TabContext: Setting active tab to saved: ${savedActiveTabId}`);
          _setActiveTabId(savedActiveTabId);
        } else if (hydratedTabs.length > 0) {
          console.log(`TabContext: Setting active tab to first: ${hydratedTabs[0].id}`);
          _setActiveTabId(hydratedTabs[0].id);
        } else {
          console.log('TabContext: No saved tabs, creating dashboard');
          const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
          const updatedTabs = [dashboardTab];
          setTabs(updatedTabs);
          saveTabsToLocalStorage(updatedTabs);
          _setActiveTabId(dashboardTab.id);
        }
      } else {
        console.log('TabContext: No saved tabs found, creating dashboard');
        const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
        const updatedTabs = [dashboardTab];
        setTabs(updatedTabs);
        saveTabsToLocalStorage(updatedTabs);
        _setActiveTabId(dashboardTab.id);
      }
    } catch (error) {
      console.error("Failed to load tabs from localStorage:", error);
      const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
      const updatedTabs = [dashboardTab];
      setTabs(updatedTabs);
      saveTabsToLocalStorage(updatedTabs);
      _setActiveTabId(dashboardTab.id);
    }
  }, [user?.username, user?.host, getTabsKey, getActiveTabKey, saveTabsToLocalStorage]); // Removed setActiveTab from deps to prevent infinite loop

  useEffect(() => {
    const activeTabKey = getActiveTabKey();
    if (activeTabId && activeTabKey) {
      localStorage.setItem(activeTabKey, activeTabId);
    }
  }, [activeTabId, getActiveTabKey]);

  const addTab = useCallback((newTab: Omit<AppTab, 'id'>) => {
    setTabs(prevTabs => {
      if (newTab.type !== 'query-result') {
        const existingTab = prevTabs.find(tab => {
          // Compare type
          if (tab.type !== newTab.type) return false;
          
          // Compare params (handle undefined/empty object cases)
          const tabParams = tab.params || {};
          const newTabParams = newTab.params || {};
          const paramsMatch = JSON.stringify(tabParams) === JSON.stringify(newTabParams);
          
          // Compare filterType (handle undefined cases)
          const filterTypeMatch = (tab.filterType || undefined) === (newTab.filterType || undefined);
          
          return paramsMatch && filterTypeMatch;
        });
        
        if (existingTab) {
          console.log(`TabContext: Found existing tab of type ${newTab.type}, activating:`, existingTab.id);
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
      _setActiveTabId(id); // Directly set active tab ID
      navigate(getTabPath(tabToAdd)); // Navigate to the new tab's path
      return updatedTabs;
    });
  }, [saveTabsToLocalStorage, navigate]);

  const removeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      if (activeTabIdRef.current === tabId) {
        if (newTabs.length > 0) {
          const newActiveIndex = Math.max(0, tabIndex - 1);
          const newActiveTab = newTabs[newActiveIndex];
          _setActiveTabId(newActiveTab.id); // Directly set active tab ID
          navigate(getTabPath(newActiveTab)); // Navigate to the new active tab's path
        } else {
          const dashboardTab: AppTab = { id: uuidvv4(), title: 'Dashboard', type: 'dashboard', closable: false };
          const updatedTabs = [dashboardTab];
          saveTabsToLocalStorage(updatedTabs);
          _setActiveTabId(dashboardTab.id); // Directly set active tab ID
          navigate(getTabPath(dashboardTab)); // Navigate to dashboard
          return updatedTabs;
        }
      }
      saveTabsToLocalStorage(newTabs);
      return newTabs;
    });
  }, [saveTabsToLocalStorage, navigate]);

  const updateTabContent = useCallback((tabId: string, content: { sqlQueryContent?: string }) => {
    setTabs(prevTabs => {
      const targetTabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (targetTabIndex === -1) return prevTabs;

      const targetTab = prevTabs[targetTabIndex];
      if (content.sqlQueryContent === targetTab.sqlQueryContent) {
        return prevTabs;
      }

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

  const clearUserTabs = useCallback(() => {
    console.log('TabContext: Clearing all tabs for user logout');
    setTabs([]);
    _setActiveTabId('');
    
    // Clear localStorage entries for current user
    const tabsKey = getTabsKey();
    const activeTabKey = getActiveTabKey();
    if (tabsKey) localStorage.removeItem(tabsKey);
    if (activeTabKey) localStorage.removeItem(activeTabKey);
  }, [getTabsKey, getActiveTabKey]);

  // Register the clearUserTabs callback with AuthContext
  useEffect(() => {
    const newUserKey = user ? `${user.username}@${user.host}` : '';
    
    // If user changed (including from null to user or user to null)
    if (currentUserKey && currentUserKey !== newUserKey) {
      console.log(`TabContext: User changed from ${currentUserKey} to ${newUserKey}, clearing tabs`);
      clearUserTabs();
    }
    
    setCurrentUserKey(newUserKey);
  }, [user?.username, user?.host, currentUserKey, clearUserTabs]);

  const value = React.useMemo(() => ({
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    getTabById,
    updateTabContent,
    clearUserTabs,
  }), [tabs, activeTabId, addTab, removeTab, setActiveTab, getTabById, updateTabContent, clearUserTabs]);

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