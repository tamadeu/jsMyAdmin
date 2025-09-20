"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TabsDisplay from "../TabsDisplay";
import { useTabs } from "@/context/TabContext";
import { useIsMobile } from "@/hooks/use-mobile"; // Import the useIsMobile hook
import { MobileSidebar } from "./MobileSidebar"; // Import the new MobileSidebar

const Layout = () => {
  const { activeTabId, getTabById } = useTabs();
  const activeTab = getTabById(activeTabId);
  const isMobile = useIsMobile(); // Determine if on mobile

  let headerTitle = "jsMyAdmin";
  let headerSubtitle: string | undefined = undefined;
  let databaseParam: string | undefined = undefined;
  let tableParam: string | undefined = undefined;

  if (activeTab) {
    switch (activeTab.type) {
      case 'dashboard':
        headerTitle = 'Database Dashboard';
        headerSubtitle = 'Overview of your MySQL databases and recent activity';
        break;
      case 'sql-editor':
        headerTitle = 'SQL Editor';
        headerSubtitle = 'Write and execute SQL queries';
        break;
      case 'config':
        headerTitle = 'Database Configuration';
        headerSubtitle = 'Configure your MySQL database connection settings';
        break;
      case 'table':
        headerTitle = `Table: ${activeTab.params?.table}`;
        headerSubtitle = `Databases / ${activeTab.params?.database} / ${activeTab.params?.table}`;
        databaseParam = activeTab.params?.database;
        tableParam = activeTab.params?.table;
        break;
      case 'query-result':
        headerTitle = activeTab.title;
        headerSubtitle = 'Results from your SQL query';
        break;
      default:
        headerTitle = activeTab.title;
        break;
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {isMobile ? null : <Sidebar />} {/* Render Sidebar only on non-mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title={headerTitle} 
          subtitle={headerSubtitle}
          database={databaseParam}
          table={tableParam}
        />
        <div className="flex-1 overflow-y-auto">
          <TabsDisplay />
        </div>
      </div>
    </div>
  );
};

export default Layout;