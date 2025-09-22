"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Eye, Loader2, AlertCircle, RefreshCw, Search, X, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiService, TableInfo } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import CreateTableDialog from "@/components/CreateTableDialog"; // Import the new dialog

interface DatabaseTablesListProps {
  database: string;
  filterType?: 'all' | 'tables' | 'views'; // Adicionado filterType
}

const DatabaseTablesList = ({ database, filterType = 'all' }: DatabaseTablesListProps) => {
  const { toast } = useToast();
  const { addTab } = useTabs();
  const { hasPrivilege } = useAuth(); // Use hasPrivilege
  const [allTables, setAllTables] = useState<TableInfo[]>([]); // Armazena todas as tabelas
  const [allViews, setAllViews] = useState<TableInfo[]>([]);   // Armazena todas as views
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateTableDialogOpen, setIsCreateTableDialogOpen] = useState(false); // State for the new dialog

  const loadTablesAndViews = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getTables(database);
      setAllTables(data.tables);
      setAllViews(data.views);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load tables and views";
      setError(errorMessage);
      toast({
        title: "Error loading tables",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [database, toast]);

  useEffect(() => {
    loadTablesAndViews();
  }, [loadTablesAndViews]);

  const filteredItems = useMemo(() => {
    let items: TableInfo[] = [];
    if (filterType === 'tables' || filterType === 'all') {
      items = items.concat(allTables);
    }
    if (filterType === 'views' || filterType === 'all') {
      items = items.concat(allViews);
    }

    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTables, allViews, searchTerm, filterType]);

  const handleOpenTable = (tableName: string) => {
    addTab({
      title: tableName,
      type: "table",
      params: { database, table: tableName },
      closable: true,
    });
  };

  const getTitle = () => {
    switch (filterType) {
      case 'tables': return `Tables: ${database}`;
      case 'views': return `Views: ${database}`;
      default: return `Tables & Views: ${database}`;
    }
  };

  const getDescription = () => {
    switch (filterType) {
      case 'tables': return `Browse all tables in the "${database}" database.`;
      case 'views': return `Browse all views in the "${database}" database.`;
      default: return `Browse all tables and views in the "${database}" database.`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tables and views for "{database}"...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadTablesAndViews} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const hasContent = filteredItems.length > 0;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getTitle()}</h1>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTablesAndViews}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasPrivilege("CREATE") && filterType !== 'views' && ( // Only allow creating tables, not views
            <Button size="sm" onClick={() => setIsCreateTableDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Table
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Search for tables or views by name.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables or views..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasContent && (
        <div className="text-center py-8">
          <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchTerm ? 'No items found matching your search.' : `No ${filterType === 'tables' ? 'tables' : filterType === 'views' ? 'views' : 'tables or views'} in this database.`}
          </p>
        </div>
      )}

      {filteredItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              {filterType === 'tables' ? 'Tables' : filterType === 'views' ? 'Views' : 'Items'} ({filteredItems.length})
            </CardTitle>
            <CardDescription>List of {filterType === 'tables' ? 'tables' : filterType === 'views' ? 'views' : 'items'} in the "{database}" database.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <ShadcnTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead> {/* Adicionado Type */}
                    <TableHead>Rows</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Collation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{allTables.some(t => t.name === item.name) ? 'Table' : 'View'}</TableCell> {/* Determina o tipo */}
                      <TableCell>{item.rows.toLocaleString()}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell>{item.engine}</TableCell>
                      <TableCell>{item.collation}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenTable(item.name)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Browse
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ShadcnTable>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateTableDialog
        open={isCreateTableDialogOpen}
        onOpenChange={setIsCreateTableDialogOpen}
        database={database}
        onTableCreated={loadTablesAndViews}
      />
    </div>
  );
};

export default DatabaseTablesList;