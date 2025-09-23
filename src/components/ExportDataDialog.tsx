"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Loader2, XCircle, Table as TableIcon } from "lucide-react";
import { TableData, apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  table: string;
  columns: TableData['columns']; // Columns from current table data
  tableEngine: string; // From table info
  tableCollation: string; // From table info
  currentSearchTerm: string; // Current search term from DatabaseBrowser
  currentColumnFilters: Record<string, string>; // Current column filters from DatabaseBrowser
  totalRowsAvailable: number; // Total rows in the table (unfiltered)
}

type ExportFormat = 'csv' | 'json' | 'sql';
type ExportRowsOption = 'all' | 'custom';

const ExportDataDialog = ({
  open,
  onOpenChange,
  database,
  table,
  columns,
  tableEngine,
  tableCollation,
  currentSearchTerm,
  currentColumnFilters,
  totalRowsAvailable,
}: ExportDataDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDataForExport, setIsFetchingDataForExport] = useState(false);

  // SQL specific options
  const [includeDropTable, setIncludeDropTable] = useState(false);
  const [includeCreateTable, setIncludeCreateTable] = useState(false);
  const [includeAutoIncrement, setIncludeAutoIncrement] = useState(true);

  // Rows options
  const [exportRowsOption, setExportRowsOption] = useState<ExportRowsOption>('all');
  const [customRowsLimit, setCustomRowsLimit] = useState(totalRowsAvailable);
  const [customRowsOffset, setCustomRowsOffset] = useState(0);

  // Data fetched specifically for export
  const [exportData, setExportData] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      // Reset options to defaults when dialog opens
      setExportFormat('csv');
      setIncludeDropTable(false);
      setIncludeCreateTable(false);
      setIncludeAutoIncrement(true);
      setExportRowsOption('all');
      setCustomRowsLimit(totalRowsAvailable);
      setCustomRowsOffset(0);
      setExportData([]); // Clear previous data
    }
  }, [open, totalRowsAvailable]);

  const formatValueForCsv = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return String(value);
  };

  const generateCsv = useCallback(() => {
    if (!exportData || exportData.length === 0) return '';

    const headers = columns.map(col => formatValueForCsv(col.name)).join(',');
    const rows = exportData.map(row =>
      columns.map(col => formatValueForCsv(row[col.name])).join(',')
    );
    return [headers, ...rows].join('\n');
  }, [exportData, columns]);

  const generateJson = useCallback(() => {
    return JSON.stringify(exportData, null, 2);
  }, [exportData]);

  const generateSql = useCallback(() => {
    if (!exportData) return '';

    const statements: string[] = [];

    // Header comments and SET statements
    statements.push(`-- phpMyAdmin SQL Dump`);
    statements.push(`-- Time: ${new Date().toLocaleString()}`);
    statements.push(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";`);
    statements.push(`START TRANSACTION;`);
    statements.push(`SET time_zone = "+00:00";`);
    statements.push(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;`);
    statements.push(`/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;`);
    statements.push(`/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;`);
    statements.push(`/*!40101 SET NAMES utf8mb4 */;`);
    statements.push(``);

    // DROP TABLE statement
    if (includeDropTable) {
      statements.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      statements.push(``);
    }

    // CREATE TABLE statement
    if (includeCreateTable) {
      const columnDefinitions = columns.map(col => {
        let definition = `\`${col.name}\` ${col.type}`;
        if (!col.null) {
          definition += ` NOT NULL`;
        }
        if (col.default !== null && col.default !== undefined) {
          if (typeof col.default === 'string' && !['CURRENT_TIMESTAMP'].includes(col.default.toUpperCase())) {
            definition += ` DEFAULT '${String(col.default).replace(/'/g, "''")}'`;
          } else {
            definition += ` DEFAULT ${col.default}`;
          }
        }
        if (col.extra.includes('auto_increment')) {
          definition += ` AUTO_INCREMENT`;
        }
        return definition;
      });

      const primaryKeyColumns = columns.filter(col => col.key === 'PRI').map(col => `\`${col.name}\``);
      if (primaryKeyColumns.length > 0) {
        columnDefinitions.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
      }

      statements.push(`CREATE TABLE \`${table}\` (`);
      statements.push(columnDefinitions.map(def => `  ${def}`).join(',\n'));
      statements.push(`) ENGINE=${tableEngine || 'InnoDB'} DEFAULT CHARSET=utf8mb4 COLLATE=${tableCollation || 'utf8mb4_unicode_ci'};`);
      statements.push(``);
    }

    // INSERT statements
    if (exportData.length > 0) {
      statements.push(`--`);
      statements.push(`-- Dumping data for table \`${table}\``);
      statements.push(`--`);
      statements.push(``);

      const insertColumnNames = columns
        .filter(col => !(col.extra.includes('auto_increment') && !includeAutoIncrement))
        .map(col => `\`${col.name}\``)
        .join(', ');

      const insertValues = exportData.map(row => {
        const rowValues = columns
          .filter(col => !(col.extra.includes('auto_increment') && !includeAutoIncrement))
          .map(col => {
            const rawValue = row[col.name];
            const columnType = col.type.toLowerCase().split('(')[0];

            if (rawValue === null) {
              return 'NULL';
            }

            if (columnType === 'json') {
              let jsonString;
              if (typeof rawValue === 'string') {
                try {
                  jsonString = JSON.stringify(JSON.parse(rawValue));
                } catch (e) {
                  jsonString = JSON.stringify(rawValue);
                }
              } else {
                jsonString = JSON.stringify(rawValue);
              }
              return `'${jsonString.replace(/'/g, "''")}'`;
            }

            if (['date', 'datetime', 'timestamp'].includes(columnType)) {
              try {
                const date = new Date(rawValue);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  const seconds = String(date.getSeconds()).padStart(2, '0');
                  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

                  let formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                  if (milliseconds !== '000') {
                    formattedDate += `.${milliseconds}`;
                  }
                  return `'${formattedDate}'`;
                }
              } catch (e) {
                console.warn(`Could not parse date for column ${col.name}: ${rawValue}`);
              }
            }

            if (['tinyint', 'boolean'].includes(columnType) && (typeof rawValue === 'boolean' || rawValue === 0 || rawValue === 1)) {
              return rawValue ? '1' : '0';
            }

            if (typeof rawValue === 'string') {
              return `'${rawValue.replace(/'/g, "''")}'`;
            }
            
            return String(rawValue);
          });
        return `(${rowValues.join(', ')})`;
      }).join(',\n');

      statements.push(`INSERT INTO \`${table}\` (${insertColumnNames}) VALUES`);
      statements.push(insertValues + ';');
      statements.push(``);
    }

    // AUTO_INCREMENT adjustment
    if (includeCreateTable && includeAutoIncrement) {
      const pkColumn = columns.find(col => col.key === 'PRI' && col.extra.includes('auto_increment'));
      if (pkColumn) {
        const maxId = exportData.reduce((max, row) => Math.max(max, row[pkColumn.name] || 0), 0);
        statements.push(`ALTER TABLE \`${table}\` MODIFY \`${pkColumn.name}\` ${pkColumn.type} NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=${maxId + 1};`);
        statements.push(``);
      }
    }

    statements.push(`COMMIT;`);
    statements.push(``);
    statements.push(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;`);
    statements.push(`/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;`);
    statements.push(`/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;`);

    return statements.join('\n');
  }, [exportData, columns, table, includeDropTable, includeCreateTable, includeAutoIncrement, tableEngine, tableCollation]);

  const fetchDataForExport = useCallback(async () => {
    setIsFetchingDataForExport(true);
    try {
      const limit = exportRowsOption === 'all' ? Number.MAX_SAFE_INTEGER : customRowsLimit;
      const offset = exportRowsOption === 'all' ? 0 : customRowsOffset;

      const data = await apiService.getTableData(database, table, {
        limit,
        offset,
        search: currentSearchTerm,
        columnFilters: currentColumnFilters,
      });
      setExportData(data.data);
    } catch (error) {
      console.error('Error fetching data for export:', error);
      toast({
        title: t("exportDataDialog.error"),
        description: t("exportDataDialog.failedToFetchDataForExport"),
        variant: "destructive",
      });
      setExportData([]);
    } finally {
      setIsFetchingDataForExport(false);
    }
  }, [database, table, exportRowsOption, customRowsLimit, customRowsOffset, currentSearchTerm, currentColumnFilters, toast, t]);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    await fetchDataForExport(); // Ensure data is fetched before proceeding

    if (exportData.length === 0 && totalRowsAvailable > 0) {
      // If data was supposed to be fetched but isn't, it means an error occurred or no data matched filters
      toast({
        title: t("exportDataDialog.noData"),
        description: t("exportDataDialog.noDataToExport"),
        variant: "default",
      });
      setIsLoading(false);
      return;
    }

    let content = '';
    let filename = `${database}_${table}`;
    let mimeType = '';

    switch (exportFormat) {
      case 'csv':
        content = generateCsv();
        filename += '.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = generateJson();
        filename += '.json';
        mimeType = 'application/json';
        break;
      case 'sql':
        content = generateSql();
        filename += '.sql';
        mimeType = 'application/sql';
        break;
      default:
        toast({
          title: t("exportDataDialog.error"),
          description: t("exportDataDialog.invalidFormat"),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    if (!content) {
      toast({
        title: t("exportDataDialog.noData"),
        description: t("exportDataDialog.noDataToExport"),
        variant: "default",
      });
      setIsLoading(false);
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t("exportDataDialog.exportSuccessful"),
      description: t("exportDataDialog.dataExportedSuccessfully", { format: exportFormat.toUpperCase() }),
    });
    setIsLoading(false);
    onOpenChange(false);
  }, [exportFormat, generateCsv, generateJson, generateSql, database, table, onOpenChange, toast, t, fetchDataForExport, exportData, totalRowsAvailable]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading && !isFetchingDataForExport) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> {t("exportDataDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("exportDataDialog.description", { table: table, database: database })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="export-format">{t("exportDataDialog.format")}</Label>
            <RadioGroup value={exportFormat} onValueChange={(value: ExportFormat) => setExportFormat(value)} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv">CSV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="format-json" />
                <Label htmlFor="format-json">JSON</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sql" id="format-sql" />
                <Label htmlFor="format-sql">SQL ({t("exportDataDialog.insertStatements")})</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Records Options */}
          <div className="space-y-2">
            <Label>{t("exportDataDialog.records")}</Label>
            <RadioGroup value={exportRowsOption} onValueChange={(value: ExportRowsOption) => setExportRowsOption(value)} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="rows-all" />
                <Label htmlFor="rows-all">{t("exportDataDialog.dumpAllRows")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="rows-custom" />
                <Label htmlFor="rows-custom">{t("exportDataDialog.dumpCustomRows")}</Label>
              </div>
            </RadioGroup>
            {exportRowsOption === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pl-6 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-limit">{t("exportDataDialog.numberOfRows")}</Label>
                  <Input
                    id="custom-limit"
                    type="number"
                    value={customRowsLimit}
                    onChange={(e) => setCustomRowsLimit(parseInt(e.target.value) || 0)}
                    min={0}
                    max={totalRowsAvailable}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-offset">{t("exportDataDialog.startAtRow")}</Label>
                  <Input
                    id="custom-offset"
                    type="number"
                    value={customRowsOffset}
                    onChange={(e) => setCustomRowsOffset(parseInt(e.target.value) || 0)}
                    min={0}
                    max={totalRowsAvailable > 0 ? totalRowsAvailable - 1 : 0}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SQL Specific Options */}
          {exportFormat === 'sql' && (
            <div className="space-y-2">
              <Label>{t("exportDataDialog.sqlOptions")}</Label>
              <div className="flex flex-col space-y-1 pl-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-drop-table"
                    checked={includeDropTable}
                    onCheckedChange={(checked: boolean) => setIncludeDropTable(checked)}
                  />
                  <Label htmlFor="include-drop-table">{t("exportDataDialog.addDropTable")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-create-table"
                    checked={includeCreateTable}
                    onCheckedChange={(checked: boolean) => setIncludeCreateTable(checked)}
                  />
                  <Label htmlFor="include-create-table">{t("exportDataDialog.addCreateTable")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-auto-increment"
                    checked={includeAutoIncrement}
                    onCheckedChange={(checked: boolean) => setIncludeAutoIncrement(checked)}
                    disabled={!includeCreateTable}
                  />
                  <Label htmlFor="include-auto-increment">{t("exportDataDialog.addAutoIncrement")}</Label>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isFetchingDataForExport}>
            <XCircle className="h-4 w-4 mr-2" />
            {t("exportDataDialog.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={isLoading || isFetchingDataForExport || totalRowsAvailable === 0}>
            {isLoading || isFetchingDataForExport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {isLoading || isFetchingDataForExport ? t("exportDataDialog.preparingExport") : t("exportDataDialog.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDataDialog;