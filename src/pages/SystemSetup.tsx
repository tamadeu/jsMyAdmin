"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const SYSTEM_DATABASE = "javascriptmyadmin_meta";
const SYSTEM_TABLES = ["_jsma_query_history", "_jsma_favorite_queries", "_jsma_favorite_tables"];

const SystemSetup = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'initializing' | 'initialized'>('loading');
  const [existingTables, setExistingTables] = useState<string[]>([]);

  useEffect(() => {
    checkSystemTables();
  }, []);

  const checkSystemTables = async () => {
    setStatus('loading');
    try {
      // Check if the system database exists
      const databases = await apiService.getDatabases();
      if (!databases.includes(SYSTEM_DATABASE)) {
        setExistingTables([]);
        setStatus('ready');
        return;
      }

      // If it exists, check for tables
      const { tables } = await apiService.getTables(SYSTEM_DATABASE);
      const foundTables = tables.map(t => t.name).filter(name => SYSTEM_TABLES.includes(name));
      setExistingTables(foundTables);

      if (foundTables.length === SYSTEM_TABLES.length) {
        setStatus('initialized');
      } else {
        setStatus('ready');
      }
    } catch (error) {
      console.error("Error checking system tables:", error);
      setStatus('error');
    }
  };

  const initializeSystem = async () => {
    setStatus('initializing');
    try {
      // 1. Create database
      await apiService.executeQuery(`CREATE DATABASE IF NOT EXISTS ${SYSTEM_DATABASE};`);

      // 2. Create tables
      const queries = [
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_query_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          query_text TEXT NOT NULL,
          database_context VARCHAR(255),
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INT,
          status ENUM('success', 'error') NOT NULL,
          error_message TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_favorite_queries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          query_text TEXT NOT NULL,
          database_context VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_favorite_tables (
          id INT AUTO_INCREMENT PRIMARY KEY,
          database_name VARCHAR(255) NOT NULL,
          table_name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_favorite (database_name, table_name)
        );`
      ];

      for (const query of queries) {
        const result = await apiService.executeQuery(query);
        if (!result.success) {
          throw new Error(result.error || 'Failed to execute a setup query.');
        }
      }

      toast({
        title: "System Initialized",
        description: "System tables have been created successfully.",
      });
      setStatus('initialized');
      await checkSystemTables(); // Re-check to update the UI
    } catch (error) {
      console.error("Error initializing system:", error);
      toast({
        title: "Initialization Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
      setStatus('error');
    }
  };

  const renderStatus = () => {
    if (status === 'loading') {
      return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking status...</div>;
    }
    if (status === 'error') {
      return <div className="flex items-center gap-2 text-red-500"><AlertCircle className="h-4 w-4" /> Error checking status.</div>;
    }
    if (status === 'initialized') {
      return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" /> System is initialized.</div>;
    }
    return <div className="flex items-center gap-2 text-yellow-500"><AlertCircle className="h-4 w-4" /> System tables need to be created.</div>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Setup</h1>
        <p className="text-muted-foreground">
          Create necessary tables for system features like query history and favorites.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Tables Status</CardTitle>
          <CardDescription>
            These tables will be created in a new database called <strong>{SYSTEM_DATABASE}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md">{renderStatus()}</div>

          <ul className="space-y-2">
            {SYSTEM_TABLES.map(table => (
              <li key={table} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                <div className="flex items-center gap-3">
                  {existingTables.includes(table) ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-mono text-sm">{table}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {existingTables.includes(table) ? "Exists" : "Missing"}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-4">
            <Button
              onClick={initializeSystem}
              disabled={status === 'loading' || status === 'initializing' || status === 'initialized'}
            >
              {status === 'initializing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {status === 'initializing' ? 'Initializing...' : 'Initialize System Tables'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSetup;