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
import { useDatabaseCache } from "@/context/DatabaseCacheContext";
import { useTranslation } from "react-i18next"; // Import useTranslation

interface CreateDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateDatabaseDialog = ({ open, onOpenChange }: CreateDatabaseDialogProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const { refreshDatabases } = useDatabaseCache();
  const [databaseName, setDatabaseName] = useState("");
  const [charset, setCharset] = useState("utf8mb4");
  const [collation, setCollation] = useState("utf8mb4_unicode_ci");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateDatabase = async () => {
    if (!databaseName.trim()) {
      setError(t("createDatabaseDialog.databaseNameEmpty"));
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const result = await apiService.createDatabase(databaseName, charset, collation);
      if (result.success) {
        toast({
          title: t("createDatabaseDialog.databaseCreated"),
          description: t("createDatabaseDialog.databaseCreatedSuccessfully", { databaseName: databaseName }),
        });
        refreshDatabases({ force: true });
        onOpenChange(false);
        setDatabaseName("");
      } else {
        throw new Error(result.message || t("createDatabaseDialog.failedToCreateDatabase"));
      }
    } catch (err) {
      console.error("Error creating database:", err);
      setError(err instanceof Error ? err.message : t("createDatabaseDialog.unknownError"));
      toast({
        title: t("createDatabaseDialog.errorCreatingDatabase"),
        description: err instanceof Error ? err.message : t("createDatabaseDialog.failedToCreateDatabase"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isLoading) { onOpenChange(o); setDatabaseName(""); setError(null); } }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> {t("createDatabaseDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("createDatabaseDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="databaseName">{t("createDatabaseDialog.databaseName")}</Label>
            <Input
              id="databaseName"
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              placeholder={t("createDatabaseDialog.databaseNamePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="charset">{t("createDatabaseDialog.charset")}</Label>
            <Select value={charset} onValueChange={setCharset}>
              <SelectTrigger id="charset">
                <SelectValue placeholder={t("createDatabaseDialog.selectCharset")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf8mb4">utf8mb4</SelectItem>
                <SelectItem value="utf8">utf8</SelectItem>
                <SelectItem value="latin1">latin1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collation">{t("createDatabaseDialog.collation")}</Label>
            <Select value={collation} onValueChange={setCollation}>
              <SelectTrigger id="collation">
                <SelectValue placeholder={t("createDatabaseDialog.selectCollation")} />
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
            {t("createDatabaseDialog.cancel")}
          </Button>
          <Button onClick={handleCreateDatabase} disabled={isLoading || !databaseName.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t("createDatabaseDialog.createDatabase")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDatabaseDialog;