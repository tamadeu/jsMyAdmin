"use client";

import { useEffect } from "react";
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
  const { addTab } = useTabs();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);

    if (path === '/') {
      addTab({ title: t("sidebar.dashboard"), type: "dashboard", closable: false });
    } else if (path === '/sql') {
      addTab({ title: t("sidebar.sqlEditor"), type: "sql-editor", closable: true });
    } else if (path === '/configuration') {
      addTab({ title: t("sidebar.configuration"), type: "config", closable: true });
    } else if (path === '/users') {
      addTab({ title: t("sidebar.users"), type: "users", closable: true });
    } else if (segments.length === 1) {
      const database = segments[0];
      addTab({ title: t("databaseTablesList.tablesAndViewsTitle", { databaseName: database }), type: "database-tables-list", params: { database }, filterType: 'all', closable: true });
    } else if (segments.length === 2 && segments[1] === 'tables') {
      const database = segments[0];
      addTab({ title: t("databaseTablesList.tablesTitle", { databaseName: database }), type: "database-tables-list", params: { database }, filterType: 'tables', closable: true });
    } else if (segments.length === 2 && segments[1] === 'views') {
      const database = segments[0];
      addTab({ title: t("databaseTablesList.viewsTitle", { databaseName: database }), type: "database-tables-list", params: { database }, filterType: 'views', closable: true });
    } else if (segments.length === 2 && segments[1] !== 'tables' && segments[1] !== 'views') {
      const [database, table] = segments;
      addTab({ title: table, type: "table", params: { database, table }, closable: true });
    } else if (segments.length === 3 && segments[2] === 'structure') {
      const [database, table] = segments;
      addTab({ title: t("tableStructurePage.title", { tableName: table }), type: "table-structure", params: { database, table }, closable: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [location.pathname, addTab, navigate, t]);

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