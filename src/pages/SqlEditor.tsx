"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Save, RotateCcw, AlertCircle, AlignLeft, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiService, QueryResult, QueryHistoryPayload } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { format } from "sql-formatter";

const SqlEditor = () => {
  const { toast } = useToast();
  const { addTab, activeTabId, getTabById, updateTabContent } = useTabs();
  
  const activeTab = getTabById(activeTabId);

  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM your_table;"); 
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryPayload[]>([]); // Now stores fetched history
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchQueryHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const historyData = await apiService.getQueryHistory();
      setQueryHistory(historyData);
    } catch (error) {
      console.error('Error fetching query history:', error);
      setHistoryError(error instanceof Error ? error.message : "Failed to load query history.");
      toast({
        title: "Error loading query history",
        description: error instanceof Error ? error.message : "Failed to load query history.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab?.type === 'sql-editor') {
      const tabContent = activeTab.sqlQueryContent || "SELECT * FROM your_table;";
      if (sqlQuery !== tabContent) {
        setSqlQuery(tabContent);
      }
      fetchQueryHistory(); // Fetch history when SQL Editor tab becomes active
    } else {
      setSqlQuery("SELECT * FROM your_table;");
    }
  }, [activeTabId, activeTab?.type, activeTab?.sqlQueryContent, fetchQueryHistory]);

  useEffect(() => {
    if (activeTabId && activeTab?.type === 'sql-editor') {
      if (sqlQuery !== (activeTab.sqlQueryContent || "SELECT * FROM your_table;")) {
        updateTabContent(activeTabId, { sqlQueryContent: sqlQuery });
      }
    }
  }, [sqlQuery, activeTabId, activeTab?.type, activeTab?.sqlQueryContent, updateTabContent]);

  const executeQuery = useCallback(async () => {
    setIsExecuting(true);
    let result: QueryResult | null = null;
    try {
      result = await apiService.executeQuery(sqlQuery);

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
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Client-side error",
        executionTime: 0,
        originalQuery: sqlQuery
      };
    } finally {
      setIsExecuting(false);
      if (result) {
        apiService.saveQueryToHistory({
          query_text: sqlQuery,
          execution_time_ms: result.executionTime,
          status: result.success ? 'success' : 'error',
          error_message: result.error,
        }).then(() => {
          fetchQueryHistory(); // Refresh history after saving a new query
        }).catch(err => {
          console.warn("Could not save query to history:", err);
        });
      }
    }
  }, [sqlQuery, addTab, toast, fetchQueryHistory]);

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
    <div className="flex flex-col h-full p-6 space-y-6">
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
      <div className="flex-1 min-h-[150px]">
        <Textarea
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full font-mono text-sm resize-none"
          placeholder="SELECT * FROM your_table;"
        />
      </div>

      {/* Query History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>My Query History</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchQueryHistory} 
              disabled={isLoadingHistory}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>Recently executed SQL queries by you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading history...</p>
            </div>
          ) : historyError ? (
            <div className="flex items-center justify-center py-4 text-red-500">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">{historyError}</p>
            </div>
          ) : queryHistory.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No recent queries.</div>
          ) : (
            queryHistory.map((query, index) => (
              <div 
                key={query.id || index} // Use id if available, fallback to index
                className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80"
                onClick={() => setSqlQuery(query.query_text)}
              >
                <div className="text-sm font-mono truncate">{query.query_text}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {query.execution_time_ms}ms • {new Date(query.executed_at!).toLocaleString()}
                  {query.database_context && ` • DB: ${query.database_context}`}
                  {query.status === 'error' && <span className="text-red-500 ml-2"> (Error)</span>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common SQL commands</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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