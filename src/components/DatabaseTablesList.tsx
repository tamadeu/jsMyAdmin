"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Table, Eye, Loader2, AlertCircle, RefreshCw, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiService, TableInfo } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";

interface DatabaseTablesListProps {
  database: string;
}

const DatabaseTablesList = ({ database }: DatabaseTablesListProps) => {
  const { toast } = useToast();
  const { addTab } = useTabs();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [views, setViews] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadTablesAndViews = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getTables(database);
      setTables(data.tables);
      setViews(data.views);
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

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredViews = views.filter(view =>
    view.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenTable = (tableName: string) => {
    addTab({
      title: tableName,
      type: "table",
      params: { database, table: tableName },
      closable: true,
    });
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

  const hasContent = filteredTables.length > 0 || filteredViews.length > 0;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tables & Views: {database}</h1>
          <p className="text-muted-foreground">Browse all tables and views in the "{database}" database.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTablesAndViews}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
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
            {searchTerm ? 'No tables or views found matching your search.' : 'No tables or views in this database.'}
          </p>
        </div>
      )}

      {filteredTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              Tables ({filteredTables.length})
            </CardTitle>
            <CardDescription>List of tables in the "{database}" database.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <ShadcnTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Collation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTables.map((table) => (
                    <TableRow key={table.name}>
                      <TableCell className="font-medium">{table.name}</TableCell>
                      <TableCell>{table.rows.toLocaleString()}</TableCell>
                      <TableCell>{table.size}</TableCell>
                      <TableCell>{table.engine}</TableCell>
                      <TableCell>{table.collation}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenTable(table.name)}>
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

      {filteredViews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Views ({filteredViews.length})
            </CardTitle>
            <CardDescription>List of views in the "{database}" database.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <ShadcnTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Collation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViews.map((view) => (
                    <TableRow key={view.name}>
                      <TableCell className="font-medium">{view.name}</TableCell>
                      <TableCell>{view.rows.toLocaleString()}</TableCell>
                      <TableCell>{view.size}</TableCell>
                      <TableCell>{view.engine}</TableCell>
                      <TableCell>{view.collation}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenTable(view.name)}>
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
    </div>
  );
};

export default DatabaseTablesList;