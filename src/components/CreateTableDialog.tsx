"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, XCircle, Table, Trash2 } from "lucide-react";
import { apiService, TableColumnDefinition } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useDatabaseCache } from "@/context/DatabaseCacheContext"; // New import
import { v4 as uuidv4 } from 'uuid';

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  // onTableCreated: () => void; // Removed, now handled by context
}

const DATA_TYPES = [
  "INT", "VARCHAR", "TEXT", "DATE", "DATETIME", "BOOLEAN", "FLOAT", "DOUBLE", "DECIMAL",
  "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "CHAR", "BLOB", "ENUM", "SET", "JSON"
];

const CreateTableDialog = ({ open, onOpenChange, database }: CreateTableDialogProps) => {
  const { toast } = useToast();
  const { refreshDatabases } = useDatabaseCache(); // Use the hook
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<TableColumnDefinition[]>([
    { id: uuidv4(), name: "", type: "INT", nullable: false, isPrimaryKey: false, isAutoIncrement: false, defaultValue: null }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTableName("");
    setColumns([
      { id: uuidv4(), name: "", type: "INT", nullable: false, isPrimaryKey: false, isAutoIncrement: false, defaultValue: null }
    ]);
    setError(null);
  };

  const handleAddColumn = () => {
    setColumns(prev => [
      ...prev,
      { id: uuidv4(), name: "", type: "VARCHAR", length: 255, nullable: false, isPrimaryKey: false, isAutoIncrement: false, defaultValue: null } // Changed nullable to false
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof TableColumnDefinition, value: any) => {
    setColumns(prev => prev.map(col => {
      if (col.id === id) {
        const updatedCol = { ...col, [field]: value };

        // Logic for primary key and auto-increment
        if (field === 'isPrimaryKey' && value) {
          // If setting as PK, it must be NOT NULL
          updatedCol.nullable = false;
          // Ensure only one PK
          setColumns(prevCols => prevCols.map(pCol => 
            pCol.id === id ? updatedCol : { ...pCol, isPrimaryKey: false, isAutoIncrement: false }
          ));
          return updatedCol;
        } else if (field === 'isPrimaryKey' && !value) {
          // If unsetting PK, also unset auto-increment
          updatedCol.isAutoIncrement = false;
        }

        if (field === 'isAutoIncrement' && value) {
          // If setting auto-increment, it must be PK and INT
          updatedCol.isPrimaryKey = true;
          updatedCol.nullable = false;
          updatedCol.type = "INT"; // Force INT type
          // Ensure only one PK
          setColumns(prevCols => prevCols.map(pCol => 
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
        
        // Handle defaultValue: if input is empty, store as '', not null
        if (field === 'defaultValue') {
          updatedCol.defaultValue = value === '' ? '' : value;
        }

        return updatedCol;
      }
      return col;
    }));
  };

  const validateForm = () => {
    if (!tableName.trim()) {
      setError("Table name cannot be empty.");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(tableName.trim())) {
      setError("Table name contains invalid characters. Only alphanumeric and underscores are allowed.");
      return false;
    }

    if (columns.length === 0) {
      setError("At least one column is required.");
      return false;
    }

    const columnNames = new Set<string>();
    let hasPrimaryKey = false;

    for (const col of columns) {
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
      
      // Validation for NOT NULL columns without a default value
      if (!col.nullable && !col.isAutoIncrement && (col.defaultValue === null || col.defaultValue === '')) {
        setError(`Non-nullable column '${col.name}' must have a default value.`);
        return false;
      }
    }

    if (!hasPrimaryKey) {
      setError("A table must have at least one primary key.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleCreateTable = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiService.createTable(database, tableName.trim(), columns);
      if (result.success) {
        toast({
          title: "Table Created",
          description: `Table '${tableName}' created successfully in '${database}'.`,
        });
        refreshDatabases({ databaseName: database }); // Invalidate cache for this database
        onOpenChange(false); // Close dialog
        resetForm(); // Reset form
      } else {
        throw new Error(result.message || "Failed to create table.");
      }
    } catch (err) {
      console.error("Error creating table:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      toast({
        title: "Error Creating Table",
        description: err instanceof Error ? err.message : "Failed to create database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading) { onOpenChange(o); resetForm(); } }}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table className="h-5 w-5" /> Create New Table in "{database}"
          </DialogTitle>
          <DialogDescription>
            Define the structure of your new table, including its name and columns.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g., users"
              required
              className={error && error.includes("Table name") ? "border-red-500" : ""}
            />
          </div>

          <h3 className="text-lg font-semibold mt-4 flex items-center justify-between">
            Columns
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" /> Add Column
            </Button>
          </h3>

          <div className="space-y-4">
            {columns.map((col, index) => (
              <div key={col.id} className="grid grid-cols-12 gap-2 items-center border p-3 rounded-md relative">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`col-name-${col.id}`} className="text-xs">Name</Label>
                  <Input
                    id={`col-name-${col.id}`}
                    value={col.name}
                    onChange={(e) => handleColumnChange(col.id, "name", e.target.value)}
                    placeholder={`column_${index + 1}`}
                    className={`h-8 text-sm ${error && error.includes("Column name") && error.includes(`'${col.name}'`) ? "border-red-500" : ""}`}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label htmlFor={`col-type-${col.id}`} className="text-xs">Type</Label>
                  <Select value={col.type} onValueChange={(value) => handleColumnChange(col.id, "type", value)}>
                    <SelectTrigger id={`col-type-${col.id}`} className="h-8 text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(col.type) && (
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor={`col-length-${col.id}`} className="text-xs">Length</Label>
                    <Input
                      id={`col-length-${col.id}`}
                      type="number"
                      value={col.length || ''}
                      onChange={(e) => handleColumnChange(col.id, "length", e.target.value ? parseInt(e.target.value) : undefined)}
                      className={`h-8 text-sm ${error && error.includes("Length is required") && error.includes(`'${col.name}'`) ? "border-red-500" : ""}`}
                    />
                  </div>
                )}
                <div className="col-span-3 space-y-1">
                  <Label htmlFor={`col-default-${col.id}`} className="text-xs">Default Value</Label>
                  <Input
                    id={`col-default-${col.id}`}
                    value={col.defaultValue === null ? 'NULL' : String(col.defaultValue || '')}
                    onChange={(e) => handleColumnChange(col.id, "defaultValue", e.target.value)}
                    placeholder="NULL / 'value' / 0"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-1 flex flex-col items-center justify-center h-full pt-4">
                  <Checkbox
                    id={`col-pk-${col.id}`}
                    checked={col.isPrimaryKey}
                    onCheckedChange={(checked) => handleColumnChange(col.id, "isPrimaryKey", !!checked)}
                  />
                  <Label htmlFor={`col-pk-${col.id}`} className="text-xs mt-1">PK</Label>
                </div>
                <div className="col-span-1 flex flex-col items-center justify-center h-full pt-4">
                  <Checkbox
                    id={`col-ai-${col.id}`}
                    checked={col.isAutoIncrement}
                    onCheckedChange={(checked) => handleColumnChange(col.id, "isAutoIncrement", !!checked)}
                    disabled={!col.isPrimaryKey || !['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(col.type)}
                  />
                  <Label htmlFor={`col-ai-${col.id}`} className="text-xs mt-1">AI</Label>
                </div>
                <div className="col-span-1 flex flex-col items-center justify-center h-full pt-4">
                  <Checkbox
                    id={`col-null-${col.id}`}
                    checked={col.nullable}
                    onCheckedChange={(checked) => handleColumnChange(col.id, "nullable", !!checked)}
                    disabled={col.isPrimaryKey} // PK cannot be nullable
                  />
                  <Label htmlFor={`col-null-${col.id}`} className="text-xs mt-1">NULL</Label>
                </div>
                <div className="col-span-1 flex items-center justify-center h-full pt-4">
                  {columns.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveColumn(col.id)} className="h-8 w-8 p-0 text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCreateTable} disabled={isLoading || !tableName.trim() || columns.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableDialog;