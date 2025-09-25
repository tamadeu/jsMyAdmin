"use client";

import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TabsDisplay from "../TabsDisplay";
import { useTabs } from "@/context/TabContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSidebar } from "./MobileSidebar";
import { useTranslation } from "react-i18next"; // Import useTranslation

const Layout = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { addTab, tabs, setActiveTab, activeTabId } = useTabs();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const lastProcessedSearch = useRef<string>('');

  // Memoize the function to find existing tabs to prevent unnecessary re-renders
  const findExistingTabForParams = useCallback((page: string | null, db: string | null, table: string | null, view: string | null, filter: string | null) => {
    // Page-based tabs
    if (page === 'sql') {
      return tabs.find(tab => tab.type === 'sql-editor');
    }
    if (page === 'config') {
      return tabs.find(tab => tab.type === 'config');
    }
    if (page === 'users') {
      return tabs.find(tab => tab.type === 'users');
    }

    // Database-specific tabs
    if (db && !table) {
      const filterType = filter === 'tables' ? 'tables' : filter === 'views' ? 'views' : 'all';
      return tabs.find(tab => 
        tab.type === 'database-tables-list' && 
        tab.params?.database === db &&
        tab.filterType === filterType
      );
    }

    // Table-specific tabs
    if (db && table) {
      if (view === 'structure') {
        return tabs.find(tab => 
          tab.type === 'table-structure' && 
          tab.params?.database === db && 
          tab.params?.table === table
        );
      } else {
        return tabs.find(tab => 
          tab.type === 'table' && 
          tab.params?.database === db && 
          tab.params?.table === table
        );
      }
    }

    return null;
  }, [tabs]);

  useEffect(() => {
    // Only process if the search params actually changed
    if (lastProcessedSearch.current === location.search) {
      return;
    }

    // Parse query parameters from URL
    const searchParams = new URLSearchParams(location.search);
    const page = searchParams.get('page');
    const db = searchParams.get('db');
    const table = searchParams.get('table');
    const view = searchParams.get('view');
    const filter = searchParams.get('filter');

    // Early return if no meaningful URL params
    if (!page && !db && !table && !view) {
      lastProcessedSearch.current = location.search;
      return;
    }

    // Only process URL params if there are no tabs or if tabs are loaded but no active tab
    if (tabs.length === 0) {
      return;
    }

    lastProcessedSearch.current = location.search;

    // Function to find existing tab for current URL params
    const existingTab = findExistingTabForParams(page, db, table, view, filter);
    
    if (existingTab) {
      // Only activate if it's not already the active tab (prevent loop)
      if (activeTabId !== existingTab.id) {
        setActiveTab(existingTab.id);
      }
    } else if (page || db || table) {
      
      if (page === 'sql') {
        addTab({ title: t("sidebar.sqlEditor"), type: "sql-editor", closable: true });
      } else if (page === 'config') {
        addTab({ title: t("sidebar.configuration"), type: "config", closable: true });
      } else if (page === 'users') {
        addTab({ title: t("sidebar.users"), type: "users", closable: true });
      } else if (db && !table) {
        const filterType = filter === 'tables' ? 'tables' : filter === 'views' ? 'views' : 'all';
        let title;
        if (filterType === 'tables') {
          title = t("databaseTablesList.tablesTitle", { databaseName: db });
        } else if (filterType === 'views') {
          title = t("databaseTablesList.viewsTitle", { databaseName: db });
        } else {
          title = t("databaseTablesList.tablesAndViewsTitle", { databaseName: db });
        }
        addTab({ 
          title, 
          type: "database-tables-list", 
          params: { database: db }, 
          filterType: filterType as 'all' | 'tables' | 'views', 
          closable: true 
        });
      } else if (db && table) {
        if (view === 'structure') {
          addTab({ 
            title: t("tableStructurePage.title", { tableName: table }), 
            type: "table-structure", 
            params: { database: db, table }, 
            closable: true 
          });
        } else {
          addTab({ 
            title: table, 
            type: "table", 
            params: { database: db, table }, 
            closable: true 
          });
        }
      }
    }
  }, [location.search, tabs.length, activeTabId, findExistingTabForParams, addTab, setActiveTab, t]); // Use memoized function

  return (
    <div className="flex h-screen bg-background text-foreground">
      {isMobile ? null : <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <TabsDisplay />
        </div>
      </div>
    </div>
  );
};

export default Layout;