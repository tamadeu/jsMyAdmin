"use client";

import { useState } from "react";
import { User, LogOut, Keyboard, Globe } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle

const Header = () => {
  const { t } = useTranslation();
  const { activeTabId, getTabById } = useTabs();
  const { logout, user } = useAuth();
  const activeTab = getTabById(activeTabId);
  const isMobile = useIsMobile();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);

  let headerTitle = t("sidebar.title");
  let headerSubtitle: string | undefined = undefined;

  if (activeTab) {
    switch (activeTab.type) {
      case "dashboard":
        headerTitle = t("header.dashboardTitle");
        headerSubtitle = t("header.dashboardSubtitle");
        break;
      case "sql-editor":
        headerTitle = t("header.sqlEditorTitle");
        headerSubtitle = t("header.sqlEditorSubtitle");
        break;
      case "config":
        headerTitle = t("header.configTitle");
        headerSubtitle = t("header.configSubtitle");
        break;
      case "table":
        headerTitle = t("header.tableTitle", { tableName: activeTab.params?.table });
        headerSubtitle = t("header.tableSubtitle", { databaseName: activeTab.params?.database, tableName: activeTab.params?.table });
        break;
      case "query-result":
        headerTitle = t("header.queryResultTitle", { time: new Date().toLocaleTimeString() });
        headerSubtitle = t("header.queryResultSubtitle");
        break;
      case "users":
        headerTitle = t("header.usersTitle");
        headerSubtitle = t("header.usersSubtitle");
        break;
      case "database-tables-list":
        headerTitle = activeTab.title;
        headerSubtitle = t("header.databaseTablesListSubtitle", { databaseName: activeTab.params?.database });
        break;
      case "table-structure":
        headerTitle = t("header.tableStructureTitle", { tableName: activeTab.params?.table });
        headerSubtitle = t("header.tableStructureSubtitle", { databaseName: activeTab.params?.database, tableName: activeTab.params?.table });
        break;
      default:
        headerTitle = activeTab.title;
        break;
    }
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <header className="border-b border-border px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-card">
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {isMobile && <MobileSidebar />}
          <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold truncate">{headerTitle}</h1>
            {headerSubtitle && (
              <div className="text-xs sm:text-sm text-muted-foreground truncate">
                {headerSubtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
          {/* Desktop: Show all buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 px-0"
              onClick={() => setIsShortcutsDialogOpen(true)}
              title={t("header.keyboardShortcuts")}
            >
              <Keyboard className="h-4 w-4" />
              <span className="sr-only">{t("header.keyboardShortcuts")}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 px-0">
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Change language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  <span>English</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('pt-BR')}>
                  <span>Português (BR)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
          
          {/* Mobile & Tablet: Compact layout */}
          <div className="flex lg:hidden items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 px-0">
                  <Globe className="h-4 w-4" />
                  <span className="sr-only">Options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsShortcutsDialogOpen(true)}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  <span>{t("header.keyboardShortcuts")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  <Globe className="mr-2 h-4 w-4" />
                  <span>English</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('pt-BR')}>
                  <Globe className="mr-2 h-4 w-4" />
                  <span>Português (BR)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
          
          {/* User menu - always visible */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-2 bg-accent px-2 sm:px-3 py-1 rounded-md cursor-pointer">
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm hidden xs:inline">{user?.username || 'AD'}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t("header.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <KeyboardShortcutsDialog 
        open={isShortcutsDialogOpen} 
        onOpenChange={setIsShortcutsDialogOpen} 
      />
    </header>
  );
};

export default Header;