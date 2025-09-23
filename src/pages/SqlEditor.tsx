"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Save, RotateCcw, AlertCircle, AlignLeft, History, Loader2, RefreshCw, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiService, QueryResult, QueryHistoryPayload } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { format } from "sql-formatter";
import SqlCodeEditor from "@/components/SqlCodeEditor";
import { useTranslation } from "react-i18next"; // Import useTranslation

const SqlEditor = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { addTab, activeTabId, getTabById, updateTabContent, removeTab } = useTabs();
  
  const activeTab = getTabById(activeTabId);

  // Initialize sqlQuery from activeTab.sqlQueryContent or default
  const [sqlQuery, setSqlQuery] = useState(() => activeTab?.sqlQueryContent || "SELECT * FROM your_table;"); 
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryPayload[]>([]);
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
      setHistoryError(error instanceof Error ? error.message : t("sqlEditor.failedToLoadHistory"));
      toast({
        title: t("sqlEditor.errorLoadingHistory"),
        description: error instanceof Error ? error.message : t("sqlEditor.failedToLoadHistory"),
        variant: "destructive"
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [toast, t]);

  // Effect to synchronize local sqlQuery state with activeTab.sqlQueryContent when activeTab changes
  useEffect(() => {
    if (activeTab?.type === 'sql-editor') {
      const tabContentFromContext = activeTab.sqlQueryContent;
      const defaultQuery = "SELECT * FROM your_table;";
      
      // If context has content, use it. Otherwise, use default.
      const newSqlQueryValue = tabContentFromContext !== undefined ? tabContentFromContext : defaultQuery;

      // Only update local state if it's different from the new source of truth
      if (sqlQuery !== newSqlQueryValue) {
        setSqlQuery(newSqlQueryValue);
      }
      fetchQueryHistory();
    } else {
      // If not an SQL editor tab, reset local state to default if it's not already
      if (sqlQuery !== "SELECT * FROM your_table;") {
        setSqlQuery("SELECT * FROM your_table;");
      }
    }
  }, [activeTabId, activeTab?.type, activeTab?.sqlQueryContent, fetchQueryHistory]);

  // Effect to push local sqlQuery state to context when it changes (e.g., user typing)
  useEffect(() => {
    if (activeTabId && activeTab?.type === 'sql-editor') {
      const tabContentFromContext = activeTab.sqlQueryContent;
      // Only update context if local state is different from context state
      if (sqlQuery !== tabContentFromContext) {
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
            title: t("header.queryResultTitle", { time: new Date().toLocaleTimeString() }),
            type: 'query-result',
            queryResult: { ...result, originalQuery: sqlQuery },
            closable: true,
          });
          // Close the current SQL Editor tab if it's closable
          if (activeTab?.type === 'sql-editor' && activeTab.closable) {
            removeTab(activeTabId);
          }
        } else {
          toast({
            title: t("sqlEditor.queryExecuted"),
            description: result.message || t("sqlEditor.queryExecutedSuccessfully"),
          });
        }
      } else {
        toast({
          title: t("sqlEditor.queryFailed"),
          description: result.error || t("sqlEditor.queryExecutionError"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      toast({
        title: t("sqlEditor.queryFailed"),
        description: error instanceof Error ? error.message : t("sqlEditor.failedToExecuteSqlQuery"),
        variant: "destructive"
      });
      result = {
        success: false,
        error: error instanceof Error ? error.message : t("sqlEditor.clientSideError"),
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
  }, [sqlQuery, addTab, toast, fetchQueryHistory, activeTab, activeTabId, removeTab, t]);

  const saveQuery = () => {
    toast({
      title: t("sqlEditor.featureNotImplemented"),
      description: t("sqlEditor.savingQueriesNotAvailable"),
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
        title: t("sqlEditor.queryFormatted"),
        description: t("sqlEditor.sqlQueryFormatted"),
      });
    } catch (error) {
      console.error('Error formatting query:', error);
      toast({
        title: t("sqlEditor.formattingFailed"),
        description: error instanceof Error ? error.message : t("sqlEditor.failedToFormatQuery"),
        variant: "destructive"
      });
    }
  }, [sqlQuery, toast, t]);

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
          <h1 className="text-2xl font-bold">{t("sqlEditor.title")}</h1>
          <p className="text-muted-foreground">{t("sqlEditor.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={formatQuery}>
            <AlignLeft className="h-4 w-4 mr-2" />
            {t("sqlEditor.formatSql")}
          </Button>
          <Button variant="outline" size="sm" onClick={saveQuery}>
            <Save className="h-4 w-4 mr-2" />
            {t("sqlEditor.save")}
          </Button>
          <Button size="sm" onClick={executeQuery} disabled={isExecuting}>
            <Play className="h-4 w-4 mr-2" />
            {isExecuting ? t("sqlEditor.executing") : t("sqlEditor.execute")}
          </Button>
        </div>
      </div>

      {/* Query Editor Area */}
      <div className="flex-1">
        <SqlCodeEditor
          value={sqlQuery}
          onValueChange={setSqlQuery}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM your_table;"
        />
      </div>

      {/* Query History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>{t("sqlEditor.myQueryHistory")}</CardTitle>
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
          <CardDescription>{t("sqlEditor.myQueryHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("sqlEditor.loadingHistory")}</p>
            </div>
          ) : historyError ? (
            <div className="flex items-center justify-center py-4 text-red-500">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">{historyError}</p>
            </div>
          ) : queryHistory.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">{t("sqlEditor.noRecentQueries")}</div>
          ) : (
            queryHistory.map((query, index) => (
              <div 
                key={query.id || index}
                className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80"
                onClick={() => setSqlQuery(query.query_text)}
              >
                <div className="text-sm font-mono truncate">{query.query_text}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {query.execution_time_ms}ms • {new Date(query.executed_at!).toLocaleString()}
                  {query.database_context && ` • DB: ${query.database_context}`}
                  {query.status === 'error' && <span className="text-red-500 ml-2"> ({t("sqlEditor.error")})</span>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sqlEditor.quickActions")}</CardTitle>
          <CardDescription>{t("sqlEditor.commonSqlCommands")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SHOW TABLES;")}
          >
            {t("sqlEditor.showTables")}
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SHOW DATABASES;")}
          >
            {t("sqlEditor.showDatabases")}
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SELECT * FROM users LIMIT 10;")}
          >
            {t("sqlEditor.browseUsers")}
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setSqlQuery("SELECT * FROM products LIMIT 10;")}
          >
            {t("sqlEditor.browseProducts")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SqlEditor;