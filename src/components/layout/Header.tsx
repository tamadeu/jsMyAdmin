"use client";

import { Wifi, Bell, User, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTabs } from "@/context/TabContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSidebar } from "./MobileSidebar";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { activeTabId, getTabById } = useTabs();
  const { logout } = useAuth();
  const activeTab = getTabById(activeTabId);
  const isMobile = useIsMobile();

  let headerTitle = "jsMyAdmin";
  let headerSubtitle: string | undefined = undefined;

  if (activeTab) {
    switch (activeTab.type) {
      case "dashboard":
        headerTitle = "Database Dashboard";
        headerSubtitle = "Overview of your MySQL databases and recent activity";
        break;
      case "sql-editor":
        headerTitle = "SQL Editor";
        headerSubtitle = "Write and execute SQL queries";
        break;
      case "config":
        headerTitle = "Database Configuration";
        headerSubtitle = "Configure your MySQL database connection settings";
        break;
      case "table":
        headerTitle = `Table: ${activeTab.params?.table}`;
        headerSubtitle = `Databases / ${activeTab.params?.database} / ${activeTab.params?.table}`;
        break;
      case "query-result":
        headerTitle = activeTab.title;
        headerSubtitle = "Results from your SQL query";
        break;
      case "users":
        headerTitle = "User Accounts";
        headerSubtitle = "Manage MySQL user accounts and privileges";
        break;
      case "database-tables-list":
        headerTitle = activeTab.title; // e.g., "Tables: mydb"
        headerSubtitle = `Databases / ${activeTab.params?.database}`;
        break;
      case "table-structure":
        headerTitle = `Structure: ${activeTab.params?.table}`;
        headerSubtitle = `Databases / ${activeTab.params?.database} / ${activeTab.params?.table} Structure`;
        break;
      default:
        headerTitle = activeTab.title;
        break;
    }
  }

  return (
    <header className="border-b border-border px-6 py-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isMobile && <MobileSidebar />}
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{headerTitle}</h1>
            {headerSubtitle && (
              <div className="text-sm text-muted-foreground">
                {headerSubtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <Badge variant="outline" className="text-green-500 border-green-500">
              Connected
            </Badge>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 bg-accent px-3 py-1 rounded-md cursor-pointer">
                <User className="h-4 w-4" />
                <span className="text-sm">AD</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;