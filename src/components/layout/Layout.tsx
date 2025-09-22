"use client";

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TabsDisplay from "../TabsDisplay";
import { useTabs } from "@/context/TabContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSidebar } from "./MobileSidebar";

const Layout = () => {
  const { addTab } = useTabs();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean); // Remove empty strings

    if (path === '/') {
      addTab({ title: "Dashboard", type: "dashboard", closable: false });
    } else if (path === '/sql') {
      addTab({ title: "SQL Editor", type: "sql-editor", closable: true });
    } else if (path === '/configuration') {
      addTab({ title: "Configuration", type: "config", closable: true });
    } else if (path === '/users') {
      addTab({ title: "Users", type: "users", closable: true });
    } else if (segments.length === 2 && segments[1] === 'tables') { // e.g., /mydb/tables
      const database = segments[0];
      addTab({ title: `Tables: ${database}`, type: "database-tables-list", params: { database }, filterType: 'tables', closable: true });
    } else if (segments.length === 2 && segments[1] === 'views') { // e.g., /mydb/views
      const database = segments[0];
      addTab({ title: `Views: ${database}`, type: "database-tables-list", params: { database }, filterType: 'views', closable: true });
    } else if (segments.length === 2 && segments[1] !== 'tables' && segments[1] !== 'views') { // e.g., /mydb/mytable
      const [database, table] = segments;
      addTab({ title: table, type: "table", params: { database, table }, closable: true });
    } else if (segments.length === 3 && segments[2] === 'structure') { // e.g., /mydb/mytable/structure
      const [database, table] = segments;
      addTab({ title: `Structure: ${table}`, type: "table-structure", params: { database, table }, closable: true });
    } else {
      // If an unknown path is entered, redirect to dashboard
      navigate('/', { replace: true });
    }
  }, [location.pathname, addTab, navigate]);

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