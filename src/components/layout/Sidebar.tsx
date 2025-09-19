"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Database, Table, Eye, Search, Settings, Play, Loader2, AlertCircle, Wrench, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiService, DatabaseTablesResponse } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs, AppTab } from "@/context/TabContext"; // Import useTabs and AppTab
import { useAuth } from "@/context/AuthContext";

interface DatabaseInfo {
  name: string;
  tables: DatabaseTablesResponse['tables'];
  views: DatabaseTablesResponse['views'];
  totalTables: number;
  totalViews: number;
}

// Helper function for deep comparison of string arrays
const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const Sidebar = () => {
  const location = useLocation();
  const { toast } = useToast();
  const { tabs, activeTabId, addTab, setActiveTab, getTabById } = useTabs(); // Use tab context
  const { hasPrivilege } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Determine if a sidebar item corresponds to the active tab
  const isSidebarItemActive = (type: AppTab['type'], params?: AppTab['params']) => {
    const activeTab = getTabById(activeTabId);
    if (!activeTab) return false;

    if (activeTab.type === type) {
      if (type === 'table') {
        return activeTab.params?.database === params?.database && activeTab.params?.table === params?.table;
      }
      return true; // For dashboard, sql-editor, config, just type match is enough
    }
    return false;
  };

  // Load databases on component mount
  useEffect(() => {
    loadDatabases();
  }, []);

  // Update expanded databases based on current active tab
  useEffect(() => {
    const activeTab = getTabById(activeTabId);

    if (activeTab && activeTab.type === 'table' && activeTab.params?.database) {
      let targetExpandedDatabases: string[] = [activeTab.params.database];
      let targetExpandedSections: string[] = [];

      if (activeTab.params.table) {
        // Find the database from the current `databases` state
        const db = databases.find(d => d.name === activeTab.params?.database);
        if (db) {
          const isView = db.views.some(view => view.name === activeTab.params?.table);
          targetExpandedSections = [`${activeTab.params.database}-${isView ? 'views' : 'tables'}`];
        }
      }

      // Only update state if the new value is different from the current state
      setExpandedDatabases(prev => arraysEqual(prev, targetExpandedDatabases) ? prev : targetExpandedDatabases);
      setExpandedSections(prev => arraysEqual(prev, targetExpandedSections) ? prev : targetExpandedSections);
    } 
    // If not a table tab, do not modify expandedDatabases or expandedSections.
    // This prevents forcing collapse when switching to non-table tabs, which might cause a loop.
  }, [activeTabId, databases, getTabById]); // Dependencies are activeTabId, databases, getTabById

  const loadDatabases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const databaseNames = await apiService.getDatabases();
      
      // Load table and view information for each database
      const databasesWithTablesAndViews = await Promise.all(
        databaseNames.map(async (dbName) => {
          try {
            const tablesData = await apiService.getTables(dbName);
            return {
              name: dbName,
              tables: tablesData.tables,
              views: tablesData.views,
              totalTables: tablesData.totalTables,
              totalViews: tablesData.totalViews
            };
          } catch (error) {
            console.error(`Error loading tables for ${dbName}:`, error);
            return {
              name: dbName,
              tables: [],
              views: [],
              totalTables: 0,
              totalViews: 0
            };
          }
        })
      );

      setDatabases(prev => {
        // Deep compare to avoid unnecessary state updates
        if (JSON.stringify(prev) === JSON.stringify(databasesWithTablesAndViews)) {
          return prev;
        }
        return databasesWithTablesAndViews;
      });
      
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
    // If the database is not currently expanded, try to load its tables/views
    if (!expandedDatabases.includes(databaseName)) {
      const database = databases.find(db => db.name === databaseName);
      if (database && database.tables.length === 0 && database.views.length === 0) {
        try {
          const tablesData = await apiService.getTables(databaseName);
          // Only update if new data is actually different
          setDatabases(prev => {
            const updated = prev.map(db => 
              db.name === databaseName 
                ? { 
                    ...db, 
                    tables: tablesData.tables,
                    views: tablesData.views,
                    totalTables: tablesData.totalTables,
                    totalViews: tablesData.totalViews
                  }
                : db
            );
            // Deep compare to avoid unnecessary state updates
            if (JSON.stringify(prev) === JSON.stringify(updated)) { 
                return prev;
            }
            return updated;
          });
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
    // Toggle the expanded state
    setExpandedDatabases(prev => 
      prev.includes(databaseName) 
        ? prev.filter(name => name !== databaseName) 
        : [...prev, databaseName]
    );
  };

  const filteredDatabases = databases.filter(db => 
    db.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-screen">
      {/* Header (Fixed) */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h2 className="text-lg font-semibold">phpMyAdmin</h2>
        </div>
      </div>

      {/* Search (Fixed) */}
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

      {/* Navigation (Fixed) */}
      <div className="p-4 border-b border-border">
        <div className="space-y-2">
          <Button 
            variant={isSidebarItemActive("dashboard") ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => addTab({ title: "Dashboard", type: "dashboard", closable: false })}
          >
            <Database className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button 
            variant={isSidebarItemActive("sql-editor") ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => addTab({ title: "SQL Editor", type: "sql-editor", closable: true })}
          >
            <Play className="h-4 w-4 mr-2" />
            SQL Editor
          </Button>
          <Button 
            variant={isSidebarItemActive("config") ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => addTab({ title: "Configuration", type: "config", closable: true })}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
          {hasPrivilege("CREATE USER") && (
            <Button
              variant={isSidebarItemActive("users") ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() =>
                addTab({ title: "Users", type: "users", closable: true })
              }
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
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
                          {db.totalViews > 0 && `, ${db.totalViews} ${db.totalViews === 1 ? 'view' : 'views'}`}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="ml-6">
                      {/* Tables and Views Accordion */}
                      <Accordion 
                        type="multiple" 
                        className="w-full" 
                        value={expandedSections}
                        onValueChange={setExpandedSections}
                      >
                        {/* Tables Section */}
                        {db.totalTables > 0 && (
                          <AccordionItem value={`${db.name}-tables`} className="border-none">
                            <AccordionTrigger className="hover:no-underline py-1 px-2 rounded-md hover:bg-accent text-xs">
                              <div className="flex items-center gap-2">
                                <Table className="h-3 w-3" />
                                <span className="text-foreground">Tables ({db.totalTables})</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                              <div className="ml-4 space-y-1">
                                {db.tables.length === 0 ? (
                                  <div className="text-xs text-muted-foreground p-2">
                                    No tables found
                                  </div>
                                ) : (
                                  db.tables.map((table) => (
                                    <div 
                                      key={table.name} 
                                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                                        isSidebarItemActive("table", { database: db.name, table: table.name }) 
                                          ? "bg-secondary hover:bg-secondary/80" 
                                          : "hover:bg-accent"
                                      }`}
                                      onClick={() => addTab({ 
                                        title: table.name, 
                                        type: "table", 
                                        params: { database: db.name, table: table.name },
                                        closable: true
                                      })}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Table className="h-3 w-3" />
                                        <span className="text-sm text-foreground">{table.name}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {/* Views Section */}
                        {db.totalViews > 0 && (
                          <AccordionItem value={`${db.name}-views`} className="border-none">
                            <AccordionTrigger className="hover:no-underline py-1 px-2 rounded-md hover:bg-accent text-xs">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                <span className="text-foreground">Views ({db.totalViews})</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                              <div className="ml-4 space-y-1">
                                {db.views.length === 0 ? (
                                  <div className="text-xs text-muted-foreground p-2">
                                    No views found
                                  </div>
                                ) : (
                                  db.views.map((view) => (
                                    <div 
                                      key={view.name} 
                                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                                        isSidebarItemActive("table", { database: db.name, table: view.name }) 
                                          ? "bg-secondary hover:bg-secondary/80" 
                                          : "hover:bg-accent"
                                      }`}
                                      onClick={() => addTab({ 
                                        title: view.name, 
                                        type: "table", 
                                        params: { database: db.name, table: view.name },
                                        closable: true
                                      })}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-3 w-3" />
                                        <span className="text-sm text-foreground">{view.name}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>

                      {/* Empty state when no tables or views */}
                      {db.totalTables === 0 && db.totalViews === 0 && (
                        <div className="text-xs text-muted-foreground p-2">
                          No tables or views found
                        </div>
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

      {/* Footer with Theme Toggle (Fixed) */}
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