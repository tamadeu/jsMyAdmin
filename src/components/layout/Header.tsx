import { Wifi, Bell, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTabs } from "@/context/TabContext"; // Import useTabs

interface HeaderProps {
  // Remove direct props, will get from activeTab
}

const Header = () => {
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
      case 'query-result': // New case for query results
        headerTitle = activeTab.title; // Use the tab's title (e.g., "Query Result (HH:MM:SS)")
        headerSubtitle = 'Results from your SQL query';
        break;
      default:
        headerTitle = activeTab.title;
        break;
    }
  }

  return (
    <header className="border-b border-border px-6 py-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {databaseParam && tableParam ? (
            <>
              <h1 className="text-xl font-semibold">Table: {tableParam}</h1>
              <div className="text-sm text-muted-foreground">
                Databases / {databaseParam} / {tableParam}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{headerTitle}</h1>
              {headerSubtitle && (
                <div className="text-sm text-muted-foreground">
                  {headerSubtitle}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <Badge variant="outline" className="text-green-500 border-green-500">Connected</Badge>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 bg-accent px-3 py-1 rounded-md">
            <User className="h-4 w-4" />
            <span className="text-sm">AD</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;