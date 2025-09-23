"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QueryResult, apiService, TableData } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Table as TableIcon, Search, Filter, RotateCcw, Download, X, Loader2, ChevronDown, ChevronUp, Plus, Edit, Copy, Trash2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useDatabaseCache } from "@/context/DatabaseCacheContext";
import InsertRowDialog from "@/components/InsertRowDialog";
import ExportDataDialog from "@/components/ExportDataDialog"; // Import the new ExportDataDialog
import { useTranslation } from "react-i18next"; // Import useTranslation

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for debouncing object values
const useDebounceObject = (value: Record<string, string>, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [JSON.stringify(value), delay]);

  return debouncedValue;
};

interface DatabaseBrowserProps {
  database: string;
  table: string;
}

const DatabaseBrowser = ({ database, table }: DatabaseBrowserProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const { refreshDatabases } = useDatabaseCache();
  const [searchInput, setSearchInput] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [queryTime, setQueryTime] = useState<string>("0.0000");
  const [editingCell, setEditingCell] = useState<{rowIndex: number, columnName: string} | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingRow, setEditingRow] = useState<{rowIndex: number, data: Record<string, any>} | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set()); // FIX: Correct initialization
  const [deleteConfirm, setDeleteConfirm] = useState<{rowIndex: number, primaryKey: any} | null>(null);
  const [isInsertRowDialogOpen, setIsInsertRowDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false); // State for export dialog

  const debouncedSearchTerm = useDebounce(searchInput, 500);
  const debouncedColumnFilters = useDebounceObject(columnFilters, 500);

  const primaryKeyColumn = useMemo(() => {
    return tableData?.columns.find(col => col.key === 'PRI') || null;
  }, [tableData]);

  const hasPrimaryKey = !!primaryKeyColumn;

  useEffect(() => {
    if (database && table) {
      loadTableData();
      loadTableInfo();
    }
  }, [database, table, limit, offset, debouncedSearchTerm, debouncedColumnFilters]);

  const loadTableData = async () => {
    if (!database || !table) return;

    try {
      if (!tableData) {
        setIsLoading(true);
      } else {
        setIsSearching(true);
      }
      setError(null);

      const startTime = Date.now();
      const data = await apiService.getTableData(database, table, {
        limit,
        offset,
        search: debouncedSearchTerm,
        columnFilters: debouncedColumnFilters
      });
      const endTime = Date.now();
      
      setQueryTime(((endTime - startTime) / 1000).toFixed(4));
      setTableData(data);
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Error loading table data:', error);
      setError(error instanceof Error ? error.message : t('queryResultTable.failedToLoadTableData'));
      toast({
        title: t("queryResultTable.errorLoadingTableData"),
        description: t("queryResultTable.failedToFetchTableData"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const loadTableInfo = async () => {
    if (!database || !table) return;

    try {
      const tables = await apiService.getTables(database);
      const info = tables.tables.find(t => t.name === table) || tables.views.find(v => v.name === table);
      setTableInfo(info);
    } catch (error) {
      console.error('Error loading table info:', error);
    }
  };

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    setOffset(0);
  };

  const handleColumnFilter = (columnName: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnName]: value
    }));
    setOffset(0);
  };

  const clearColumnFilter = (columnName: string) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnName];
      return newFilters;
    });
    setOffset(0);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setSearchInput("");
    setOffset(0);
  };

  const handleLimitChange = (value: string) => {
    setLimit(parseInt(value));
    setOffset(0);
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (tableData && offset + limit < tableData.total) {
      setOffset(offset + limit);
    }
  };

  const getPrimaryKeyValue = (row: any) => {
    if (!primaryKeyColumn) return null;
    return row[primaryKeyColumn.name];
  };

  const handleCellDoubleClick = (rowIndex: number, columnName: string, currentValue: any) => {
    if (!hasPrimaryKey || !hasPrivilege("UPDATE")) return;
    
    setEditingCell({ rowIndex, columnName });
    setEditValue(currentValue === null ? '' : String(currentValue));
  };

  const handleCellEditSave = async () => {
    if (!editingCell || !tableData || !database || !table || !primaryKeyColumn) return;

    try {
      const row = tableData.data[editingCell.rowIndex];
      const primaryKey = getPrimaryKeyValue(row);

      await apiService.updateCell(database, table, primaryKey, editingCell.columnName, editValue);
      
      toast({
        title: t("queryResultTable.cellUpdated"),
        description: t("queryResultTable.cellUpdatedSuccessfully"),
      });

      await loadTableData();
      refreshDatabases({ databaseName: database });
      
    } catch (error) {
      console.error('Error updating cell:', error);
      toast({
        title: t("queryResultTable.errorUpdatingCell"),
        description: error instanceof Error ? error.message : t("queryResultTable.failedToUpdateCell"),
        variant: "destructive"
      });
    } finally {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handleCellEditCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellEditSave();
    } else if (e.key === 'Escape') {
      handleCellEditCancel();
    }
  };

  const handleEditRow = (rowIndex: number) => {
    if (!tableData) return;
    const row = tableData.data[rowIndex];
    setEditingRow({ rowIndex, data: { ...row } });
  };

  const handleRowEditSave = async () => {
    if (!editingRow || !tableData || !database || !table || !primaryKeyColumn) return;

    try {
      const originalRow = tableData.data[editingRow.rowIndex];
      const primaryKey = getPrimaryKeyValue(originalRow);

      await apiService.updateRow(database, table, primaryKey, editingRow.data);
      
      toast({
        title: t("queryResultTable.rowUpdated"),
        description: t("queryResultTable.rowUpdatedSuccessfully"),
      });

      await loadTableData();
      refreshDatabases({ databaseName: database });
      
    } catch (error) {
      console.error('Error updating row:', error);
      toast({
        title: t("queryResultTable.errorUpdatingRow"),
        description: error instanceof Error ? error.message : t("queryResultTable.failedToUpdateRow"),
        variant: "destructive"
      });
    } finally {
      setEditingRow(null);
    }
  };

  const handleRowEditCancel = () => {
    setEditingRow(null);
  };

  const handleCopyRow = async (rowIndex: number) => {
    if (!tableData || !database || !table) return;

    try {
      const row = tableData.data[rowIndex];
      const copyData = { ...row };
      
      if (primaryKeyColumn && primaryKeyColumn.extra.includes('auto_increment')) {
        delete copyData[primaryKeyColumn.name];
      }

      await apiService.insertRow(database, table, copyData);
      
      toast({
        title: t("queryResultTable.rowCopied"),
        description: t("queryResultTable.rowCopiedSuccessfully"),
      });

      await loadTableData();
      refreshDatabases({ databaseName: database });
      
    } catch (error) {
      console.error('Error copying row:', error);
      toast({
        title: t("queryResultTable.errorCopyingRow"),
        description: error instanceof Error ? error.message : t("queryResultTable.failedToCopyRow"),
        variant: "destructive"
      });
    }
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!tableData) return;
    const row = tableData.data[rowIndex];
    const primaryKey = getPrimaryKeyValue(row);
    setDeleteConfirm({ rowIndex, primaryKey });
  };

  const confirmDeleteRow = async () => {
    if (!deleteConfirm || !database || !table) return;

    try {
      await apiService.deleteRow(database, table, deleteConfirm.primaryKey);
      
      toast({
        title: t("queryResultTable.rowDeleted"),
        description: t("queryResultTable.rowDeletedSuccessfully"),
      });

      await loadTableData();
      refreshDatabases({ databaseName: database });
      
    } catch (error) {
      console.error('Error deleting row:', error);
      toast({
        title: t("queryResultTable.errorDeletingRow"),
        description: error instanceof Error ? error.message : t("queryResultTable.failedToDeleteRow"),
        variant: "destructive"
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleRowSelect = (rowIndex: number, checked: boolean) => {
    const newSelection = new Set(selectedRows);
    if (checked) {
      newSelection.add(rowIndex);
    } else {
      newSelection.delete(rowIndex);
    }
    setSelectedRows(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && tableData) {
      setSelectedRows(new Set(Array.from({ length: tableData.data.length }, (_, i) => i)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const formatCellValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">{t("queryResultTable.null")}</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const generateSQLQuery = () => {
    let query = `SELECT * FROM \`${table}\``;
    
    const conditions = [];
    
    if (debouncedSearchTerm) {
      if (tableData?.columns) {
        const concatColumns = tableData.columns.map(col => `COALESCE(\`${col.name}\`, '')`).join(', ');
        conditions.push(`CONCAT(${concatColumns}) LIKE '%${debouncedSearchTerm}%'`);
      }
    }
    
    Object.entries(debouncedColumnFilters).forEach(([columnName, filterValue]) => {
      if (filterValue) {
        conditions.push(`\`${columnName}\` LIKE '%${filterValue}%'`);
      }
    });
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset > 0) {
      query += ` OFFSET ${offset}`;
    }
    
    return query;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("queryResultTable.loadingTableData")}</p>
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
          <Button onClick={loadTableData} variant="outline">
            {t("queryResultTable.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = tableData ? Math.ceil(tableData.total / limit) : 1;
  const startRow = offset;
  const endRow = Math.min(offset + limit - 1, (tableData?.total || 0) - 1);
  const hasActiveFilters = Object.keys(debouncedColumnFilters).length > 0;
  const hasServerSearch = debouncedSearchTerm.length > 0;
  const hasAnyFilters = hasActiveFilters || hasServerSearch;

  return (
    <div className="h-full">
      <div className="p-6 space-y-6">
        {/* Query Information */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div>
                {t("queryResultTable.showingRecords", {
                  start: startRow,
                  end: endRow,
                  total: tableData?.total.toLocaleString() || 0,
                  filteredByServer: hasAnyFilters ? t("queryResultTable.filteredByServer") : "",
                  time: queryTime
                })}
              </div>
              <div className="font-mono text-xs bg-muted p-2 rounded">
                {generateSQLQuery()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Browse Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("queryResultTable.browseData")}</CardTitle>
                <CardDescription>
                  {tableData ? t("queryResultTable.totalRows", { total: tableData.total.toLocaleString() }) : t("queryResultTable.noData")}
                  {hasAnyFilters && ` • ${t("queryResultTable.serverFiltered")}`}
                  {hasPrimaryKey && ` • ${t("queryResultTable.editableHasPk")}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadTableData}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t("queryResultTable.refresh")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}> {/* Open export dialog */}
                  <Download className="h-4 w-4 mr-2" />
                  {t("queryResultTable.export")}
                </Button>
                {hasPrivilege("INSERT") && (
                  <Button size="sm" onClick={() => setIsInsertRowDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("queryResultTable.insertRow")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <Input 
                    placeholder={t("queryResultTable.searchInDatabase")}
                    className="pl-10 pr-10"
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                  />
                </div>
                {hasAnyFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-2" />
                    {t("queryResultTable.clearAll")}
                  </Button>
                )}
                <Select value={limit.toString()} onValueChange={handleLimitChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 {t("queryResultTable.rows")}</SelectItem>
                    <SelectItem value="25">25 {t("queryResultTable.rows")}</SelectItem>
                    <SelectItem value="50">50 {t("queryResultTable.rows")}</SelectItem>
                    <SelectItem value="100">100 {t("queryResultTable.rows")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Status */}
              {(isSearching || hasAnyFilters) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isSearching && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{t("queryResultTable.searching")}</span>
                    </div>
                  )}
                  {hasServerSearch && !isSearching && (
                    <Badge variant="secondary">{t("queryResultTable.global")}: "{debouncedSearchTerm}"</Badge>
                  )}
                  {hasActiveFilters && (
                    <Badge variant="outline">
                      {Object.keys(debouncedColumnFilters).length} {t("queryResultTable.columnFilters")}
                    </Badge>
                  )}
                </div>
              )}

              {tableData && tableData.data.length > 0 ? (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            {/* Actions column - only show if table has PK and user has privileges */}
                            {hasPrimaryKey && (hasPrivilege("UPDATE") || hasPrivilege("INSERT") || hasPrivilege("DELETE")) && (
                              <th className="p-2 text-left w-24">
                                <span className="text-sm font-medium">{t("queryResultTable.actions")}</span>
                              </th>
                            )}
                            {/* Checkbox column - only show if table has PK */}
                            {hasPrimaryKey && (
                              <th className="p-2 text-left w-12">
                                <Checkbox 
                                  checked={selectedRows.size === tableData.data.length && tableData.data.length > 0}
                                  onCheckedChange={handleSelectAll}
                                />
                              </th>
                            )}
                            {tableData.columns.map((column) => (
                              <th key={column.name} className="p-2 text-left min-w-[150px]">
                                <div className="flex flex-col space-y-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{column.name}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                      {column.type}
                                      {column.key === 'PRI' && ` (${t("queryResultTable.pk")})`}
                                      {!column.null && ` ${t("queryResultTable.notNull")}`}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Input
                                      placeholder={t("queryResultTable.filter")}
                                      className="h-7 text-xs"
                                      value={columnFilters[column.name] || ''}
                                      onChange={(e) => handleColumnFilter(column.name, e.target.value)}
                                    />
                                    {columnFilters[column.name] && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
                                        onClick={() => clearColumnFilter(column.name)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t hover:bg-muted/50">
                              {/* Actions column - only show if table has PK and user has privileges */}
                              {hasPrimaryKey && (hasPrivilege("UPDATE") || hasPrivilege("INSERT") || hasPrivilege("DELETE")) && (
                                <td className="p-2">
                                  <div className="flex gap-1">
                                    {hasPrivilege("UPDATE") && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0"
                                        title={t("queryResultTable.editRowAction")}
                                        onClick={() => handleEditRow(rowIndex)}
                                      >
                                        <Edit className="h-3 w-3 text-blue-600" />
                                      </Button>
                                    )}
                                    {hasPrivilege("INSERT") && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0"
                                        title={t("queryResultTable.copyRow")}
                                        onClick={() => handleCopyRow(rowIndex)}
                                      >
                                        <Copy className="h-3 w-3 text-green-600" />
                                      </Button>
                                    )}
                                    {hasPrivilege("DELETE") && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0"
                                        title={t("queryResultTable.deleteRowAction")}
                                        onClick={() => handleDeleteRow(rowIndex)}
                                      >
                                        <Trash2 className="h-3 w-3 text-red-600" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              )}
                              {/* Checkbox column - only show if table has PK */}
                              {hasPrimaryKey && (
                                <td className="p-2">
                                  <Checkbox 
                                    checked={selectedRows.has(rowIndex)}
                                    onCheckedChange={(checked) => handleRowSelect(rowIndex, checked as boolean)}
                                  />
                                </td>
                              )}
                              {tableData.columns.map((column) => (
                                <td 
                                  key={column.name} 
                                  className="p-2 max-w-xs cursor-pointer"
                                  onDoubleClick={() => handleCellDoubleClick(rowIndex, column.name, row[column.name])}
                                  title={hasPrimaryKey && hasPrivilege("UPDATE") ? t("queryResultTable.doubleClickToEdit") : undefined}
                                >
                                  {editingCell?.rowIndex === rowIndex && editingCell?.columnName === column.name ? (
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleCellEditKeyDown}
                                      onBlur={handleCellEditCancel}
                                      className="h-6 text-xs p-1"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="truncate" title={String(row[column.name])}>
                                      {formatCellValue(row[column.name])}
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {t("queryResultTable.showingEntries", {
                        start: startRow + 1,
                        end: endRow + 1,
                        filteredLength: tableData.total.toLocaleString()
                      })}
                      {hasAnyFilters && ` (${t("queryResultTable.serverFiltered")})`}
                      {selectedRows.size > 0 && ` • ${selectedRows.size} ${t("queryResultTable.selected")}`}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handlePrevPage}
                        disabled={offset === 0}
                      >
                        {t("queryResultTable.previous")}
                      </Button>
                      <span className="flex items-center px-3">
                        {t("queryResultTable.page")} {currentPage} {t("queryResultTable.of")} {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNextPage}
                        disabled={offset + limit >= tableData.total}
                      >
                        {t("queryResultTable.next")}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {hasAnyFilters ? t("queryResultTable.noDataFound") : t("queryResultTable.noDataInTable")}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Row Edit Dialog */}
        {editingRow && tableData && (
          <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("queryResultTable.editRow")}</DialogTitle>
                <DialogDescription>
                  {t("queryResultTable.editRowDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {tableData.columns.map((column) => (
                  <div key={column.name} className="grid grid-cols-12 items-center gap-4">
                    <label className="col-span-4 text-right font-medium text-sm break-words">
                      <div className="flex flex-col items-end">
                        <span className="font-medium">{column.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {column.type}
                          {column.key === 'PRI' && ` (${t("queryResultTable.pk")})`}
                          {!column.null && ` ${t("queryResultTable.notNull")}`}
                        </span>
                      </div>
                    </label>
                    <div className="col-span-8">
                      <Input
                        value={editingRow.data[column.name] || ''}
                        onChange={(e) => setEditingRow({
                          ...editingRow,
                          data: { ...editingRow.data, [column.name]: e.target.value }
                        })}
                        disabled={column.key === 'PRI'}
                        placeholder={column.null ? t("queryResultTable.null") : t("queryResultTable.required")}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleRowEditCancel}>
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("queryResultTable.cancel")}
                </Button>
                <Button onClick={handleRowEditSave}>
                  <Save className="h-4 w-4 mr-2" />
                  {t("queryResultTable.saveChanges")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("queryResultTable.confirmDelete")}</DialogTitle>
                <DialogDescription>
                  {t("queryResultTable.confirmDeleteDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  {t("queryResultTable.cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDeleteRow}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("queryResultTable.deleteRow")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Insert Row Dialog */}
        {isInsertRowDialogOpen && tableData && (
          <InsertRowDialog
            open={isInsertRowDialogOpen}
            onOpenChange={setIsInsertRowDialogOpen}
            database={database}
            table={table}
            columns={tableData.columns}
            onRowInserted={() => {
              loadTableData();
              refreshDatabases({ databaseName: database });
            }}
          />
        )}

        {/* Export Data Dialog */}
        {isExportDialogOpen && tableData && (
          <ExportDataDialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            database={database}
            table={table}
            columns={tableData.columns}
            dataToExport={tableData.data} // Pass the currently loaded data for export
          />
        )}
      </div>
    </div>
  );
};

export default DatabaseBrowser;