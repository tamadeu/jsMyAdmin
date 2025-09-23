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
import { useDatabaseCache } from "@/context/DatabaseCacheContext";
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from "react-i18next"; // Import useTranslation

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
}

const DATA_TYPES = [
  "INT", "VARCHAR", "TEXT", "DATE", "DATETIME", "BOOLEAN", "FLOAT", "DOUBLE", "DECIMAL",
  "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "CHAR", "BLOB", "ENUM", "SET", "JSON"
];

const CreateTableDialog = ({ open, onOpenChange, database }: CreateTableDialogProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { refreshDatabases } = useDatabaseCache();
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
      { id: uuidv4(), name: "", type: "VARCHAR", length: 255, nullable: false, isPrimaryKey: false, isAutoIncrement: false, defaultValue: null }
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof TableColumnDefinition, value: any) => {
    setColumns(prev => prev.map(col => {
      if (col.id === id) {
        const updatedCol = { ...col, [field]: value };

        if (field === 'isPrimaryKey' && value) {
          updatedCol.nullable = false;
          setColumns(prevCols => prevCols.map(pCol => 
            pCol.id === id ? updatedCol : { ...pCol, isPrimaryKey: false, isAutoIncrement: false }
          ));
          return updatedCol;
        } else if (field === 'isPrimaryKey' && !value) {
          updatedCol.isAutoIncrement = false;
        }

        if (field === 'isAutoIncrement' && value) {
          updatedCol.isPrimaryKey = true;
          updatedCol.nullable = false;
          updatedCol.type = "INT";
          setColumns(prevCols => prevCols.map(pCol => 
            pCol.id === id ? updatedCol : { ...pCol, isPrimaryKey: false, isAutoIncrement: false }
          ));
          return updatedCol;
        } else if (field === 'isAutoIncrement' && !value) {
        }

        if (field === 'type') {
          if (!['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(value)) {
            updatedCol.length = undefined;
          } else if (value === 'VARCHAR' && updatedCol.length === undefined) {
            updatedCol.length = 255;
          } else if (['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(value) && updatedCol.length === undefined) {
            updatedCol.length = 11;
          }
        }
        
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
      setError(t("createTableDialog.tableNameEmpty"));
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(tableName.trim())) {
      setError(t("createTableDialog.tableNameInvalidChars"));
      return false;
    }

    if (columns.length === 0) {
      setError(t("createTableDialog.atLeastOneColumnRequired"));
      return false;
    }

    const columnNames = new Set<string>();
    let hasPrimaryKey = false;

    for (const col of columns) {
      if (!col.name.trim()) {
        setError(t("createTableDialog.columnNameEmpty"));
        return false;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(col.name.trim())) {
        setError(t("createTableDialog.columnNameInvalidChars", { columnName: col.name }));
        return false;
      }
      if (columnNames.has(col.name.trim().toLowerCase())) {
        setError(t("createTableDialog.duplicateColumnName", { columnName: col.name }));
        return false;
      }
      columnNames.add(col.name.trim().toLowerCase());

      if (col.isPrimaryKey) {
        if (hasPrimaryKey) {
          setError(t("createTableDialog.onlyOnePrimaryKey"));
          return false;
        }
        hasPrimaryKey = true;
      }

      if (col.isAutoIncrement && col.type !== 'INT' && !col.type.includes('INT')) {
        setError(t("createTableDialog.aiColumnMustBeInt", { columnName: col.name }));
        return false;
      }
      if (col.isAutoIncrement && !col.isPrimaryKey) {
        setError(t("createTableDialog.aiColumnMustBePk", { columnName: col.name }));
        return false;
      }
      if (['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type) && (col.length === undefined || col.length <= 0)) {
        setError(t("createTableDialog.lengthRequired", { type: col.type, columnName: col.name }));
        return false;
      }
      
      if (!col.nullable && !col.isAutoIncrement && (col.defaultValue === null || col.defaultValue === '')) {
        setError(t("createTableDialog.nonNullableDefaultValue", { columnName: col.name }));
        return false;
      }
    }

    if (!hasPrimaryKey) {
      setError(t("createTableDialog.tableMustHavePk"));
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
          title: t("createTableDialog.tableCreated"),
          description: t("createTableDialog.tableCreatedSuccessfully", { tableName: tableName, database: database }),
        });
        refreshDatabases({ databaseName: database });
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(result.message || t("createTableDialog.failedToCreateTable"));
      }
    } catch (err) {
      console.error("Error creating table:", err);
      setError(err instanceof Error ? err.message : t("createTableDialog.unknownError"));
      toast({
        title: t("createTableDialog.errorCreatingTable"),
        description: err instanceof Error ? err.message : t("createTableDialog.failedToCreateTable"),
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
            <Table className="h-5 w-5" /> {t("createTableDialog.title", { database: database })}
          </DialogTitle>
          <DialogDescription>
            {t("createTableDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tableName">{t("createTableDialog.tableName")}</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={t("createTableDialog.tableNamePlaceholder")}
              required
              className={error && error.includes(t("createTableDialog.tableName")) ? "border-red-500" : ""}
            />
          </div>

          <h3 className="text-lg font-semibold mt-4 flex items-center justify-between">
            {t("createTableDialog.columns")}
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" /> {t("createTableDialog.addColumn")}
            </Button>
          </h3>

          <div className="space-y-4">
            {columns.map((col, index) => (
              <div key={col.id} className="grid grid-cols-12 gap-2 items-center border p-3 rounded-md relative">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`col-name-${col.id}`} className="text-xs">{t("createTableDialog.name")}</Label>
                  <Input
                    id={`col-name-${col.id}`}
                    value={col.name}
                    onChange={(e) => handleColumnChange(col.id, "name", e.target.value)}
                    placeholder={`column_${index + 1}`}
                    className={`h-8 text-sm ${error && error.includes(t("createTableDialog.columnName")) && error.includes(`'${col.name}'`) ? "border-red-500" : ""}`}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label htmlFor={`col-type-${col.id}`} className="text-xs">{t("createTableDialog.type")}</Label>
                  <Select value={col.type} onValueChange={(value) => handleColumnChange(col.id, "type", value)}>
                    <SelectTrigger id={`col-type-${col.id}`} className="h-8 text-sm">
                      <SelectValue placeholder={t("createTableDialog.selectType")} />
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
                    <Label htmlFor={`col-length-${col.id}`} className="text-xs">{t("createTableDialog.length")}</Label>
                    <Input
                      id={`col-length-${col.id}`}
                      type="number"
                      value={col.length || ''}
                      onChange={(e) => handleColumnChange(col.id, "length", e.target.value ? parseInt(e.target.value) : undefined)}
                      className={`h-8 text-sm ${error && error.includes(t("createTableDialog.lengthRequired")) && error.includes(`'${col.name}'`) ? "border-red-500" : ""}`}
                    />
                  </div>
                )}
                <div className="col-span-3 space-y-1">
                  <Label htmlFor={`col-default-${col.id}`} className="text-xs">{t("createTableDialog.defaultValue")}</Label>
                  <Input
                    id={`col-default-${col.id}`}
                    value={col.defaultValue === null ? t("createTableDialog.null") : String(col.defaultValue || '')}
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
                  <Label htmlFor={`col-pk-${col.id}`} className="text-xs mt-1">{t("createTableDialog.pk")}</Label>
                </div>
                <div className="col-span-1 flex flex-col items-center justify-center h-full pt-4">
                  <Checkbox
                    id={`col-ai-${col.id}`}
                    checked={col.isAutoIncrement}
                    onCheckedChange={(checked) => handleColumnChange(col.id, "isAutoIncrement", !!checked)}
                    disabled={!col.isPrimaryKey || !['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(col.type)}
                  />
                  <Label htmlFor={`col-ai-${col.id}`} className="text-xs mt-1">{t("createTableDialog.ai")}</Label>
                </div>
                <div className="col-span-1 flex flex-col items-center justify-center h-full pt-4">
                  <Checkbox
                    id={`col-null-${col.id}`}
                    checked={col.nullable}
                    onCheckedChange={(checked) => handleColumnChange(col.id, "nullable", !!checked)}
                    disabled={col.isPrimaryKey}
                  />
                  <Label htmlFor={`col-null-${col.id}`} className="text-xs mt-1">{t("createTableDialog.null")}</Label>
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
            {t("createTableDialog.cancel")}
          </Button>
          <Button onClick={handleCreateTable} disabled={isLoading || !tableName.trim() || columns.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t("createTableDialog.createTable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableDialog;