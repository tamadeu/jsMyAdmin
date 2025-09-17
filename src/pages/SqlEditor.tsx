"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Save, RotateCcw, AlertCircle, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiService, QueryResult } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { format } from "sql-formatter";

const SqlEditor = () => {
  const { toast } = useToast();
  const { addTab, activeTabId, getTabById, updateTabContent } = useTabs();
  
  const activeTab = getTabById(activeTabId);

  // Initialize with a default query. The useEffect below will handle loading the actual tab content.
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM your_table;"); 
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; time: string; timestamp: string }>>([]);

  // Effect to load content into the editor when the active tab changes
  useEffect(() => {
    if (activeTab?.type === 'sql-editor') {
      const tabContent = activeTab.sqlQueryContent || "SELECT * FROM your_table;";
      // Only update local state if it's different from the tab's content
      // This prevents unnecessary updates and potential loops
      if (sqlQuery !== tabContent) {
        setSqlQuery(tabContent);
      }
    } else {
      // If no SQL editor tab is active, or tab type changes, reset to default
      setSqlQuery("SELECT * FROM your_table;");
    }
  }, [activeTabId, activeTab?.type, activeTab?.sqlQueryContent]); // Depend only on activeTabId, type, and content

  // Effect to save content from the editor's local state to the tab context
  useEffect(() => {
    if (activeTabId && activeTab?.type === 'sql-editor') {
      // Only update the tab context if the local sqlQuery is different from the tab's content
      // This is the crucial check to prevent the loop
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
    // TODO: Implement query saving
    toast({
      title: "Feature not implemented",
      description: "Saving queries is not yet available.",
      variant: "default"
    });
  };

  const formatQuery = useCallback(() => {
    try {
      const formatted = format(sqlQuery, {
        language: 'mysql', // Assuming MySQL, adjust if needed
        indent: '  ', // 2 spaces for indentation
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
      e.preventDefault(); // Prevent new line in textarea
      executeQuery();
    }
  }, [executeQuery]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-6 space-y-4">
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
        <div className="h-48">
          <Textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-full font-mono text-sm resize-none"
            placeholder="SELECT * FROM your_table;"
          />
        </div>

        {/* Placeholder for results - results will now open in a new tab */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader>
            <CardTitle>Query Results</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-6">
            <div className="text-center text-muted-foreground py-8">
              Execute a SELECT query to see results in a new tab.
              For other queries, a toast notification will appear.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80 border-l border-border overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="h-4 w-4" />
              <h3 className="font-semibold">Query History</h3>
            </div>
            <div className="space-y-2">
              {queryHistory.map((query, index) => (
                <div 
                  key={index} 
                  className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80"
                  onClick={() => setSqlQuery(query.query)}
                >
                  <div className="text-sm font-mono truncate">{query.query}</div>
                  <div className="text-xs text-muted-foreground mt-1">{query.time}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlEditor;