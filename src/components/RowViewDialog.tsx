"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X, Filter, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";

interface RowViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rowData: Record<string, any>;
  fields: Array<{ name: string; type: string; table?: string }> | Array<{ name: string; type: string; null: boolean; key: string; default: any; extra: string }>;
  rowIndex: number;
}

const RowViewDialog = ({ isOpen, onClose, rowData, fields, rowIndex }: RowViewDialogProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);

  // Initialize visible fields when dialog opens
  useEffect(() => {
    if (isOpen && fields.length > 0) {
      setVisibleFields(new Set(fields.map(field => field.name)));
      setSearchTerm("");
    }
  }, [isOpen, fields]);

  const formatCellValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">{t("queryResultTable.null")}</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getValueType = (value: any) => {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return 'object';
    return 'string';
  };

  const isLongValue = (value: any) => {
    if (value === null) return false;
    const stringValue = String(value);
    return stringValue.length > 100 || stringValue.includes('\n');
  };

  // Filter fields based on search term and visible selection
  const filteredFields = useMemo(() => {
    let filtered = fields.filter(field => visibleFields.has(field.name));
    
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(field => 
        field.name.toLowerCase().includes(lowerSearchTerm) ||
        (field.type && typeof field.type === 'string' && field.type.toLowerCase().includes(lowerSearchTerm)) ||
        // Also search in the actual values
        String(rowData[field.name] || '').toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    return filtered;
  }, [fields, searchTerm, rowData, visibleFields]);

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const handleFieldVisibilityChange = (fieldName: string, visible: boolean) => {
    setVisibleFields(prev => {
      const newSet = new Set(prev);
      if (visible) {
        newSet.add(fieldName);
      } else {
        newSet.delete(fieldName);
      }
      return newSet;
    });
  };

  const handleSelectAllFields = () => {
    setVisibleFields(new Set(fields.map(field => field.name)));
  };

  const handleDeselectAllFields = () => {
    setVisibleFields(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("rowViewDialog.title")}
            <Badge variant="secondary">{t("rowViewDialog.rowNumber", { index: rowIndex + 1 })}</Badge>
          </DialogTitle>
          <DialogDescription>
            {t("rowViewDialog.description")}
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar and Column Selector */}
        <div className="space-y-3 mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("rowViewDialog.searchColumns")}
                className="pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Column Selector Toggle */}
            <Collapsible open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Filter className="h-4 w-4 mr-2" />
                  {t("rowViewDialog.columns")}
                  <Badge variant="secondary" className="ml-2">
                    {visibleFields.size}/{fields.length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">{t("rowViewDialog.selectColumns")}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handleSelectAllFields} className="h-7 text-xs">
                        {t("columnSelector.all")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDeselectAllFields} className="h-7 text-xs">
                        {t("columnSelector.none")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {fields.map((field) => (
                      <div key={field.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${field.name}`}
                          checked={visibleFields.has(field.name)}
                          onCheckedChange={(checked) => handleFieldVisibilityChange(field.name, checked as boolean)}
                        />
                        <Label 
                          htmlFor={`field-${field.name}`} 
                          className="text-sm cursor-pointer truncate"
                          title={field.name}
                        >
                          {field.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          {/* Results Counter */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t("rowViewDialog.showingFields", { 
                showing: filteredFields.length, 
                total: fields.length 
              })}
            </span>
            {visibleFields.size === 0 && (
              <Badge variant="destructive" className="text-xs">
                {t("rowViewDialog.noColumnsSelected")}
              </Badge>
            )}
            {searchTerm && filteredFields.length === 0 && visibleFields.size > 0 && (
              <Badge variant="secondary" className="text-xs">
                {t("rowViewDialog.noFieldsFound")}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-4 mt-2">
          {filteredFields.length > 0 ? (
            filteredFields.map((field) => {
            const value = rowData[field.name];
            const isLong = isLongValue(value);
            const valueType = getValueType(value);
            
            // Extract type from field - handle both QueryResult.fields and TableData.columns
            const fieldType = (field.type && typeof field.type === 'string') 
              ? field.type.split('(')[0] // Remove length specification like VARCHAR(255)
              : 'Unknown';

            return (
              <Card key={field.name} className="border-l-4 border-l-blue-200">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-sm">
                        {field.name}
                      </Label>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {fieldType}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {valueType}
                        </Badge>
                        {/* Show additional info for table columns */}
                        {'key' in field && field.key === 'PRI' && (
                          <Badge variant="default" className="text-xs">
                            PK
                          </Badge>
                        )}
                        {'null' in field && !field.null && (
                          <Badge variant="destructive" className="text-xs">
                            NOT NULL
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className={`p-3 bg-muted rounded-md ${isLong ? 'min-h-[100px]' : ''}`}>
                      {isLong ? (
                        <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                          {formatCellValue(value)}
                        </pre>
                      ) : (
                        <div className="text-sm break-words">
                          {formatCellValue(value)}
                        </div>
                      )}
                    </div>
                    
                    {value !== null && (
                      <div className="text-xs text-muted-foreground">
                        {t("rowViewDialog.characterCount", { 
                          count: String(value).length 
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            })
          ) : visibleFields.size === 0 ? (
            <div className="text-center py-8">
              <EyeOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("rowViewDialog.noColumnsSelected")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t("rowViewDialog.selectColumnsToView")}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsColumnSelectorOpen(true)}
                className="mt-3"
              >
                <Eye className="h-4 w-4 mr-2" />
                {t("rowViewDialog.selectColumns")}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("rowViewDialog.noFieldsMatchSearch")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t("rowViewDialog.tryDifferentSearch")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RowViewDialog;