import { useState } from "react";
import { Database, Table, Play, Settings, Server, Users, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  const [activeTab, setActiveTab] = useState("query");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [selectedTable, setSelectedTable] = useState("");

  const [databases] = useState([
    { 
      name: "ecommerce_db", 
      tables: [
        { name: "users", rows: 1243, size: "256 KB" },
        { name: "products", rows: 567, size: "512 KB" },
        { name: "orders", rows: 8921, size: "1.2 MB" },
        { name: "categories", rows: 15, size: "16 KB" },
        { name: "reviews", rows: 2341, size: "445 KB" }
      ],
      totalSize: "2.4 GB" 
    },
    { 
      name: "blog_db", 
      tables: [
        { name: "posts", rows: 234, size: "128 KB" },
        { name: "comments", rows: 1567, size: "234 KB" },
        { name: "authors", rows: 12, size: "8 KB" },
        { name: "tags", rows: 45, size: "12 KB" }
      ],
      totalSize: "1.1 GB" 
    },
    { 
      name: "analytics_db", 
      tables: [
        { name: "page_views", rows: 45678, size: "3.2 MB" },
        { name: "user_sessions", rows: 12345, size: "1.8 MB" },
        { name: "events", rows: 78901, size: "4.5 MB" },
        { name: "conversions", rows: 234, size: "45 KB" }
      ],
      totalSize: "5.7 GB" 
    }
  ]);

  const handleTableSelect = (dbName: string, tableName: string) => {
    setSelectedDatabase(dbName);
    setSelectedTable(tableName);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-sidebar border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Database Manager</h2>
          <p className="text-sm text-sidebar-muted-foreground">Connected to MySQL</p>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4">
            <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Databases</h3>
            
            <Accordion type="multiple" className="w-full">
              {databases.map((db) => (
                <AccordionItem key={db.name} value={db.name} className="border-none">
                  <AccordionTrigger className="hover:no-underline py-2 px-2 rounded-md hover:bg-sidebar-accent">
                    <div className="flex items-center gap-2 flex-1">
                      <Database className="h-4 w-4 text-sidebar-primary" />
                      <div className="flex-1 text-left">
                        <div className="text-sm text-sidebar-foreground font-medium">{db.name}</div>
                        <div className="text-xs text-sidebar-muted-foreground">
                          {db.tables.length} tables • {db.totalSize}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="ml-6 space-y-1">
                      {db.tables.map((table) => (
                        <div 
                          key={table.name} 
                          className={`p-2 rounded-md cursor-pointer transition-colors ${
                            selectedDatabase === db.name && selectedTable === table.name
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'hover:bg-sidebar-accent'
                          }`}
                          onClick={() => handleTableSelect(db.name, table.name)}
                        >
                          <div className="flex items-center gap-2">
                            <Table className="h-3 w-3" />
                            <span className="text-sm">{table.name}</span>
                          </div>
                          <div className="text-xs opacity-70 ml-5">
                            {table.rows.toLocaleString()} rows • {table.size}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
              {selectedDatabase && selectedTable && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <span>{selectedDatabase}</span>
                  <span>/</span>
                  <span className="font-medium">{selectedTable}</span>
                </div>
              )}
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
                    {selectedTable ? `Viewing data from ${selectedDatabase}.${selectedTable}` : "Select a table from the sidebar to browse data"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    {selectedTable ? (
                      <div>
                        <div className="bg-muted px-4 py-2 border-b">
                          <span className="text-sm font-medium">{selectedDatabase}.{selectedTable}</span>
                        </div>
                        <div className="p-4 text-center text-muted-foreground">
                          Table data would be displayed here
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        Select a table from the sidebar to browse data
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="structure">
              <Card>
                <CardHeader>
                  <CardTitle>Table Structure</CardTitle>
                  <CardDescription>
                    {selectedTable ? `Structure of ${selectedDatabase}.${selectedTable}` : "Select a table to view its structure"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    {selectedTable ? `Structure for ${selectedTable} would be displayed here` : "Select a table to view its structure"}
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