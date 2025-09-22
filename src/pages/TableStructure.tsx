"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Table as TableIcon, Loader2, AlertCircle, RefreshCw, Edit, Plus, Trash2, Save, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiService, TableData, TableColumnDefinition } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { v4 as uuidv4 } from 'uuid';

interface TableStructureProps {
  database: string;
  table: string;
}

const DATA_TYPES = [
  "INT", "VARCHAR", "TEXT", "DATE", "DATETIME", "BOOLEAN", "FLOAT", "DOUBLE", "DECIMAL",
  "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "CHAR", "BLOB", "ENUM", "SET", "JSON"
];

const TableStructure = ({ database, table }: TableStructureProps) => {
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const [originalColumns, setOriginalColumns] = useState<TableData['columns']>([]);
  const [editableColumns, setEditableColumns] = useState<TableColumnDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadTableStructure = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getTableData(database, table, { limit: 1, offset: 0 });
      setOriginalColumns(data.columns);
      // Map TableData['columns'] to TableColumnDefinition for editing
      const mappedColumns: TableColumnDefinition[] = data.columns.map(col => ({
        id: uuidv4(), // Assign a unique ID for React keys and internal management
        name: col.name,
        type: col.type.split('(')[0].toUpperCase(), // Extract base type (e.g., VARCHAR(255) -> VARCHAR)
        length: col.type.includes('(') ? parseInt(col.type.split('(')[1].replace(')', '')) : undefined,
        nullable: col.null,
        isPrimaryKey: col.key === 'PRI',
        isAutoIncrement: col.extra.includes('auto_increment'),
        defaultValue: col.default,
      }));
      setEditableColumns(mappedColumns);
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

  const handleAddColumn = () => {
    setEditableColumns(prev => [
      ...prev,
      { id: uuidv4(), name: "", type: "VARCHAR", length: 255, nullable: false, isPrimaryKey: false, isAutoIncrement: false, defaultValue: null }
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    setEditableColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof TableColumnDefinition, value: any) => {
    setEditableColumns(prev => prev.map(col => {
      if (col.id === id) {
        const updatedCol = { ...col, [field]: value };

        // Logic for primary key and auto-increment
        if (field === 'isPrimaryKey' && value) {
          updatedCol.nullable = false; // PK cannot be nullable
          // Ensure only one PK
          setEditableColumns(prevCols => prevCols.map(pCol => 
            pCol.id === id ? updatedCol : { ...pCol, isPrimaryKey: false, isAutoIncrement: false }
          ));
          return updatedCol;
        } else if (field === 'isPrimaryKey' && !value) {
          updatedCol.isAutoIncrement = false; // If not PK, cannot be AI
        }

        if (field === 'isAutoIncrement' && value) {
          updatedCol.isPrimaryKey = true; // AI must be PK
          updatedCol.nullable = false; // AI must be NOT NULL
          updatedCol.type = "INT"; // Force INT type for AI
          // Ensure only one AI
          setEditableColumns(prevCols => prevCols.map(pCol => 
            pCol.id === id ? updatedCol : { ...pCol, isPrimaryKey: false, isAutoIncrement: false }
          ));
          return updatedCol;
        } else if (field === 'isAutoIncrement' && !value) {
          // If unsetting auto-increment, keep PK status
        }

        if (field === 'type') {
          // Reset length if type changes to one that doesn't use it
          if (!['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(value)) {
            updatedCol.length = undefined;
          } else if (value === 'VARCHAR' && updatedCol.length === undefined) {
            updatedCol.length = 255; // Default for VARCHAR
          } else if (['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(value) && updatedCol.length === undefined) {
            updatedCol.length = 11; // Default for INT types
          }
        }
        
        // If nullable is set to false, and it's not a PK, ensure default is not null
        if (field === 'nullable' && value === false && !updatedCol.isPrimaryKey && updatedCol.defaultValue === null) {
          updatedCol.defaultValue = ''; // Set to empty string or a sensible default
        }
        // If nullable is set to true, and default is empty string, set to null
        if (field === 'nullable' && value === true && updatedCol.defaultValue === '') {
          updatedCol.defaultValue = null;
        }


        return updatedCol;
      }
      return col;
    }));
  };

  const validateColumns = useCallback(() => {
    if (editableColumns.length === 0) {
      setError("At least one column is required.");
      return false;
    }

    const columnNames = new Set<string>();
    let hasPrimaryKey = false;

    for (const col of editableColumns) {
      if (!col.name.trim()) {
        setError("Column names cannot be empty.");
        return false;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(col.name.trim())) {
        setError(`Column name '${col.name}' contains invalid characters. Only alphanumeric and underscores are allowed.`);
        return false;
      }
      if (columnNames.has(col.name.trim().toLowerCase())) {
        setError(`Duplicate column name: '${col.name}'.`);
        return false;
      }
      columnNames.add(col.name.trim().toLowerCase());

      if (col.isPrimaryKey) {
        if (hasPrimaryKey) {
          setError("Only one primary key is allowed per table.");
          return false;
        }
        hasPrimaryKey = true;
      }

      if (col.isAutoIncrement && col.type !== 'INT' && !col.type.includes('INT')) {
        setError(`Auto-increment column '${col.name}' must be an integer type.`);
        return false;
      }
      if (col.isAutoIncrement && !col.isPrimaryKey) {
        setError(`Auto-increment column '${col.name}' must also be a primary key.`);
        return false;
      }
      if (['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type) && (col.length === undefined || col.length <= 0)) {
        setError(`Length is required and must be greater than 0 for ${col.type} column '${col.name}'.`);
        return false;
      }
      if (!col.nullable && (col.defaultValue === null || col.defaultValue === '')) {
        // If not nullable and no default value, it's an issue unless it's an auto-increment PK
        if (!col.isAutoIncrement) {
          setError(`Non-nullable column '${col.name}' must have a default value.`);
          return false;
        }
      }
    }

    if (!hasPrimaryKey) {
      setError("A table must have at least one primary key.");
      return false;
    }

    setError(null);
    return true;
  }, [editableColumns]);

  const handleSaveStructure = async () => {
    if (!validateColumns()) {
      return;
    }

    setIsSaving(true);
    try {
      // Here we would send editableColumns to the backend
      // For now, it's a placeholder API call
      const result = await apiService.updateTableStructure(database, table, editableColumns);
      if (result.success) {
        toast({
          title: "Table Structure Updated",
          description: `Structure for table '${table}' updated successfully.`,
        });
        setIsEditing(false);
        loadTableStructure(); // Reload original columns
      } else {
        throw new Error(result.message || "Failed to update table structure.");
      }
    } catch (err) {
      console.error("Error updating table structure:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      toast({
        title: "Error Updating Structure",
        description: err instanceof Error ? err.message : "Failed to update table structure.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset editable columns to original state
    const mappedColumns: TableColumnDefinition[] = originalColumns.map(col => ({
      id: uuidv4(),
      name: col.name,
      type: col.type.split('(')[0].toUpperCase(),
      length: col.type.includes('(') ? parseInt(col.type.split('(')[1].replace(')', '')) : undefined,
      nullable: col.null,
      isPrimaryKey: col.key === 'PRI',
      isAutoIncrement: col.extra.includes('auto_increment'),
      defaultValue: col.default,
    }));
    setEditableColumns(mappedColumns);
    setError(null);
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

  if (error && !isEditing) { // Only show global error if not in editing mode
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

  const columnsToDisplay = isEditing ? editableColumns : originalColumns.map(col => ({
    id: uuidv4(), // Temporary ID for display
    name: col.name,
    type: col.type,
    length: undefined, // Not directly available in originalColumns type
    nullable: col.null,
    isPrimaryKey: col.key === 'PRI',
    isAutoIncrement: col.extra.includes('auto_increment'),
    defaultValue: col.default,
  }));

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Table Structure: {table}</h1>
          <p className="text-muted-foreground">View and manage the column definitions for "{table}" in "{database}".</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={loadTableStructure}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          {hasPrivilege("ALTER") && (
            isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveStructure} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Structure
              </Button>
            )
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Columns ({columnsToDisplay.length})
          </CardTitle>
          <CardDescription>Detailed definitions of each column in the table.</CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing && (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={handleAddColumn}>
                <Plus className="h-4 w-4 mr-2" /> Add Column
              </Button>
            </div>
          )}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Null</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Extra</TableHead>
                  {isEditing && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {columnsToDisplay.map((col, index) => (
                  <TableRow key={col.id || col.name}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={col.name}
                          onChange={(e) => handleColumnChange(col.id, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      ) : (
                        col.name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={col.type} onValueChange={(value) => handleColumnChange(col.id, "type", value)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        col.type
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing && ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(col.type) ? (
                        <Input
                          type="number"
                          value={col.length || ''}
                          onChange={(e) => handleColumnChange(col.id, "length", e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm w-20"
                        />
                      ) : (
                        col.length || <span className="italic text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Checkbox
                          checked={col.nullable}
                          onCheckedChange={(checked) => handleColumnChange(col.id, "nullable", !!checked)}
                          disabled={col.isPrimaryKey}
                        />
                      ) : (
                        col.nullable ? 'YES' : 'NO'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <Checkbox
                            checked={col.isPrimaryKey}
                            onCheckedChange={(checked) => handleColumnChange(col.id, "isPrimaryKey", !!checked)}
                          />
                        ) : (
                          col.isPrimaryKey ? 'PRI' : ''
                        )}
                        {isEditing && <Label className="text-xs">PK</Label>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={col.defaultValue === null ? 'NULL' : String(col.defaultValue || '')}
                          onChange={(e) => handleColumnChange(col.id, "defaultValue", e.target.value === 'NULL' ? null : e.target.value)}
                          placeholder="NULL / 'value' / 0"
                          className="h-8 text-sm"
                          disabled={col.isAutoIncrement}
                        />
                      ) : (
                        col.defaultValue === null ? <span className="italic text-muted-foreground">NULL</span> : String(col.defaultValue)
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <Checkbox
                            checked={col.isAutoIncrement}
                            onCheckedChange={(checked) => handleColumnChange(col.id, "isAutoIncrement", !!checked)}
                            disabled={!col.isPrimaryKey || !['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(col.type)}
                          />
                        ) : (
                          col.isAutoIncrement ? 'auto_increment' : ''
                        )}
                        {isEditing && <Label className="text-xs">AI</Label>}
                      </div>
                    </TableCell>
                    {isEditing && (
                      <TableCell className="text-right">
                        {editableColumns.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveColumn(col.id)} className="h-8 w-8 p-0 text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {isEditing && error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default TableStructure;