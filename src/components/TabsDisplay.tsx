"use client";

import React, { useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTabs, AppTab } from "@/context/TabContext";
import Dashboard from "@/pages/Dashboard";
import SqlEditor from "@/pages/SqlEditor";
import Configuration from "@/pages/Configuration";
import DatabaseBrowser from "@/pages/DatabaseBrowser";
import QueryResultTable from "@/components/QueryResultTable";
import UsersPage from "@/pages/Users";
import DatabaseTablesList from "@/components/DatabaseTablesList";
import TableStructure from "@/pages/TableStructure";
import { useTranslation } from "react-i18next"; // Import useTranslation

const TabsDisplay = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { tabs, activeTabId, setActiveTab, removeTab, getTabById } = useTabs();

  const renderTabContent = (tab: AppTab) => {
    switch (tab.type) {
      case 'dashboard':
        return <Dashboard />;
      case 'sql-editor':
        return <SqlEditor />;
      case 'config':
        return <Configuration />;
      case 'table':
        if (tab.params?.database && tab.params?.table) {
          return <DatabaseBrowser database={tab.params.database} table={tab.params.table} />;
        }
        return <div className="p-4 text-red-500">{t("tabsDisplay.errorMissingDbOrTable")}</div>;
      case 'query-result':
        return <QueryResultTable queryResult={tab.queryResult || { success: false, originalQuery: tab.originalQuery, executionTime: 0 }} database={tab.params?.database} />;
      case 'users':
        return <UsersPage />;
      case 'database-tables-list':
        if (tab.params?.database) {
          return <DatabaseTablesList database={tab.params.database} filterType={tab.filterType} />;
        }
        return <div className="p-4 text-red-500">{t("tabsDisplay.errorMissingDbForTablesList")}</div>;
      case 'table-structure':
        if (tab.params?.database && tab.params?.table) {
          return <TableStructure database={tab.params.database} table={tab.params.table} />;
        }
        return <div className="p-4 text-red-500">{t("tabsDisplay.errorMissingDbOrTableForStructure")}</div>;
      default:
        return <div className="p-4 text-muted-foreground">{t("tabsDisplay.unknownTabType")}</div>;
    }
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.shiftKey) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      if (currentIndex === -1) return;

      if (event.key === 'X' || event.key === 'x') {
        event.preventDefault();
        const activeTab = getTabById(activeTabId);
        if (activeTab && activeTab.closable) {
          removeTab(activeTabId);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIndex > 0) {
          setActiveTab(tabs[currentIndex - 1].id);
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex < tabs.length - 1) {
          setActiveTab(tabs[currentIndex + 1].id);
        }
      }
    }
  }, [tabs, activeTabId, setActiveTab, removeTab, getTabById]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <Tabs value={activeTabId} onValueChange={setActiveTab} className="flex flex-col flex-1">
      <TabsList className="h-10 bg-card border-b border-border rounded-none justify-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger 
            key={tab.id} 
            value={tab.id} 
            className="relative h-full data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm font-medium"
          >
            {tab.title}
            {tab.closable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 ml-2 -mr-1"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                asChild
              >
                <span className="flex items-center justify-center">
                  <X className="h-3 w-3" />
                </span>
              </Button>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="h-full mt-0 overflow-y-auto">
            {renderTabContent(tab)}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};

export default TabsDisplay;