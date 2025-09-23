"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Table as TableIcon, Loader2, AlertCircle, RefreshCw, Edit, Plus, Trash2, Save, XCircle, GripVertical } from "lucide-react";
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
import { useDatabaseCache } from "@/context/DatabaseCacheContext";
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useTranslation } from "react-i18next"; // Import useTranslation

interface TableStructureProps {
  database: string;
  table: string;
}

const DATA_TYPES = [
  "INT", "VARCHAR", "TEXT", "DATE", "DATETIME", "BOOLEAN", "FLOAT", "DOUBLE", "DECIMAL",
  "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "CHAR", "BLOB", "ENUM", "SET", "JSON"
];

const TableStructure = ({ database, table }: TableStructureProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const { refreshDatabases } = useDatabaseCache();
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
      const mappedColumns: TableColumnDefinition[] = data.columns.map(col => ({
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("tableStructurePage.failedToLoadStructure");
      setError(errorMessage);
      toast({
        title: t("tableStructurePage.errorLoadingStructure"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [database, table, toast, t]);

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

        if (field === 'isPrimaryKey' && value) {
          updatedCol.nullable = false;
          setEditableColumns(prevCols => prevCols.map(pCol => 
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
          setEditableColumns(prevCols => prevCols.map(pCol => 
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
        
        if (field === 'nullable' && value === false && !updatedCol.isPrimaryKey && updatedCol.defaultValue === null) {
          updatedCol.defaultValue = '';
        }
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
      setError(t("tableStructurePage.atLeastOneColumnRequired"));
      return false;
    }

    const columnNames = new Set<string>();
    let hasPrimaryKey = false;

    for (const col of editableColumns) {
      if (!col.name.trim()) {
        setError(t("tableStructurePage.columnNameEmpty"));
        return false;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(col.name.trim())) {
        setError(t("tableStructurePage.columnNameInvalidChars", { columnName: col.name }));
        return false;
      }
      if (columnNames.has(col.name.trim().toLowerCase())) {
        setError(t("tableStructurePage.duplicateColumnName", { columnName: col.name }));
        return false;
      }
      columnNames.add(col.name.trim().toLowerCase());

      if (col.isPrimaryKey) {
        if (hasPrimaryKey) {
          setError(t("tableStructurePage.onlyOnePrimaryKey"));
          return false;
        }
        hasPrimaryKey = true;
      }

      if (col.isAutoIncrement && col.type !== 'INT' && !col.type.includes('INT')) {
        setError(t("tableStructurePage.aiColumnMustBeInt", { columnName: col.name }));
        return false;
      }
      if (col.isAutoIncrement && !col.isPrimaryKey) {
        setError(t("tableStructurePage.aiColumnMustBePk", { columnName: col.name }));
        return false;
      }
      if (['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type) && (col.length === undefined || col.length <= 0)) {
        setError(t("tableStructurePage.lengthRequired", { type: col.type, columnName: col.name }));
        return false;
      }
      if (!col.nullable && (col.defaultValue === null || col.defaultValue === '')) {
        if (!col.isAutoIncrement) {
          setError(t("tableStructurePage.nonNullableDefaultValue", { columnName: col.name }));
          return false;
        }
      }
    }

    if (!hasPrimaryKey) {
      setError(t("tableStructurePage.tableMustHavePk"));
      return false;
    }

    setError(null);
    return true;
  }, [editableColumns, t]);

  const handleSaveStructure = async () => {
    if (!validateColumns()) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await apiService.updateTableStructure(database, table, editableColumns);
      if (result.success) {
        toast({
          title: t("tableStructurePage.tableStructureUpdated"),
          description: t("tableStructurePage.tableStructureUpdatedSuccessfully", { tableName: table }),
        });
        setIsEditing(false);
        refreshDatabases({ databaseName: database });
        loadTableStructure();
      } else {
        throw new Error(result.message || t("tableStructurePage.failedToUpdateStructure"));
      }
    } catch (err) {
      console.error("Error updating table structure:", err);
      setError(err instanceof Error ? err.message : t("tableStructurePage.unknownError"));
      toast({
        title: t("tableStructurePage.errorUpdatingStructure"),
        description: err instanceof Error ? err.message : t("tableStructurePage.failedToUpdateStructure"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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

  const onDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

    const reorderedColumns = Array.from(editableColumns);
    const [removed] = reorderedColumns.splice(result.source.index, 1);
    reorderedColumns.splice(result.destination.index, 0, removed);

    setEditableColumns(reorderedColumns);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("tableStructurePage.loadingStructure", { tableName: table })}</p>
        </div>
      </div>
    );
  }

  if (error && !isEditing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadTableStructure} variant="outline">
            {t("tableStructurePage.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const columnsToDisplay = isEditing ? editableColumns : originalColumns.map(col => ({
    id: uuidv4(),
    name: col.name,
    type: col.type,
    length: undefined,
    nullable: col.null,
    isPrimaryKey: col.key === 'PRI',
    isAutoIncrement: col.extra.includes('auto_increment'),
    defaultValue: col.default,
  }));

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("tableStructurePage.title", { tableName: table })}</h1>
          <p className="text-muted-foreground">{t("tableStructurePage.subtitle", { tableName: table, databaseName: database })}</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={loadTableStructure}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("tableStructurePage.refresh")}
            </Button>
          )}
          {hasPrivilege("ALTER") && (
            isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("tableStructurePage.cancel")}
                </Button>
                <Button size="sm" onClick={handleSaveStructure} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {t("tableStructurePage.saveChanges")}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                {t("tableStructurePage.editStructure")}
              </Button>
            )
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            {t("tableStructurePage.columns")} ({columnsToDisplay.length})
          </CardTitle>
          <CardDescription>{t("tableStructurePage.columnsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing && (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={handleAddColumn}>
                <Plus className="h-4 w-4 mr-2" /> {t("tableStructurePage.addColumn")}
              </Button>
            </div>
          )}
          <div className="border rounded-lg overflow-hidden">
            <DragDropContext onDragEnd={onDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isEditing && <TableHead className="w-10"></TableHead>}
                    <TableHead>{t("tableStructurePage.name")}</TableHead>
                    <TableHead>{t("tableStructurePage.type")}</TableHead>
                    <TableHead>{t("tableStructurePage.length")}</TableHead>
                    <TableHead>{t("tableStructurePage.null")}</TableHead>
                    <TableHead>{t("tableStructurePage.key")}</TableHead>
                    <TableHead>{t("tableStructurePage.default")}</TableHead>
                    <TableHead>{t("tableStructurePage.extra")}</TableHead>
                    {isEditing && <TableHead className="text-right">{t("tableStructurePage.actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <Droppable droppableId="columns">
                  {(provided) => (
                    <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                      {columnsToDisplay.map((col, index) => (
                        <Draggable key={col.id} draggableId={col.id} index={index} isDragDisabled={!isEditing}>
                          {(provided, snapshot) => (
                            <TableRow
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                backgroundColor: snapshot.isDragging ? 'hsl(var(--accent))' : 'transparent',
                              }}
                            >
                              {isEditing && (
                                <TableCell className="w-10 text-center" {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                </TableCell>
                              )}
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
                                  col.length || <span className="italic text-muted-foreground">{t("tableStructurePage.na")}</span>
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
                                  col.nullable ? t("userPrivilegesDialog.yes") : t("userPrivilegesDialog.no")
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
                                    col.isPrimaryKey ? t("tableStructurePage.pk") : ''
                                  )}
                                  {isEditing && <Label className="text-xs">{t("tableStructurePage.pk")}</Label>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={col.defaultValue === null ? t("tableStructurePage.null") : String(col.defaultValue || '')}
                                    onChange={(e) => handleColumnChange(col.id, "defaultValue", e.target.value === t("tableStructurePage.null") ? null : e.target.value)}
                                    placeholder="NULL / 'value' / 0"
                                    className="h-8 text-sm"
                                    disabled={col.isAutoIncrement}
                                  />
                                ) : (
                                  col.defaultValue === null ? <span className="italic text-muted-foreground">{t("tableStructurePage.null")}</span> : String(col.defaultValue)
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
                                    col.isAutoIncrement ? t("tableStructurePage.ai") : ''
                                  )}
                                  {isEditing && <Label className="text-xs">{t("tableStructurePage.ai")}</Label>}
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
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  )}
                </Droppable>
              </Table>
            </DragDropContext>
          </div>
          {isEditing && error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default TableStructure;