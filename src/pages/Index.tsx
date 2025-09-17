import { useState } from "react";
import { Database, Table, Play, Settings, Server, Users, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  const [activeTab, setActiveTab] = useState("query");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [databases] = useState([
    { name: "ecommerce_db", tables: 12, size: "2.4 GB" },
    { name: "blog_db", tables: 8, size: "1.1 GB" },
    { name: "analytics_db", tables: 15, size: "5.7 GB" }
  ]);

  const [tables] = useState([
    { name: "users", rows: 1243, size: "256 KB" },
    { name: "products", rows: 567, size: "512 KB" },
    { name: "orders", rows: 8921, size: "1.2 MB" },
    { name: "categories", rows: 15, size: "16 KB" }
  ]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Database Manager</h2>
          <p className="text-sm text-sidebar-muted-foreground">Connected to MySQL</p>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Databases</h3>
              {databases.map((db) => (
                <div key={db.name} className="mb-2 p-2 rounded-md hover:bg-sidebar-accent cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-sidebar-primary" />
                    <span className="text-sm text-sidebar-foreground">{db.name}</span>
                  </div>
                  <div className="text-xs text-sidebar-muted-foreground ml-6">
                    {db.tables} tables • {db.size}
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div>
              <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Tables</h3>
              {tables.map((table) => (
                <div key={table.name} className="mb-2 p-2 rounded-md hover:bg-sidebar-accent cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 text-sidebar-primary" />
                    <span className="text-sm text-sidebar-foreground">{table.name}</span>
                  </div>
                  <div className="text-xs text-sidebar-muted-foreground ml-6">
                    {table.rows} rows • {table.size}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-sm text-sidebar-muted-foreground">
            <Server className="h-4 w-4" />
            <span>localhost:3306</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Database Management</h1>
              <Badge variant="secondary" className="ml-2">
                MySQL 8.0
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Users
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="query">SQL Query</TabsTrigger>
              <TabsTrigger value="browse">Browse Data</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="query" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>SQL Query Editor</CardTitle>
                  <CardDescription>
                    Write and execute SQL queries against your database
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                      placeholder="SELECT * FROM your_table;"
                    />
                    <div className="flex gap-2">
                      <Button>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Query
                      </Button>
                      <Button variant="outline">Explain</Button>
                      <Button variant="outline">Format</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Query Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md p-4 text-center text-muted-foreground">
                    No results yet. Execute a query to see results.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="browse">
              <Card>
                <CardHeader>
                  <CardTitle>Browse Data</CardTitle>
                  <CardDescription>
                    View and manage your database tables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 border-b">
                      <span className="text-sm font-medium">users table</span>
                    </div>
                    <div className="p-4 text-center text-muted-foreground">
                      Select a table from the sidebar to browse data
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="structure">
              <Card>
                <CardHeader>
                  <CardTitle>Table Structure</CardTitle>
                  <CardDescription>
                    View and modify table structures
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    Select a table to view its structure
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export">
              <Card>
                <CardHeader>
                  <CardTitle>Export Data</CardTitle>
                  <CardDescription>
                    Export your database or tables in various formats
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Quick Export</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full">
                          Export as SQL
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Custom Export</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full">
                          Configure Export
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;