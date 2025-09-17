"use client";

import { useState } from "react";
import { Play, Save, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiService, QueryResult } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const SqlEditor = () => {
  const { toast } = useToast();
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM your_table;"); // Simplified initial query
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; time: string; timestamp: string }>>([]);

  const executeQuery = async () => {
    setIsExecuting(true);
    setQueryResults(null); // Clear previous results
    try {
      const result = await apiService.executeQuery(sqlQuery);
      setQueryResults(result);

      // Add to history
      setQueryHistory(prev => [
        { query: sqlQuery, time: result.executionTime, timestamp: new Date().toLocaleString() },
        ...prev.slice(0, 4) // Keep last 5 queries
      ]);

      if (result.success) {
        toast({
          title: "Query executed",
          description: result.message || "SQL query executed successfully.",
        });
      } else {
        toast({
          title: "Query failed",
          description: result.error || "An error occurred during query execution.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      setQueryResults({ success: false, error: error instanceof Error ? error.message : "Unknown error", executionTime: "N/A" });
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "Failed to execute SQL query",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const saveQuery = () => {
    // TODO: Implement query saving
    toast({
      title: "Feature not implemented",
      description: "Saving queries is not yet available.",
      variant: "default"
    });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SQL Editor</h1>
            <p className="text-muted-foreground">Write and execute SQL queries</p>
          </div>
          <div className="flex gap-2">
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
        <div className="h-48"> {/* Fixed height for query editor */}
          <Textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            className="h-full font-mono text-sm resize-none" // Make textarea fill its parent
            placeholder="SELECT * FROM your_table;"
          />
        </div>

        {/* Query Results Card */}
        <Card className="flex-1 flex flex-col min-h-0"> {/* Make card take remaining space, min-h-0 to allow shrinking */}
          <CardHeader>
            <CardTitle>Query Results</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0"> {/* Removed overflow-y-auto and padding from CardContent */}
            <div className="flex-1 overflow-y-auto p-6"> {/* New div for scrollable content with padding */}
              {queryResults ? (
                queryResults.success ? (
                  <div className="space-y-2">
                    <div className="text-sm text-green-600">
                      Query executed successfully in {queryResults.executionTime}
                    </div>
                    {queryResults.data && queryResults.data.length > 0 && (
                      <>
                        <div className="text-sm text-muted-foreground">
                          {queryResults.rowCount} rows returned
                        </div>
                        <div className="border rounded-lg mt-4"> {/* Removed overflow-hidden here */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted">
                                <tr>
                                  {queryResults.fields?.map((field) => (
                                    <th key={field.name} className="p-2 text-left font-medium text-sm">
                                      {field.name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {queryResults.data.map((row, rowIndex) => (
                                  <tr key={rowIndex} className="border-t hover:bg-muted/50">
                                    {queryResults.fields?.map((field) => (
                                      <td key={field.name} className="p-2 max-w-xs truncate" title={String(row[field.name])}>
                                        {String(row[field.name])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                    {queryResults.affectedRows !== undefined && (
                      <div className="text-sm text-muted-foreground">
                        {queryResults.affectedRows} rows affected.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-red-500">
                    <AlertCircle className="h-5 w-5 inline-block mr-2" />
                    <span className="font-medium">Error:</span> {queryResults.error}
                  </div>
                )
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Execute a query to see results
                </div>
              )}
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