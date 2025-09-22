"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, XCircle, Save } from "lucide-react";
import { apiService, TableData } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface InsertRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  table: string;
  columns: TableData['columns'];
  onRowInserted: () => void;
}

const InsertRowDialog = ({ open, onOpenChange, database, table, columns, onRowInserted }: InsertRowDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when dialog opens or columns change
  useEffect(() => {
    if (open && columns) {
      const initialData: Record<string, any> = {};
      columns.forEach(col => {
        // For auto-increment columns, leave them undefined so the DB handles it
        if (col.extra.includes('auto_increment')) {
          initialData[col.name] = undefined;
        } else if (col.default !== null && col.default !== undefined) {
          initialData[col.name] = String(col.default);
        } else if (col.null) {
          initialData[col.name] = null; // Explicitly set to null for nullable fields
        } else {
          initialData[col.name] = ''; // Empty string for non-nullable, non-default fields
        }
      });
      setFormData(initialData);
      setError(null);
    }
  }, [open, columns]);

  const handleInputChange = (columnName: string, value: any) => {
    setFormData(prev => ({ ...prev, [columnName]: value }));
  };

  const handleNullToggle = (columnName: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [columnName]: checked ? null : '' }));
  };

  const validateForm = useCallback(() => {
    for (const col of columns) {
      // Skip auto-increment columns as they are handled by the DB
      if (col.extra.includes('auto_increment')) continue;

      const value = formData[col.name];

      // Check for non-nullable fields that are empty strings or undefined
      if (!col.null && (value === '' || value === undefined)) {
        setError(`Column '${col.name}' cannot be empty.`);
        return false;
      }
    }
    setError(null);
    return true;
  }, [formData, columns]);

  const handleInsertRow = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Filter out undefined values (e.g., auto-increment columns)
      const dataToInsert: Record<string, any> = {};
      for (const key in formData) {
        if (formData[key] !== undefined) {
          dataToInsert[key] = formData[key];
        }
      }

      const result = await apiService.insertRow(database, table, dataToInsert);
      if (result.success) {
        toast({
          title: "Row Inserted",
          description: `New row inserted successfully into '${table}'.`,
        });
        onRowInserted(); // Notify parent to refresh table data
        onOpenChange(false); // Close dialog
      } else {
        throw new Error(result.message || "Failed to insert row.");
      }
    } catch (err) {
      console.error("Error inserting row:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      toast({
        title: "Error Inserting Row",
        description: err instanceof Error ? err.message : "Failed to insert row.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Insert Row into "{table}"
          </DialogTitle>
          <DialogDescription>
            Enter the values for the new row. Auto-increment columns will be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {columns.map((col) => (
            <div key={col.name} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={`input-${col.name}`} className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-medium">{col.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {col.type}
                    {col.key === 'PRI' && ' (PK)'}
                    {!col.null && ' NOT NULL'}
                    {col.extra.includes('auto_increment') && ' AI'}
                  </span>
                </div>
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id={`input-${col.name}`}
                  value={formData[col.name] === null ? '' : String(formData[col.name] || '')}
                  onChange={(e) => handleInputChange(col.name, e.target.value)}
                  disabled={col.extra.includes('auto_increment') || formData[col.name] === null}
                  placeholder={col.extra.includes('auto_increment') ? 'Auto-increment' : col.null ? 'NULL / Enter value' : 'Required'}
                  className="flex-1"
                />
                {col.null && !col.extra.includes('auto_increment') && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`null-checkbox-${col.name}`}
                      checked={formData[col.name] === null}
                      onCheckedChange={(checked) => handleNullToggle(col.name, !!checked)}
                    />
                    <Label htmlFor={`null-checkbox-${col.name}`} className="text-sm font-normal">NULL</Label>
                  </div>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleInsertRow} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Insert Row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InsertRowDialog;