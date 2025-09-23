"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QueryResult, apiService } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Table as TableIcon, Search, Filter, RotateCcw, Download, X, Loader2, ChevronDown, ChevronUp, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTabs } from "@/context/TabContext";
import { format } from "sql-formatter";
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

interface QueryResultTableProps {
  queryResult: QueryResult;
  database?: string;
}

const QueryResultTable = ({ queryResult: initialQueryResult, database }: QueryResultTableProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { addTab, removeTab, activeTabId } = useTabs();
  const [currentQueryResult, setCurrentQueryResult] = useState<QueryResult>(initialQueryResult);
  const [searchInput, setSearchInput] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isQueryExpanded, setIsQueryExpanded] = useState(false);

  const debouncedSearchTerm = useDebounce(searchInput, 300);
  const debouncedColumnFilters = useDebounceObject(columnFilters, 300);

  const reExecuteQuery = useCallback(async (query: string) => {
    if (!query) return;
    setIsLoadingData(true);
    try {
      const result = await apiService.executeQuery(query, database);
      setCurrentQueryResult(result);
      if (!result.success) {
        toast({
          title: t("sqlEditor.queryReExecutionFailed"),
          description: result.error || t("sqlEditor.queryExecutionError"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error re-executing query:', error);
      toast({
        title: t("sqlEditor.queryReExecutionFailed"),
        description: error instanceof Error ? error.message : t("sqlEditor.failedToExecuteSqlQuery"),
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [database, toast, t]);

  useEffect(() => {
    if (initialQueryResult.originalQuery && !initialQueryResult.data) {
      reExecuteQuery(initialQueryResult.originalQuery);
    } else {
      setCurrentQueryResult(initialQueryResult);
    }
    setOffset(0);
    setSearchInput("");
    setColumnFilters({});
    setIsQueryExpanded(false);
  }, [initialQueryResult, reExecuteQuery]);

  const filteredData = useMemo(() => {
    if (!currentQueryResult.data) return [];

    let data = currentQueryResult.data;

    if (debouncedSearchTerm) {
      const searchTermLower = debouncedSearchTerm.toLowerCase();
      data = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTermLower)
        )
      );
    }

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
    if (value === null) return <span className="text-muted-foreground italic">{t("queryResultTable.null")}</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const toggleQueryExpansion = () => {
    setIsQueryExpanded(prev => !prev);
  };

  const displayedQuery = useMemo(() => {
    const query = currentQueryResult.originalQuery || '';
    const maxLength = 300;
    if (isQueryExpanded || query.length <= maxLength) {
      return query;
    }
    return query.substring(0, maxLength) + '...';
  }, [currentQueryResult.originalQuery, isQueryExpanded]);

  const handleEditQuery = useCallback(() => {
    if (currentQueryResult.originalQuery) {
      try {
        const formattedQuery = format(currentQueryResult.originalQuery, {
          language: 'mysql',
          indent: '  ',
          linesBetweenQueries: 2,
        });
        addTab({
          title: t("header.sqlEditorTitle"),
          type: "sql-editor",
          closable: true,
          sqlQueryContent: formattedQuery,
        });
        removeTab(activeTabId);
      } catch (error) {
        console.error('Error formatting query for editor:', error);
        toast({
          title: t("sqlEditor.openingEditorFailed"),
          description: t("sqlEditor.failedToFormatForEditor"),
          variant: "destructive"
        });
        addTab({
          title: t("header.sqlEditorTitle"),
          type: "sql-editor",
          closable: true,
          sqlQueryContent: currentQueryResult.originalQuery,
        });
        removeTab(activeTabId);
      }
    }
  }, [currentQueryResult.originalQuery, addTab, removeTab, activeTabId, toast, t]);

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("sqlEditor.loadingQueryResults")}</p>
        </div>
      </div>
    );
  }

  if (!currentQueryResult.success) {
    return (
      <div className="space-y-2 text-red-500 p-6">
        <AlertCircle className="h-5 w-5 inline-block mr-2" />
        <span className="font-medium">{t("sqlEditor.error")}:</span> {currentQueryResult.error}
        {currentQueryResult.originalQuery && (
          <div className="font-mono text-xs bg-muted p-2 rounded mt-2">
            {displayedQuery}
            {currentQueryResult.originalQuery.length > 300 && (
              <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                {isQueryExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> {t("sqlEditor.viewLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> {t("sqlEditor.viewMore")}
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEditQuery} className="ml-2">
              <Edit className="h-4 w-4 mr-2" />
              {t("sqlEditor.editQuery")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!currentQueryResult.data || currentQueryResult.data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 p-6">
        <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p>{t("queryResultTable.noDataReturned")}</p>
        {currentQueryResult.affectedRows !== undefined && (
          <p className="text-sm mt-2">{currentQueryResult.affectedRows} {t("queryResultTable.rowsAffected")}.</p>
        )}
        {currentQueryResult.originalQuery && (
          <div className="font-mono text-xs bg-muted p-2 rounded mt-2">
            {displayedQuery}
            {currentQueryResult.originalQuery.length > 300 && (
              <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                {isQueryExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> {t("sqlEditor.viewLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> {t("sqlEditor.viewMore")}
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEditQuery} className="ml-2">
              <Edit className="h-4 w-4 mr-2" />
              {t("sqlEditor.editQuery")}
            </Button>
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
                {t("queryResultTable.showingRecords", {
                  start: startRow + 1,
                  end: endRow + 1,
                  total: currentQueryResult.rowCount?.toLocaleString() || 0,
                  filteredByServer: hasAnyFilters ? t("queryResultTable.clientFiltered", { filteredLength: filteredData.length.toLocaleString() }) + ", " : "",
                  time: (currentQueryResult.executionTime / 1000).toFixed(4)
                })}
              </div>
              {currentQueryResult.originalQuery && (
                <div className="font-mono text-xs bg-muted p-2 rounded flex items-center justify-between">
                  <div>
                    {displayedQuery}
                    {currentQueryResult.originalQuery.length > 300 && (
                      <Button variant="link" size="sm" onClick={toggleQueryExpansion} className="h-auto p-0 ml-2 text-xs">
                        {isQueryExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" /> {t("sqlEditor.viewLess")}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" /> {t("sqlEditor.viewMore")}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleEditQuery} className="ml-2">
                    <Edit className="h-4 w-4 mr-2" />
                    {t("sqlEditor.editQuery")}
                  </Button>
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
                <CardTitle>{t("queryResultTable.browseData")}</CardTitle>
                <CardDescription>
                  {currentQueryResult.rowCount?.toLocaleString() || 0} {t("queryResultTable.totalRows")}
                  {hasAnyFilters && ` • ${t("queryResultTable.clientFiltered")}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => currentQueryResult.originalQuery ? reExecuteQuery(currentQueryResult.originalQuery) : setCurrentQueryResult(initialQueryResult)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t("queryResultTable.refresh")}
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {t("queryResultTable.export")}
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
                    placeholder={t("queryResultTable.searchInResults")}
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
                  {hasClientSearch && !isSearching && (
                    <Badge variant="secondary">{t("queryResultTable.global")}: "{debouncedSearchTerm}"</Badge>
                  )}
                  {hasActiveFilters && (
                    <Badge variant="outline">
                      {Object.keys(debouncedColumnFilters).length} {t("queryResultTable.columnFilters")}
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
                      {t("queryResultTable.showingEntries", {
                        start: startRow + 1,
                        end: endRow + 1,
                        filteredLength: filteredData.length.toLocaleString()
                      })}
                      {hasAnyFilters && ` (${t("queryResultTable.clientFiltered")})`}
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
                        disabled={offset + limit >= filteredData.length}
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
      </div>
    </div>
  );
};

export default QueryResultTable;