"use client";

import React from 'react';
import { QueryResult } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Table as TableIcon } from "lucide-react";

interface QueryResultTableProps {
  queryResult: QueryResult;
}

const QueryResultTable = ({ queryResult }: QueryResultTableProps) => {
  if (!queryResult.success) {
    return (
      <div className="space-y-2 text-red-500 p-6">
        <AlertCircle className="h-5 w-5 inline-block mr-2" />
        <span className="font-medium">Error:</span> {queryResult.error}
      </div>
    );
  }

  if (!queryResult.data || queryResult.data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 p-6">
        <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p>No data returned for this query.</p>
        {queryResult.affectedRows !== undefined && (
          <p className="text-sm mt-2">{queryResult.affectedRows} rows affected.</p>
        )}
      </div>
    );
  }

  const formatCellValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-green-600">
        Query executed successfully in {queryResult.executionTime}
      </div>
      <div className="text-sm text-muted-foreground">
        {queryResult.rowCount} rows returned
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted">
              <TableRow>
                {queryResult.fields?.map((field) => (
                  <TableHead key={field.name} className="p-2 text-left font-medium text-sm min-w-[150px]">
                    {field.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {queryResult.data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="border-t hover:bg-muted/50">
                  {queryResult.fields?.map((field) => (
                    <TableCell key={field.name} className="p-2 min-w-[150px]" title={String(row[field.name])}>
                      <div className="truncate">
                        {formatCellValue(row[field.name])}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default QueryResultTable;