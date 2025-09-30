"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Columns, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Column {
  name: string;
  type: string;
  null: boolean;
  key: string;
  default: string | null;
  extra: string;
}

interface ColumnSelectorProps {
  columns: Column[];
  visibleColumns: Set<string>;
  onVisibleColumnsChange: (visibleColumns: Set<string>) => void;
}

const ColumnSelector = ({ columns, visibleColumns, onVisibleColumnsChange }: ColumnSelectorProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleColumnToggle = (columnName: string, checked: boolean) => {
    const newVisibleColumns = new Set(visibleColumns);
    if (checked) {
      newVisibleColumns.add(columnName);
    } else {
      newVisibleColumns.delete(columnName);
    }
    onVisibleColumnsChange(newVisibleColumns);
  };

  const handleSelectAll = () => {
    const allColumns = new Set(columns.map(col => col.name));
    onVisibleColumnsChange(allColumns);
  };

  const handleSelectNone = () => {
    onVisibleColumnsChange(new Set());
  };

  const visibleCount = visibleColumns.size;
  const totalCount = columns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns className="h-4 w-4 mr-2" />
          {t("columnSelector.columns")} ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">{t("columnSelector.selectColumns")}</h4>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSelectAll}
                className="h-6 px-2 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                {t("columnSelector.all")}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSelectNone}
                className="h-6 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                {t("columnSelector.none")}
              </Button>
            </div>
          </div>
          
          <Separator className="mb-3" />
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {columns.map((column) => (
              <div key={column.name} className="flex items-center space-x-2">
                <Checkbox
                  id={`column-${column.name}`}
                  checked={visibleColumns.has(column.name)}
                  onCheckedChange={(checked) => handleColumnToggle(column.name, !!checked)}
                />
                <label 
                  htmlFor={`column-${column.name}`}
                  className="flex-1 text-sm cursor-pointer select-none"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{column.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {column.type}
                      {column.key === 'PRI' && ` (${t("queryResultTable.pk")})`}
                      {!column.null && ` ${t("queryResultTable.notNull")}`}
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
          
          {visibleCount === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded">
              {t("columnSelector.noColumnsSelected")}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnSelector;