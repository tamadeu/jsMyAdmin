import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Database, Table, Search, Settings, Play, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface DatabaseInfo {
  name: string;
  tables: Array<{
    name: string;
    rows: number;
    size: string;
    engine: string;
    collation: string;
  }>;
  totalTables: number;
}

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([]);

  const isActive = (path: string) => location.pathname === path;

  // Load databases on component mount
  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const databaseNames = await apiService.getDatabases();
      
      // Load table information for each database
      const databasesWithTables = await Promise.all(
        databaseNames.map(async (dbName) => {
          try {
            const tables = await apiService.getTables(dbName);
            return {
              name: dbName,
              tables: tables,
              totalTables: tables.length
            };
          } catch (error) {
            console.error(`Error loading tables for ${dbName}:`, error);
            return {
              name: dbName,
              tables: [],
              totalTables: 0
            };
          }
        })
      );

      setDatabases(databasesWithTables);
      
      // Auto-expand first database if any
      if (databasesWithTables.length > 0) {
        setExpandedDatabases([databasesWithTables[0].name]);
      }
      
    } catch (error) {
      console.error('Error loading databases:', error);
      setError(error instanceof Error ? error.message : 'Failed to load databases');
      toast({
        title: "Error loading databases",
        description: "Please check your database connection in Configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatabaseToggle = async (databaseName: string) => {
    if (!expandedDatabases.includes(databaseName)) {
      // Load tables for this database if not already loaded
      const database = databases.find(db => db.name === databaseName);
      if (database && database.tables.length === 0) {
        try {
          const tables = await apiService.getTables(databaseName);
          setDatabases(prev => prev.map(db => 
            db.name === databaseName 
              ? { ...db, tables, totalTables: tables.length }
              : db
          ));
        } catch (error) {
          console.error(`Error loading tables for ${databaseName}:`, error);
          toast({
            title: "Error loading tables",
            description: `Failed to load tables for ${databaseName}`,
            variant: "destructive"
          });
        }
      }
    }
  };

  const filteredDatabases = databases.filter(db => 
    db.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">Databases</div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadDatabases}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <Loader2 className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading databases...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <p className="text-sm text-red-500 mb-2">Failed to load databases</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadDatabases}
                  className="text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Databases */}
          {!isLoading && !error && (
            <Accordion 
              type="multiple" 
              className="w-full" 
              value={expandedDatabases}
              onValueChange={setExpandedDatabases}
            >
              {filteredDatabases.map((db) => (
                <AccordionItem key={db.name} value={db.name} className="border-none">
                  <AccordionTrigger 
                    className="hover:no-underline py-2 px-2 rounded-md hover:bg-accent"
                    onClick={() => handleDatabaseToggle(db.name)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Database className="h-4 w-4" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{db.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {db.totalTables} {db.totalTables === 1 ? 'table' : 'tables'}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="ml-6 space-y-1">
                      <div className="text-xs text-muted-foreground mb-2">Tables</div>
                      {db.tables.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2">
                          No tables found
                        </div>
                      ) : (
                        db.tables.map((table) => (
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
                              <span className="text-xs text-muted-foreground">
                                {table.rows.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* No databases found */}
          {!isLoading && !error && filteredDatabases.length === 0 && databases.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No databases match your search</p>
            </div>
          )}
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