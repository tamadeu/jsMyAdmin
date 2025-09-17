import { useState } from "react";
import { Database, Table, Play, Settings, Server, Users, Search, ChevronDown, ChevronRight, Save, RotateCcw, Download, Plus, Edit, Trash2, Filter, Wifi, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";

const Index = () => {
  const [activeView, setActiveView] = useState("query");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users WHERE status = \"active\" LIMIT 10;");
  const [selectedDatabase, setSelectedDatabase] = useState("ecommerce_prod");
  const [selectedTable, setSelectedTable] = useState("");

  const databases = [
    { 
      name: "ecommerce_prod", 
      tables: [
        { name: "users", rows: 45231, size: "12.4 MB" },
        { name: "products", rows: 8934, size: "5.2 MB" },
        { name: "orders", rows: 23450, size: "18.7 MB" },
        { name: "order_items", rows: 67890, size: "25.1 MB" },
        { name: "categories", rows: 156, size: "0.8 MB" }
      ],
      totalTables: 15,
      totalSize: "2.4 GB"
    },
    { 
      name: "user_analytics", 
      tables: [
        { name: "sessions", rows: 234567, size: "45.2 MB" },
        { name: "events", rows: 567890, size: "89.3 MB" }
      ],
      totalTables: 8,
      totalSize: "856 MB"
    },
    { 
      name: "content_management", 
      tables: [
        { name: "posts", rows: 1234, size: "3.4 MB" },
        { name: "comments", rows: 5678, size: "2.1 MB" }
      ],
      totalTables: 12,
      totalSize: "1.2 GB"
    },
    { 
      name: "logs_archive", 
      tables: [
        { name: "access_logs", rows: 987654, size: "156.7 MB" }
      ],
      totalTables: 4,
      totalSize: "5.8 GB"
    }
  ];

  const queryHistory = [
    { query: "SELECT * FROM users WHERE status = \"active\" ORDER BY created_at...", time: "0.045s", timestamp: "2024-01-15 14:30:22" },
    { query: "UPDATE products SET stock = stock - 1 WHERE id = 123", time: "0.012s", timestamp: "2024-01-15 14:25:15" },
    { query: "SELECT COUNT(*) as total_orders FROM orders WHERE DATE(created_...", time: "0.089s", timestamp: "2024-01-15 14:20:08" }
  ];

  const sampleUsers = [
    { id: 1, username: "john_doe", email: "john@example.com", created_at: "2024-01-10 10:30:00", status: "active" },
    { id: 2, username: "jane_smith", email: "jane@example.com", created_at: "2024-01-11 14:20:00", status: "active" },
    { id: 3, username: "bob_wilson", email: "bob@example.com", created_at: "2024-01-12 09:15:00", status: "inactive" },
    { id: 4, username: "alice_brown", email: "alice@example.com", created_at: "2024-01-13 16:45:00", status: "active" },
    { id: 5, username: "charlie_davis", email: "charlie@example.com", created_at: "2024-01-14 11:30:00", status: "pending" }
  ];

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            <h2 className="text-lg font-semibold">phpMyAdmin</h2>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search databases..." 
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4">
            {/* Navigation */}
            <div className="space-y-2 mb-6">
              <Button 
                variant={activeView === "dashboard" ? "secondary" : "ghost"} 
                className="w-full justify-start"
                onClick={() => setActiveView("dashboard")}
              >
                <Database className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button 
                variant={activeView === "query" ? "secondary" : "ghost"} 
                className="w-full justify-start"
                onClick={() => setActiveView("query")}
              >
                <Search className="h-4 w-4 mr-2" />
                SQL Query
              </Button>
            </div>

            <div className="text-sm text-muted-foreground mb-3">Databases</div>
            
            {/* Databases */}
            <Accordion type="multiple" className="w-full" defaultValue={["ecommerce_prod"]}>
              {databases.map((db) => (
                <AccordionItem key={db.name} value={db.name} className="border-none">
                  <AccordionTrigger className="hover:no-underline py-2 px-2 rounded-md hover:bg-accent">
                    <div className="flex items-center gap-2 flex-1">
                      <Database className="h-4 w-4" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{db.name}</div>
                        <div className="text-xs text-muted-foreground">{db.totalTables}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="ml-6 space-y-1">
                      <div className="text-xs text-muted-foreground mb-2">Overview</div>
                      {db.tables.map((table) => (
                        <div 
                          key={table.name} 
                          className={`p-2 rounded-md cursor-pointer transition-colors hover:bg-accent ${
                            selectedTable === table.name ? 'bg-accent' : ''
                          }`}
                          onClick={() => {
                            setSelectedTable(table.name);
                            setActiveView("browse");
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Table className="h-3 w-3" />
                              <span className="text-sm">{table.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{table.rows.toLocaleString()}</span>
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

        {/* Footer with Theme Toggle */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>v5.2.1</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="border-b border-border px-6 py-4 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">
                {activeView === "dashboard" && "Database Dashboard"}
                {activeView === "query" && "SQL Query Editor"}
                {activeView === "browse" && `Table: ${selectedTable}`}
              </h1>
              {activeView === "browse" && (
                <div className="text-sm text-muted-foreground">
                  Databases / {selectedDatabase} / {selectedTable}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                <Badge variant="outline" className="text-green-500 border-green-500">Connected</Badge>
              </div>
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 bg-accent px-3 py-1 rounded-md">
                <User className="h-4 w-4" />
                <span className="text-sm">AD</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeView === "dashboard" && (
            <div className="p-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Total Databases</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">4</div>
                    <p className="text-xs text-muted-foreground">+2 from last month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
                      <Table className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">39</div>
                    <p className="text-xs text-muted-foreground">+12 from last month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">10.2 GB</div>
                    <Progress value={68} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-1">68% of 15 GB limit</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">3</div>
                    <p className="text-xs text-muted-foreground">2 admin, 1 read-only</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Databases */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      <CardTitle>Databases</CardTitle>
                    </div>
                    <CardDescription>Manage your database instances</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {databases.map((db) => (
                      <div key={db.name} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">{db.name}</div>
                            <div className="text-sm text-muted-foreground">{db.totalTables} tables • {db.totalSize}</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">utf8mb4_unicode_ci</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        <CardTitle>Recent Query Activity</CardTitle>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setActiveView("query")}>
                        Open SQL Editor
                      </Button>
                    </div>
                    <CardDescription>Latest SQL operations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {queryHistory.map((query, index) => (
                      <div key={index} className="p-3 bg-accent rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <div className="text-sm font-mono">{query.query}</div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{query.timestamp}</span>
                              <span>{query.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeView === "query" && (
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">SQL Editor</h2>
                      <p className="text-sm text-muted-foreground">Write and execute SQL queries</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Execute
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
                      <div className="text-center text-muted-foreground py-8">
                        Execute a query to see results
                      </div>
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
                        <div key={index} className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                          <div className="text-sm font-mono truncate">{query.query}</div>
                          <div className="text-xs text-muted-foreground mt-1">{query.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">Show Tables</Button>
                      <Button variant="outline" className="w-full justify-start">Show Databases</Button>
                      <Button variant="outline" className="w-full justify-start">Browse Users</Button>
                      <Button variant="outline" className="w-full justify-start">Browse Products</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "browse" && selectedTable && (
            <div className="p-6 space-y-6">
              {/* Table Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Engine</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">InnoDB</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Rows</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">45,231</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">12.4 MB</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Collation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">utf8mb4_unicode_ci</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">2024-01-15 14:30:22</div>
                  </CardContent>
                </Card>
              </div>

              {/* Browse Data */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Browse Data</CardTitle>
                      <CardDescription>5 rows</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Insert Row
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search in table..." 
                          className="pl-10"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                      <Select defaultValue="10">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 rows</SelectItem>
                          <SelectItem value="25">25 rows</SelectItem>
                          <SelectItem value="50">50 rows</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left">
                              <Checkbox />
                            </th>
                            <th className="p-3 text-left">id</th>
                            <th className="p-3 text-left">username</th>
                            <th className="p-3 text-left">email</th>
                            <th className="p-3 text-left">created_at</th>
                            <th className="p-3 text-left">status</th>
                            <th className="p-3 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sampleUsers.map((user) => (
                            <tr key={user.id} className="border-t hover:bg-muted/50">
                              <td className="p-3">
                                <Checkbox />
                              </td>
                              <td className="p-3">{user.id}</td>
                              <td className="p-3">{user.username}</td>
                              <td className="p-3">{user.email}</td>
                              <td className="p-3">{user.created_at}</td>
                              <td className="p-3">
                                <Badge 
                                  variant={user.status === "active" ? "default" : user.status === "inactive" ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {user.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Showing 1 to 5 of 5 entries</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>Previous</Button>
                        <Button variant="outline" size="sm">1</Button>
                        <Button variant="outline" size="sm" disabled>Next</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;