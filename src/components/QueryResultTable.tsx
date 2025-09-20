"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QueryResult, apiService } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Table as TableIcon, Search, Filter, RotateCcw, Download, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

interface QueryResultTableProps {
  queryResult: QueryResult; // This might only contain originalQuery if loaded from localStorage
  database?: string; // Optional database context for re-executing query
}

const QueryResultTable = ({ queryResult: initialQueryResult, database }: QueryResultTableProps) => {
  const { toast } = useToast();
  const [currentQueryResult, setCurrentQueryResult] = useState<QueryResult>(initialQueryResult);
  const [searchInput, setSearchInput] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false); // For re-executing query
  const [isSearching, setIsSearching] = useState(false); // For client-side filtering
  const [isQueryExpanded, setIsQueryExpanded] = useState(false); // State for query expansion

  // Debounce the search input and column filters
  const debouncedSearchTerm = useDebounce(searchInput, 300);
  const debouncedColumnFilters = useDebounceObject(columnFilters, 300);

  // Function to re-execute the query
  const reExecuteQuery = useCallback(async (query: string) => {
    if (!query) return;
    setIsLoadingData(true);
    try {
      const result = await apiService.executeQuery(query, database);
      setCurrentQueryResult(result);
      if (!result.success) {
        toast({
          title: "Query re-execution failed",
          description: result.error || "An error occurred while re-executing the query.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error re-executing query:', error);
      toast({
        title: "Query re-execution failed",
        description: error instanceof Error ? error.message : "Failed to re-execute SQL query",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [database, toast]);

  // Effect to load data if only originalQuery is present (e.g., from localStorage)
  useEffect(() => {
    if (initialQueryResult.originalQuery && !initialQueryResult.data) {
      reExecuteQuery(initialQueryResult.originalQuery);
    } else {
      setCurrentQueryResult(initialQueryResult); // Use the provided full result
    }
    setOffset(0);
    setSearchInput("");
    setColumnFilters({});
    setIsQueryExpanded(false); // Reset expansion state
  }, [initialQueryResult, reExecuteQuery]);

  // Client-side filtering and searching
  const filteredData = useMemo(() => {
    if (!currentQueryResult.data) return [];

    let data = currentQueryResult.data;

    // Global search
    if (debouncedSearchTerm) {
      const searchTermLower = debouncedSearchTerm.toLowerCase();
      data = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTermLower)
        )
      );
    }

    // Column-specific filters
    Object.entries(debouncedColumnFilters).forEach(([columnName, filterValue]) => {
      if (filterValue) {
        const filterValueLower = filterValue.toLowerCase();
        data = data.filter(row =>
          String(row[columnName] || '').toLowerCase().includes(filterValueLower)
        );
      }
    });

    return data;
  }, [currentQueryResult.data, debouncedSearchTerm, debouncedColumnFilters]);

  // Client-side pagination
  const paginatedData = useMemo(() => {
    return filteredData.slice(offset, offset + limit);
  }, [filteredData, offset, limit]);

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
    if (offset + limit < filteredData.length) {
      setOffset(offset + limit);
    }
  };

  const formatCellValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const toggleQueryExpansion = () => {
    setIsQueryExpanded(prev => !prev);
  };

  const displayedQuery = useMemo(() => {
    const query = currentQueryResult.originalQuery || '';
    const maxLength = 300; // Max length before truncating
    if (isQueryExpanded || query.length <= maxLength) {
      return query;
    }
    return query.substring(0, maxLength) + '...';
  }, [currentQueryResult.originalQuery, isQueryExpanded]);

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading query results...</p>
        </div>
      </div>
    );
  }

  if (!currentQueryResult.success) {
    return (
      <div className="space-y-2 text-red-500 p-6">
        <AlertCircle className="h-5 w-5 inline-block mr-2" />
        <span className="font-medium">Error:</span> {currentQueryResult.error}
        {currentQueryResult.originalQuery && (
          <div className="font-mono text-xs bg-muted p-2 rounded mt-2">
            {displayedQuery}
            {currentQueryResult.originalQuery.length > 300 && (
              <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                {isQueryExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> Ver Menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> Ver Mais
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!currentQueryResult.data || currentQueryResult.data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 p-6">
        <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p>No data returned for this query.</p>
        {currentQueryResult.affectedRows !== undefined && (
          <p className="text-sm mt-2">{currentQueryResult.affectedRows} rows affected.</p>
        )}
        {currentQueryResult.originalQuery && (
          <div className="font-mono text-xs bg-muted p-2 rounded mt-2">
            {displayedQuery}
            {currentQueryResult.originalQuery.length > 300 && (
              <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                {isQueryExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> Ver Menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> Ver Mais
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(filteredData.length / limit);
  const startRow = offset;
  const endRow = Math.min(offset + limit - 1, filteredData.length - 1);
  const hasActiveFilters = Object.keys(debouncedColumnFilters).length > 0;
  const hasClientSearch = debouncedSearchTerm.length > 0;
  const hasAnyFilters = hasActiveFilters || hasClientSearch;

  return (
    <div className="h-full">
      <div className="p-6 space-y-6">
        {/* Query Information */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div>
                Mostrando registros {startRow + 1} - {endRow + 1} ({currentQueryResult.rowCount?.toLocaleString() || 0} no total,{' '}
                {hasAnyFilters && `filtrado no cliente (${filteredData.length.toLocaleString()} resultados), `}
                Consulta levou {(currentQueryResult.executionTime / 1000).toFixed(4)} segundos.)
              </div>
              {currentQueryResult.originalQuery && (
                <div className="font-mono text-xs bg-muted p-2 rounded">
                  {displayedQuery}
                  {currentQueryResult.originalQuery.length > 300 && (
                    <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                      {isQueryExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" /> Ver Menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" /> Ver Mais
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
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
                  {currentQueryResult.rowCount?.toLocaleString() || 0} total rows
                  {hasAnyFilters && ` • Client filtered`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => currentQueryResult.originalQuery ? reExecuteQuery(currentQueryResult.originalQuery) : setCurrentQueryResult(initialQueryResult)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
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
                    placeholder="Search in results..." 
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
                  {hasClientSearch && !isSearching && (
                    <Badge variant="secondary">Global: "{debouncedSearchTerm}"</Badge>
                  )}
                  {hasActiveFilters && (
                    <Badge variant="outline">
                      {Object.keys(debouncedColumnFilters).length} column filters
                    </Badge>
                  )}
                </div>
              )}

              {paginatedData.length > 0 ? (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="text-xs">
                        <thead className="bg-muted">
                          <tr>
                            {currentQueryResult.fields?.map((column) => (
                              <th key={column.name} className="p-2 text-left min-w-[150px]">
                                <div className="flex flex-col space-y-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{column.name}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                      {column.type}
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
                          {paginatedData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t hover:bg-muted/50">
                              {currentQueryResult.fields?.map((column) => (
                                <td 
                                  key={column.name} 
                                  className="p-2 min-w-[150px]"
                                  title={String(row[column.name])}
                                >
                                  <div className="truncate">
                                    {formatCellValue(row[column.name])}
                                  </div>
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
                      Mostrando {startRow + 1} a {endRow + 1} de {filteredData.length.toLocaleString()} entradas
                      {hasAnyFilters && ` (filtrado no cliente)`}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handlePrevPage}
                        disabled={offset === 0}
                      >
                        Anterior
                      </Button>
                      <span className="flex items-center px-3">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNextPage}
                        disabled={offset + limit >= filteredData.length}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {hasAnyFilters ? 'Nenhum dado encontrado correspondente aos seus filtros' : 'Nenhum dado neste resultado de query'}
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

export default QueryResultTable;