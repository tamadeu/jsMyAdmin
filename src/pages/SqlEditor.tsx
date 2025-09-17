import { useState } from "react";
import { Play, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SqlEditor = () => {
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users WHERE status = \"active\" LIMIT 10;");
  const [queryResults, setQueryResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const queryHistory = [
    { query: "SELECT * FROM users WHERE status = \"active\" ORDER BY created_at...", time: "0.045s", timestamp: "2024-01-15 14:30:22" },
    { query: "UPDATE products SET stock = stock - 1 WHERE id = 123", time: "0.012s", timestamp: "2024-01-15 14:25:15" },
    { query: "SELECT COUNT(*) as total_orders FROM orders WHERE DATE(created_...", time: "0.089s", timestamp: "2024-01-15 14:20:08" }
  ];

  const executeQuery = async () => {
    setIsExecuting(true);
    // TODO: Implement actual query execution
    setTimeout(() => {
      setIsExecuting(false);
      setQueryResults({
        success: true,
        rowCount: 5,
        executionTime: "0.045s"
      });
    }, 1000);
  };

  const saveQuery = () => {
    // TODO: Implement query saving
    console.log("Saving query:", sqlQuery);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <div className="space-y-4 h-full flex flex-col">
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

          <div className="flex-1 flex flex-col">
            <Textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="flex-1 min-h-[300px] font-mono text-sm resize-none"
              placeholder="SELECT * FROM your_table;"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Query Results</CardTitle>
            </CardHeader>
            <CardContent>
              {queryResults ? (
                <div className="space-y-2">
                  <div className="text-sm text-green-600">
                    Query executed successfully in {queryResults.executionTime}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {queryResults.rowCount} rows returned
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Execute a query to see results
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="w-80 border-l border-border p-6">
        <div className="space-y-6">
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