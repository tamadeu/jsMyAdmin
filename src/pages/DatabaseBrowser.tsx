import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Database, Table, Search, Filter, RotateCcw, Download, Plus, Edit, Trash2, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiService, TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

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

const DatabaseBrowser = () => {
  const { database, table } = useParams();
  const { toast } = useToast();
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

  // Debounce the search input (wait 500ms after user stops typing)
  const debouncedSearchTerm = useDebounce(searchInput, 500);
  
  // Debounce column filters (wait 500ms after user stops typing)
  const debouncedColumnFilters = useDebounceObject(columnFilters, 500);

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
      const info = tables.find(t => t.name === table);
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

  const formatCellValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getColumnType = (type: string) => {
    if (type.includes('int')) return 'number';
    if (type.includes('varchar') || type.includes('text')) return 'text';
    if (type.includes('date') || type.includes('time')) return 'date';
    return 'text';
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
    <div className="overflow-y-auto h-full">
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
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Insert Row
                </Button>
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
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left">
                              <Checkbox />
                            </th>
                            {tableData.columns.map((column) => (
                              <th key={column.name} className="p-3 text-left min-w-[200px]">
                                <div className="flex flex-col space-y-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{column.name}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                      {column.type}
                                      {column.key === 'PRI' && ' (PK)'}
                                      {!column.null && ' NOT NULL'}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Input
                                      placeholder="Filter..."
                                      className="h-8 text-xs"
                                      value={columnFilters[column.name] || ''}
                                      onChange={(e) => handleColumnFilter(column.name, e.target.value)}
                                    />
                                    {columnFilters[column.name] && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                        onClick={() => clearColumnFilter(column.name)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </th>
                            ))}
                            <th className="p-3 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.data.map((row, index) => (
                            <tr key={index} className="border-t hover:bg-muted/50">
                              <td className="p-3">
                                <Checkbox />
                              </td>
                              {tableData.columns.map((column) => (
                                <td key={column.name} className="p-3 max-w-xs">
                                  <div className="truncate" title={String(row[column.name])}>
                                    {formatCellValue(row[column.name])}
                                  </div>
                                </td>
                              ))}
                              <td className="p-3">
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                  </Button>
                                </div>
                              </td>
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
      </div>
    </div>
  );
};

export default DatabaseBrowser;