"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Save, XCircle } from "lucide-react";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface UserPrivilegesDialogProps {
  user: string;
  host: string;
  onClose: () => void;
}

const ALL_PRIVILEGES = {
  data: ["SELECT", "INSERT", "UPDATE", "DELETE", "FILE"],
  structure: ["CREATE", "ALTER", "INDEX", "DROP", "CREATE TEMPORARY TABLES", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", "CREATE VIEW", "EVENT", "TRIGGER"],
  admin: ["GRANT OPTION", "SUPER", "PROCESS", "RELOAD", "SHUTDOWN", "SHOW DATABASES", "LOCK TABLES", "REFERENCES", "REPLICATION CLIENT", "REPLICATION SLAVE", "CREATE USER"]
};

const UserPrivilegesDialog = ({ user, host, onClose }: UserPrivilegesDialogProps) => {
  const { toast } = useToast();
  const [privileges, setPrivileges] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrivileges = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { globalPrivileges } = await apiService.getUserPrivileges(user, host);
        setPrivileges(new Set(globalPrivileges));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load privileges";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrivileges();
  }, [user, host]);

  const handlePrivilegeChange = (priv: string, checked: boolean) => {
    setPrivileges(prev => {
      const newPrivs = new Set(prev);
      if (checked) {
        newPrivs.add(priv);
      } else {
        newPrivs.delete(priv);
      }
      return newPrivs;
    });
  };

  const handleSelectAll = (privilegeList: string[]) => {
    setPrivileges(prev => {
      const newPrivs = new Set(prev);
      privilegeList.forEach(p => newPrivs.add(p));
      return newPrivs;
    });
  };

  const handleDeselectAll = (privilegeList: string[]) => {
    setPrivileges(prev => {
      const newPrivs = new Set(prev);
      privilegeList.forEach(p => newPrivs.delete(p));
      return newPrivs;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiService.updateUserPrivileges(user, host, {
        privileges: Array.from(privileges)
      });
      toast({
        title: "Privileges Updated",
        description: `Privileges for ${user}@${host} have been updated successfully.`,
      });
      onClose();
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Failed to update privileges.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderPrivilegeSection = (title: string, privilegeList: string[]) => (
    <div key={title}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-md">{title}</h4>
        <div>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => handleSelectAll(privilegeList)}>Select All</Button>
          <span className="mx-1">/</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => handleDeselectAll(privilegeList)}>Deselect All</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md">
        {privilegeList.map(priv => (
          <div key={priv} className="flex items-center space-x-2">
            <Checkbox
              id={`${user}-${host}-${priv}`}
              checked={privileges.has(priv)}
              onCheckedChange={(checked) => handlePrivilegeChange(priv, !!checked)}
            />
            <Label htmlFor={`${user}-${host}-${priv}`} className="text-sm font-normal cursor-pointer">{priv}</Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Privileges</DialogTitle>
          <DialogDescription>
            Manage global privileges for user <span className="font-mono bg-muted px-1 rounded">{user}@{host}</span>.
            Changes apply to <span className="font-mono bg-muted px-1 rounded">*.*</span> (all databases).
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {renderPrivilegeSection("Data", ALL_PRIVILEGES.data)}
            {renderPrivilegeSection("Structure", ALL_PRIVILEGES.structure)}
            {renderPrivilegeSection("Administration", ALL_PRIVILEGES.admin)}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving || !!error}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserPrivilegesDialog;