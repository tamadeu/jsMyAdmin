"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Save, RotateCcw, AlertCircle, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { apiService, QueryResult } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { format } from "sql-formatter";

const SqlEditor = () => {
  const { toast } = useToast();
  const { addTab, activeTabId, getTabById, updateTabContent } = useTabs();
  
  const activeTab = getTabById(activeTabId);

  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM your_table;"); 
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; time: string; timestamp: string }>>([]);

  useEffect(() => {
    if (activeTab?.type === 'sql-editor') {
      const tabContent = activeTab.sqlQueryContent || "SELECT * FROM your_table;";
      if (sqlQuery !== tabContent) {
        setSqlQuery(tabContent);
      }
    } else {
      setSqlQuery("SELECT * FROM your_table;");
    }
  }, [activeTabId, activeTab?.type, activeTab?.sqlQueryContent]);

  useEffect(() => {
    if (activeTabId && activeTab?.type === 'sql-editor') {
      if (sqlQuery !== (activeTab.sqlQueryContent || "SELECT * FROM your_table;")) {
        updateTabContent(activeTabId, { sqlQueryContent: sqlQuery });
      }
    }
  }, [sqlQuery, activeTabId, activeTab?.type, activeTab?.sqlQueryContent, updateTabContent]);

  const executeQuery = useCallback(async () => {
    setIsExecuting(true);
    try {
      const result = await apiService.executeQuery(sqlQuery);

      setQueryHistory(prev => [
        { query: sqlQuery, time: result.executionTime, timestamp: new Date().toLocaleString() },
        ...prev.slice(0, 4)
      ]);

      if (result.success) {
        const isSelect = sqlQuery.trim().toLowerCase().startsWith('select');
        if (isSelect && result.data) {
          addTab({
            title: `Query Result (${new Date().toLocaleTimeString()})`,
            type: 'query-result',
            queryResult: { ...result, originalQuery: sqlQuery },
            closable: true,
          });
        } else {
          toast({
            title: "Query executed",
            description: result.message || "SQL query executed successfully.",
          });
        }
      } else {
        toast({
          title: "Query failed",
          description: result.error || "An error occurred during query execution.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "Failed to execute SQL query",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  }, [sqlQuery, addTab, toast]);

  const saveQuery = () => {
    toast({
      title: "Feature not implemented",
      description: "Saving queries is not yet available.",
      variant: "default"
    });
  };

  const formatQuery = useCallback(() => {
    try {
      const formatted = format(sqlQuery, {
        language: 'mysql',
        indent: '  ',
        linesBetweenQueries: 2,
      });
      setSqlQuery(formatted);
      toast({
        title: "Query formatted",
        description: "SQL query has been formatted.",
      });
    } catch (error) {
      console.error('Error formatting query:', error);
      toast({
        title: "Formatting failed",
        description: error instanceof Error ? error.message : "Failed to format SQL query",
        variant: "destructive"
      });
    }
  }, [sqlQuery, toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  }, [executeQuery]);

  return (
    <div className="flex flex-col h-full p-6 space-y-6"> {/* Changed to flex-col and added p-6 space-y-6 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SQL Editor</h1>
          <p className="text-muted-foreground">Write and execute SQL queries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={formatQuery}>
            <AlignLeft className="h-4 w-4 mr-2" />
            Format SQL
          </Button>
          <Button variant="outline" size="sm" onClick={saveQuery}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" onClick={executeQuery} disabled={isExecuting}>
            <Play className="h-4 w-4 mr-2" />
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
        </div>
      </div>

      {/* Query Editor Area */}
      <div className="flex-1 min-h-[150px]"> {/* Use min-h to ensure it's not too small */}
        <Textarea
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full font-mono text-sm resize-none"
          placeholder="SELECT * FROM your_table;"
        />
      </div>

      {/* Query History Card (Moved here) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            <CardTitle>Query History</CardTitle>
          </div>
          <CardDescription>Recently executed SQL queries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queryHistory.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No recent queries.</div>
          ) : (
            queryHistory.map((query, index) => (
              <div 
                key={index} 
                className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80"
                onClick={() => setSqlQuery(query.query)}
              >
                <div className="text-sm font-mono truncate">{query.query}</div>
                <div className="text-xs text-muted-foreground mt-1">{query.time} • {query.timestamp}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card (Moved here) */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common SQL commands</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2"> {/* Responsive grid */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SHOW TABLES;")}
          >
            Show Tables
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SHOW DATABASES;")}
          >
            Show Databases
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SELECT * FROM users LIMIT 10;")}
          >
            Browse Users
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SELECT * FROM products LIMIT 10;")}
          >
            Browse Products
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SqlEditor;