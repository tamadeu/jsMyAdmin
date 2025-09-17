import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Database, Table, Search, Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

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

  const isActive = (path: string) => location.pathname === path;

  return (
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4">
          {/* Navigation */}
          <div className="space-y-2 mb-6">
            <Button 
              variant={isActive("/") ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => navigate("/")}
            >
              <Database className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button 
              variant={isActive("/sql") ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => navigate("/sql")}
            >
              <Play className="h-4 w-4 mr-2" />
              SQL Editor
            </Button>
            <Button 
              variant={isActive("/config") ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => navigate("/config")}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </Button>
          </div>

          <div className="text-sm text-muted-foreground mb-3">Databases</div>
          
          {/* Databases */}
          <Accordion type="multiple" className="w-full" defaultValue={["ecommerce_prod"]}>
            {databases
              .filter(db => db.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((db) => (
              <AccordionItem key={db.name} value={db.name} className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 px-2 rounded-md hover:bg-accent">
                  <div className="flex items-center gap-2 flex-1">
                    <Database className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{db.name}</div>
                      <div className="text-xs text-muted-foreground">{db.totalTables} tables</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="ml-6 space-y-1">
                    <div className="text-xs text-muted-foreground mb-2">Tables</div>
                    {db.tables.map((table) => (
                      <div 
                        key={table.name} 
                        className="p-2 rounded-md cursor-pointer transition-colors hover:bg-accent"
                        onClick={() => navigate(`/database/${db.name}/table/${table.name}`)}
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
  );
};

export default Sidebar;