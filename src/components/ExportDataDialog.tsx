"use client";

import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Loader2, XCircle } from "lucide-react";
import { TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  table: string;
  columns: TableData['columns'];
  dataToExport: any[];
}

type ExportFormat = 'csv' | 'json' | 'sql';

const ExportDataDialog = ({ open, onOpenChange, database, table, columns, dataToExport }: ExportDataDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isLoading, setIsLoading] = useState(false);

  const formatValueForCsv = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      // Escape double quotes and wrap in double quotes if it contains comma or double quotes
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return String(value);
  };

  const generateCsv = useCallback(() => {
    if (!dataToExport || dataToExport.length === 0) return '';

    const headers = columns.map(col => formatValueForCsv(col.name)).join(',');
    const rows = dataToExport.map(row =>
      columns.map(col => formatValueForCsv(row[col.name])).join(',')
    );
    return [headers, ...rows].join('\n');
  }, [dataToExport, columns]);

  const generateJson = useCallback(() => {
    return JSON.stringify(dataToExport, null, 2);
  }, [dataToExport]);

  const generateSql = useCallback(() => {
    if (!dataToExport || dataToExport.length === 0) return '';

    const insertStatements: string[] = [];
    const columnNames = columns.map(col => `\`${col.name}\``).join(', ');

    dataToExport.forEach(row => {
      const values = columns.map(col => {
        const rawValue = row[col.name];
        const columnType = col.type.toLowerCase().split('(')[0]; // e.g., "varchar", "int", "json", "datetime"

        if (rawValue === null) {
          return 'NULL';
        }

        if (columnType === 'json') {
          let jsonString;
          if (typeof rawValue === 'string') {
            try {
              // Tenta fazer o parse se for uma string que parece JSON, depois stringify para garantir o escape correto
              jsonString = JSON.stringify(JSON.parse(rawValue));
            } catch (e) {
              // Se for uma string mas não um JSON válido, trata como string normal
              jsonString = JSON.stringify(rawValue);
            }
          } else {
            jsonString = JSON.stringify(rawValue);
          }
          return `'${jsonString.replace(/'/g, "''")}'`; // Escapa aspas simples na própria string JSON
        }

        if (['date', 'datetime', 'timestamp'].includes(columnType)) {
          try {
            const date = new Date(rawValue);
            if (!isNaN(date.getTime())) {
              // Formata para YYYY-MM-DD HH:MM:SS.ms (ou sem .ms se não houver)
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

              let formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
              if (milliseconds !== '000') { // Adiciona milissegundos apenas se não forem zero
                formattedDate += `.${milliseconds}`;
              }
              return `'${formattedDate}'`;
            }
          } catch (e) {
            // Fallback para tratar como string se o parse da data falhar
            console.warn(`Could not parse date for column ${col.name}: ${rawValue}`);
          }
        }

        if (['tinyint', 'boolean'].includes(columnType) && (typeof rawValue === 'boolean' || rawValue === 0 || rawValue === 1)) {
          return rawValue ? '1' : '0';
        }

        if (typeof rawValue === 'string') {
          return `'${rawValue.replace(/'/g, "''")}'`;
        }
        
        // Para números e outros tipos
        return String(rawValue);
      }).join(', ');
      insertStatements.push(`INSERT INTO \`${table}\` (${columnNames}) VALUES (${values});`);
    });

    return insertStatements.join('\n');
  }, [dataToExport, columns, table]);

  const handleExport = useCallback(() => {
    setIsLoading(true);
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
  }, [exportFormat, generateCsv, generateJson, generateSql, database, table, onOpenChange, toast, t, dataToExport]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[425px]">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            <XCircle className="h-4 w-4 mr-2" />
            {t("exportDataDialog.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={isLoading || dataToExport.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {t("exportDataDialog.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDataDialog;