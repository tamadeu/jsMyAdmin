import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Database, Table, Search, Filter, RotateCcw, Download, Plus, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiService, TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const DatabaseBrowser = () => {
  const { database, table } = useParams();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (database && table) {
      loadTableData();
      loadTableInfo();
    }
  }, [database, table, limit, offset, searchTerm]);

  const loadTableData = async () => {
    if (!database || !table) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiService.getTableData(database, table, {
        limit,
        offset,
        search: searchTerm
      });

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

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setOffset(0); // Reset to first page when searching
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
  const startRow = offset + 1;
  const endRow = Math.min(offset + limit, tableData?.total || 0);

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Table: {table}</h1>
            <div className="text-sm text-muted-foreground">
              Databases / {database} / {table}
            </div>
          </div>
        </div>

        {/* Table Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Engine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{tableInfo?.engine || 'Unknown'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{tableData?.total.toLocaleString() || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{tableInfo?.size || '0 MB'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Collation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">{tableInfo?.collation || 'Unknown'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Columns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{tableData?.columns.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Browse Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Browse Data</CardTitle>
                <CardDescription>
                  {tableData ? `${tableData.total.toLocaleString()} total rows` : 'No data'}
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
                  <Input 
                    placeholder="Search in table..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
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
                              <th key={column.name} className="p-3 text-left">
                                <div className="flex flex-col">
                                  <span className="font-medium">{column.name}</span>
                                  <span className="text-xs text-muted-foreground font-normal">
                                    {column.type}
                                    {column.key === 'PRI' && ' (PK)'}
                                    {!column.null && ' NOT NULL'}
                                  </span>
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
                      Showing {startRow} to {endRow} of {tableData.total.toLocaleString()} entries
                      {searchTerm && ` (filtered)`}
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
                    {searchTerm ? 'No data found matching your search' : 'No data in this table'}
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