"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Define the structure of a single tab
export interface AppTab {
  id: string;
  title: string;
  type: 'dashboard' | 'sql-editor' | 'table' | 'config';
  params?: { database?: string; table?: string; };
  closable: boolean;
}

// Define the shape of the context value
interface TabContextType {
  tabs: AppTab[];
  activeTabId: string;
  addTab: (tab: Omit<AppTab, 'id'>) => void;
  removeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void; // Corrected here
  getTabById: (tabId: string) => AppTab | undefined;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabProviderProps {
  children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Initialize with a Dashboard tab if no tabs exist
  React.useEffect(() => {
    if (tabs.length === 0) {
      const dashboardTab: AppTab = {
        id: uuidv4(),
        title: 'Dashboard',
        type: 'dashboard',
        closable: false,
      };
      setTabs([dashboardTab]);
      setActiveTabId(dashboardTab.id);
    }
  }, [tabs.length]);

  const addTab = useCallback((newTab: Omit<AppTab, 'id'>) => {
    setTabs(prevTabs => {
      // Check if a tab of the same type and params already exists
      const existingTab = prevTabs.find(tab => 
        tab.type === newTab.type && 
        JSON.stringify(tab.params) === JSON.stringify(newTab.params)
      );

      if (existingTab) {
        setActiveTabId(existingTab.id);
        return prevTabs;
      } else {
        const id = uuidv4();
        const tabToAdd = { ...newTab, id };
        setActiveTabId(id);
        return [...prevTabs, tabToAdd];
      }
    });
  }, []);

  const removeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      // If the removed tab was active, activate another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Activate the tab to the left, or the first one if it was the first
          const newActiveIndex = Math.max(0, tabIndex - 1);
          setActiveTabId(newTabs[newActiveIndex].id);
        } else {
          // No tabs left, add a default dashboard tab
          const dashboardTab: AppTab = {
            id: uuidv4(),
            title: 'Dashboard',
            type: 'dashboard',
            closable: false,
          };
          setTabs([dashboardTab]);
          setActiveTabId(dashboardTab.id);
          return [dashboardTab]; // Return the new dashboard tab immediately
        }
      }
      return newTabs;
    });
  }, [activeTabId]);

  const getTabById = useCallback((tabId: string) => {
    return tabs.find(tab => tab.id === tabId);
  }, [tabs]);

  const value = React.useMemo(() => ({
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTabId, // Corrected here
    getTabById,
  }), [tabs, activeTabId, addTab, removeTab, setActiveTabId, getTabById]); // Corrected here

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