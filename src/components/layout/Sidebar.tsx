"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Database, Table, Eye, Search, Settings, Play, Loader2, AlertCircle, Wrench, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiService, DatabaseTablesResponse } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs, AppTab } from "@/context/TabContext";
import { useAuth } from "@/context/AuthContext";
import { useDatabaseCache } from "@/context/DatabaseCacheContext"; // New import
import CreateDatabaseDialog from "@/components/CreateDatabaseDialog";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { tabs, activeTabId, addTab, setActiveTab, getTabById } = useTabs();
  const { hasPrivilege } = useAuth();
  const { databases, isLoadingDatabases, databaseError, refreshDatabases } = useDatabaseCache(); // Use the hook

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isCreateDbDialogOpen, setIsCreateDbDialogOpen] = useState(false);

  // Determine if a sidebar item corresponds to the active tab
  const isSidebarItemActive = (type: AppTab['type'], params?: AppTab['params'], filterType?: AppTab['filterType']) => {
    const activeTab = getTabById(activeTabId);
    if (!activeTab) return false;

    if (activeTab.type === type) {
      if (type === 'table') {
        return activeTab.params?.database === params?.database && activeTab.params?.table === params?.table;
      }
      if (type === 'database-tables-list') {
        return activeTab.params?.database === params?.database && activeTab.filterType === filterType;
      }
      if (type === 'table-structure') {
        return activeTab.params?.database === params?.database && activeTab.params?.table === params?.table;
      }
      return true; // For dashboard, sql-editor, config, users, just type match is enough
    }
    return false;
  };

  // Update expanded databases based on current active tab
  useEffect(() => {
    const activeTab = getTabById(activeTabId);

    if (activeTab && (activeTab.type === 'table' || activeTab.type === 'database-tables-list' || activeTab.type === 'table-structure') && activeTab.params?.database) {
      let targetExpandedDatabases: string[] = [activeTab.params.database];
      let targetExpandedSections: string[] = [];

      if (activeTab.type === 'table' && activeTab.params.table) {
        const db = databases.find(d => d.name === activeTab.params?.database);
        if (db) {
          const isView = db.views.some(view => view.name === activeTab.params?.table);
          targetExpandedSections = [`${activeTab.params.database}-${isView ? 'views' : 'tables'}`];
        }
      } else if (activeTab.type === 'database-tables-list') {
        if (activeTab.filterType === 'tables' || activeTab.filterType === 'all') {
          targetExpandedSections.push(`${activeTab.params.database}-tables`);
        }
        if (activeTab.filterType === 'views' || activeTab.filterType === 'all') {
          targetExpandedSections.push(`${activeTab.params.database}-views`);
        }
      } else if (activeTab.type === 'table-structure' && activeTab.params.table) {
        const db = databases.find(d => d.name === activeTab.params?.database);
        if (db) {
          const isView = db.views.some(view => view.name === activeTab.params?.table);
          targetExpandedSections = [`${activeTab.params.database}-${isView ? 'views' : 'tables'}`];
        }
      }

      // Only update if different to prevent unnecessary re-renders
      setExpandedDatabases(prev => JSON.stringify(prev) === JSON.stringify(targetExpandedDatabases) ? prev : targetExpandedDatabases);
      setExpandedSections(prev => JSON.stringify(prev) === JSON.stringify(targetExpandedSections) ? prev : targetExpandedSections);
    } 
  }, [activeTabId, databases, getTabById]);

  const handleDatabaseToggle = async (databaseName: string) => {
    // The context already loads all tables/views for all databases.
    // So, no need to fetch tables here. Just toggle expansion.
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
          <h2 className="text-lg font-semibold">jsMyAdmin</h2>
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
            onClick={() => navigate('/')}
          >
            <Database className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button 
            variant={isSidebarItemActive("sql-editor") ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => navigate('/sql')}
          >
            <Play className="h-4 w-4 mr-2" />
            SQL Editor
          </Button>
          <Button 
            variant={isSidebarItemActive("config") ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => navigate('/configuration')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
          {hasPrivilege("CREATE USER") && (
            <Button
              variant={isSidebarItemActive("users") ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => navigate('/users')}
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </Button>
          )}
          {hasPrivilege("CREATE") && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setIsCreateDbDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Database
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
              onClick={() => refreshDatabases({ force: true })} // Force refresh
              disabled={isLoadingDatabases}
              className="h-6 w-6 p-0"
            >
              <Loader2 className={`h-3 w-3 ${isLoadingDatabases ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Loading State */}
          {isLoadingDatabases && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading databases...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {databaseError && !isLoadingDatabases && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <p className="text-sm text-red-500 mb-2">Failed to load databases</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refreshDatabases({ force: true })} // Force refresh
                  className="text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Databases */}
          {!isLoadingDatabases && !databaseError && (
            <Accordion 
              type="multiple" 
              className="w-full" 
              value={expandedDatabases}
              onValueChange={setExpandedDatabases}
            >
              {filteredDatabases.map((db) => (
                <AccordionItem key={db.name} value={db.name} className="border-none">
                  <AccordionTrigger 
                    className={`hover:no-underline py-2 px-2 rounded-md hover:bg-accent ${
                      isSidebarItemActive("database-tables-list", { database: db.name }, 'all') 
                        ? "bg-secondary hover:bg-secondary/80" 
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDatabaseToggle(db.name);
                      navigate(`/${db.name}/tables`);
                    }}
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
                      <Accordion 
                        type="multiple" 
                        className="w-full" 
                        value={expandedSections}
                        onValueChange={setExpandedSections}
                      >
                        {/* Tables Section */}
                        {db.totalTables > 0 && (
                          <AccordionItem value={`${db.name}-tables`} className="border-none">
                            <AccordionTrigger 
                              className={`hover:no-underline py-1 px-2 rounded-md hover:bg-accent text-xs ${
                                isSidebarItemActive("database-tables-list", { database: db.name }, 'tables') 
                                  ? "bg-secondary hover:bg-secondary/80" 
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/${db.name}/tables`);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Table className="h-3 w-3" />
                                <span className="text-foreground">Tables ({db.totalTables})</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                              <div className="ml-4 space-y-1">
                                {db.tables.map((table) => (
                                  <div 
                                    key={table.name} 
                                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                                      isSidebarItemActive("table", { database: db.name, table: table.name }) 
                                        ? "bg-secondary hover:bg-secondary/80" 
                                        : "hover:bg-accent"
                                    }`}
                                    onClick={() => navigate(`/${db.name}/${table.name}`)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Table className="h-3 w-3" />
                                      <span className="text-sm text-foreground">{table.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {/* Views Section */}
                        {db.totalViews > 0 && (
                          <AccordionItem value={`${db.name}-views`} className="border-none">
                            <AccordionTrigger 
                              className={`hover:no-underline py-1 px-2 rounded-md hover:bg-accent text-xs ${
                                isSidebarItemActive("database-tables-list", { database: db.name }, 'views') 
                                  ? "bg-secondary hover:bg-secondary/80" 
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/${db.name}/views`);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                <span className="text-foreground">Views ({db.totalViews})</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                              <div className="ml-4 space-y-1">
                                {db.views.map((view) => (
                                  <div 
                                    key={view.name} 
                                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                                      isSidebarItemActive("table", { database: db.name, table: view.name }) 
                                        ? "bg-secondary hover:bg-secondary/80" 
                                        : "hover:bg-accent"
                                    }`}
                                    onClick={() => navigate(`/${db.name}/${view.name}`)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Eye className="h-3 w-3" />
                                      <span className="text-sm text-foreground">{view.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* No databases found */}
          {!isLoadingDatabases && !databaseError && filteredDatabases.length === 0 && databases.length > 0 && (
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

      <CreateDatabaseDialog
        open={isCreateDbDialogOpen}
        onOpenChange={setIsCreateDbDialogOpen}
        onDatabaseCreated={() => refreshDatabases({ force: true })} // Invalidate cache on new DB
      />
    </div>
  );
};

export default Sidebar;