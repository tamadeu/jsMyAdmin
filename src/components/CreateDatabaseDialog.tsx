"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, XCircle } from "lucide-react";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useDatabaseCache } from "@/context/DatabaseCacheContext"; // New import

interface CreateDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // onDatabaseCreated: () => void; // Removed, now handled by context
}

const CreateDatabaseDialog = ({ open, onOpenChange }: CreateDatabaseDialogProps) => {
  const { toast } = useToast();
  const { refreshDatabases } = useDatabaseCache(); // Use the hook
  const [databaseName, setDatabaseName] = useState("");
  const [charset, setCharset] = useState("utf8mb4");
  const [collation, setCollation] = useState("utf8mb4_unicode_ci");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateDatabase = async () => {
    if (!databaseName.trim()) {
      setError("Database name cannot be empty.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const result = await apiService.createDatabase(databaseName, charset, collation);
      if (result.success) {
        toast({
          title: "Database Created",
          description: `Database '${databaseName}' created successfully.`,
        });
        refreshDatabases({ force: true }); // Invalidate entire cache
        onOpenChange(false); // Close dialog
        setDatabaseName(""); // Reset form
      } else {
        throw new Error(result.message || "Failed to create database.");
      }
    } catch (err) {
      console.error("Error creating database:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      toast({
        title: "Error Creating Database",
        description: err instanceof Error ? err.message : "Failed to create database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading) { onOpenChange(o); setDatabaseName(""); setError(null); } }}> {/* Reset form on close */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Create New Database
          </DialogTitle>
          <DialogDescription>
            Enter the details for your new MySQL database.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="databaseName">Database Name</Label>
            <Input
              id="databaseName"
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              placeholder="e.g., my_new_database"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="charset">Charset</Label>
            <Select value={charset} onValueChange={setCharset}>
              <SelectTrigger id="charset">
                <SelectValue placeholder="Select charset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf8mb4">utf8mb4</SelectItem>
                <SelectItem value="utf8">utf8</SelectItem>
                <SelectItem value="latin1">latin1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collation">Collation</Label>
            <Select value={collation} onValueChange={setCollation}>
              <SelectTrigger id="collation">
                <SelectValue placeholder="Select collation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</SelectItem>
                <SelectItem value="utf8mb4_general_ci">utf8mb4_general_ci</SelectItem>
                <SelectItem value="utf8_unicode_ci">utf8_unicode_ci</SelectItem>
                <SelectItem value="utf8_general_ci">utf8_general_ci</SelectItem>
                <SelectItem value="latin1_swedish_ci">latin1_swedish_ci</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCreateDatabase} disabled={isLoading || !databaseName.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDatabaseDialog;