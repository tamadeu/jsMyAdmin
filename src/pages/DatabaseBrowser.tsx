import { useState, useEffect, useMemo, useCallback } from "react";
import { Database, Table, Search, Filter, RotateCcw, Download, Plus, Edit, Trash2, Loader2, AlertCircle, X, Copy, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiService, TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

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
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const [searchInput, setSearchInput] = useState(""); // Input value (immediate)
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
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set()); // Corrigido aqui
  const [deleteConfirm, setDeleteConfirm] = useState<{rowIndex: number, primaryKey: any} | null>(null);

  // Debounce the search input (wait 500ms after user stops typing)
  const debouncedSearchTerm = useDebounce(searchInput, 500);
  
  // Debounce column filters (wait 500ms after user stops typing)
  const debouncedColumnFilters = useDebounceObject(columnFilters, 500);

  // Check if table has primary key and get PK column
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
      // Show loading only for initial load, not for search
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
      setSelectedRows(new Set()); // Clear selection when data changes
    } catch (error) {
      console.error('Error loading table data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load table data');
      toast({
        title: "Error loading table data",
        description: "Failed to fetch table data from the database",
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
    setOffset(0); // Reset to first page when searching
  };

  const handleColumnFilter = (columnName: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnName]: value
    }));
    setOffset(0); // Reset to first page when filtering
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
    setOffset(0); // Reset to first page when changing limit
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

  // Get primary key value for a row
  const getPrimaryKeyValue = (row: any) => {
    if (!primaryKeyColumn) return null;
    return row[primaryKeyColumn.name];
  };

  // Inline cell editing
  const handleCellDoubleClick = (rowIndex: number, columnName: string, currentValue: any) => {
    if (!hasPrimaryKey || !hasPrivilege("UPDATE")) return; // Only allow editing if table has PK
    
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
        title: "Cell updated",
        description: "The cell has been updated successfully",
      });

      // Refresh data to show changes
      await loadTableData();
      
    } catch (error) {
      console.error('Error updating cell:', error);
      toast({
        title: "Error updating cell",
        description: error instanceof Error ? error.message : "Failed to update cell",
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

  // Row editing
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
        title: "Row updated",
        description: "The row has been updated successfully",
      });

      // Refresh data to show changes
      await loadTableData();
      
    } catch (error) {
      console.error('Error updating row:', error);
      toast({
        title: "Error updating row",
        description: error instanceof Error ? error.message : "Failed to update row",
        variant: "destructive"
      });
    } finally {
      setEditingRow(null);
    }
  };

  const handleRowEditCancel = () => {
    setEditingRow(null);
  };

  // Copy row
  const handleCopyRow = async (rowIndex: number) => {
    if (!tableData || !database || !table) return;

    try {
      const row = tableData.data[rowIndex];
      const copyData = { ...row };
      
      // Remove primary key if it's auto increment
      if (primaryKeyColumn && primaryKeyColumn.extra.includes('auto_increment')) {
        delete copyData[primaryKeyColumn.name];
      }

      await apiService.insertRow(database, table, copyData);
      
      toast({
        title: "Row copied",
        description: "The row has been copied successfully",
      });

      // Refresh data to show new row
      await loadTableData();
      
    } catch (error) {
      console.error('Error copying row:', error);
      toast({
        title: "Error copying row",
        description: error instanceof Error ? error.message : "Failed to copy row",
        variant: "destructive"
      });
    }
  };

  // Delete row
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
        title: "Row deleted",
        description: "The row has been deleted successfully",
      });

      // Refresh data to show changes
      await loadTableData();
      
    } catch (error) {
      console.error('Error deleting row:', error);
      toast({
        title: "Error deleting row",
        description: error instanceof Error ? error.message : "Failed to delete row",
        variant: "destructive"
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Row selection
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
    if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Generate actual SQL query that was executed
  const generateSQLQuery = () => {
    let query = `SELECT * FROM \`${table}\``;
    
    const conditions = [];
    
    // Add search condition
    if (debouncedSearchTerm) {
      if (tableData?.columns) {
        const concatColumns = tableData.columns.map(col => `COALESCE(\`${col.name}\`, '')`).join(', ');
        conditions.push(`CONCAT(${concatColumns}) LIKE '%${debouncedSearchTerm}%'`);
      }
    }
    
    // Add column filters
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
          <p className="text-muted-foreground">Loading table data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">Failed to load table data</p>
          <Button onClick={loadTableData} variant="outline">
            Retry
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
    <div className="h-full"> {/* Removed overflow-y-auto */}
      <div className="p-6 space-y-6">
        {/* Query Information */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div>
                Mostrando registros {startRow} - {endRow} ({tableData?.total.toLocaleString() || 0} no total,{' '}
                {hasAnyFilters && 'filtrado pelo servidor, '}
                Consulta levou {queryTime} segundos.)
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
                <CardTitle>Browse Data</CardTitle>
                <CardDescription>
                  {tableData ? `${tableData.total.toLocaleString()} total rows` : 'No data'}
                  {hasAnyFilters && ` • Server filtered`}
                  {hasPrimaryKey && ` • Editable (has PK)`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadTableData}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {hasPrivilege("INSERT") && (
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Insert Row
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
                    placeholder="Search in database..." 
                    className="pl-10 pr-10"
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                  />
                </div>
                {hasAnyFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                )}
                <Select value={limit.toString()} onValueChange={handleLimitChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="25">25 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Status */}
              {(isSearching || hasAnyFilters) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isSearching && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}
                  {hasServerSearch && !isSearching && (
                    <Badge variant="secondary">Global: "{debouncedSearchTerm}"</Badge>
                  )}
                  {hasActiveFilters && (
                    <Badge variant="outline">
                      {Object.keys(debouncedColumnFilters).length} column filters
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
                                <span className="text-sm font-medium">Actions</span>
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
                                      {column.key === 'PRI' && ' (PK)'}
                                      {!column.null && ' NOT NULL'}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Input
                                      placeholder="Filter..."
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
                                        title="Edit Row"
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
                                        title="Copy Row"
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
                                        title="Delete Row"
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
                                  title={hasPrimaryKey && hasPrivilege("UPDATE") ? "Double-click to edit" : undefined}
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
                      Showing {startRow + 1} to {endRow + 1} of {tableData.total.toLocaleString()} entries
                      {hasAnyFilters && ` (server filtered)`}
                      {selectedRows.size > 0 && ` • ${selectedRows.size} selected`}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handlePrevPage}
                        disabled={offset === 0}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNextPage}
                        disabled={offset + limit >= tableData.total}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {hasAnyFilters ? 'No data found matching your filters' : 'No data in this table'}
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
                <DialogTitle>Edit Row</DialogTitle>
                <DialogDescription>
                  Make changes to the row data. Click save when you're done.
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
                          {column.key === 'PRI' && ' (PK)'}
                          {!column.null && ' NOT NULL'}
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
                        disabled={column.key === 'PRI'} // Disable PK editing
                        placeholder={column.null ? 'NULL' : 'Required'}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleRowEditCancel}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleRowEditSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
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
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this row? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteRow}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Row
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default DatabaseBrowser;