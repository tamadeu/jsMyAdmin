"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Table as TableIcon, Loader2, AlertCircle, RefreshCw, Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiService, TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface TableStructureProps {
  database: string;
  table: string;
}

const TableStructure = ({ database, table }: TableStructureProps) => {
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const [columns, setColumns] = useState<TableData['columns']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTableStructure = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Using getTableData to fetch column definitions
      const data = await apiService.getTableData(database, table, { limit: 1, offset: 0 });
      setColumns(data.columns);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load table structure";
      setError(errorMessage);
      toast({
        title: "Error loading table structure",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [database, table, toast]);

  useEffect(() => {
    loadTableStructure();
  }, [loadTableStructure]);

  const handleEditStructure = () => {
    toast({
      title: "Not Implemented",
      description: "Editing table structure will be implemented soon.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading table structure for "{table}"...</p>
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
          <Button onClick={loadTableStructure} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Table Structure: {table}</h1>
          <p className="text-muted-foreground">View and manage the column definitions for "{table}" in "{database}".</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTableStructure}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasPrivilege("ALTER") && ( // Check for ALTER privilege to edit structure
            <Button size="sm" onClick={handleEditStructure}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Structure
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Columns ({columns.length})
          </CardTitle>
          <CardDescription>Detailed definitions of each column in the table.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Null</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Extra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="font-medium">{col.name}</TableCell>
                    <TableCell>{col.type}</TableCell>
                    <TableCell>{col.null ? 'YES' : 'NO'}</TableCell>
                    <TableCell>{col.key}</TableCell>
                    <TableCell>{col.default === null ? <span className="italic text-muted-foreground">NULL</span> : String(col.default)}</TableCell>
                    <TableCell>{col.extra || <span className="italic text-muted-foreground">None</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TableStructure;