"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTabs, AppTab } from "@/context/TabContext";
import Dashboard from "@/pages/Dashboard";
import SqlEditor from "@/pages/SqlEditor";
import Configuration from "@/pages/Configuration";
import DatabaseBrowser from "@/pages/DatabaseBrowser";

const TabsDisplay = () => {
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabs();

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
        return <div className="p-4 text-red-500">Error: Missing database or table parameters.</div>;
      default:
        return <div className="p-4 text-muted-foreground">Unknown tab type.</div>;
    }
  };

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
                  e.stopPropagation(); // Prevent activating the tab when closing
                  removeTab(tab.id);
                }}
                asChild // Render as a child element, not a button itself
              >
                <span className="flex items-center justify-center"> {/* Use a span as the child */}
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