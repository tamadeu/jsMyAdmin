import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TabsDisplay from "../TabsDisplay"; // Import TabsDisplay
import { useTabs } from "@/context/TabContext"; // Import useTabs

const Layout = () => {
  const { activeTabId, getTabById } = useTabs();
  const activeTab = getTabById(activeTabId);

  // Determine header title and subtitle based on the active tab
  let headerTitle = "phpMyAdmin";
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
      default:
        headerTitle = activeTab.title;
        break;
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title={headerTitle} 
          subtitle={headerSubtitle}
          database={databaseParam}
          table={tableParam}
        />
        <div className="flex-1 overflow-hidden"> {/* Ensure this div takes full height and hides overflow */}
          <TabsDisplay />
        </div>
      </div>
    </div>
  );
};

export default Layout;