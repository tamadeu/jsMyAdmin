"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Save, XCircle, Trash2, Edit, PlusCircle } from "lucide-react";
import { apiService, DatabasePrivilege } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserPrivilegesDialogProps {
  user: string;
  host: string;
  onClose: () => void;
}

const GLOBAL_PRIVILEGES = {
  data: ["SELECT", "INSERT", "UPDATE", "DELETE", "FILE"],
  structure: ["CREATE", "ALTER", "INDEX", "DROP", "CREATE TEMPORARY TABLES", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", "CREATE VIEW", "EVENT", "TRIGGER"],
  admin: ["GRANT OPTION", "SUPER", "PROCESS", "RELOAD", "SHUTDOWN", "SHOW DATABASES", "LOCK TABLES", "REFERENCES", "REPLICATION CLIENT", "REPLICATION SLAVE", "CREATE USER"]
};

const DB_PRIVILEGES_LIST = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "INDEX", "DROP", "CREATE TEMPORARY TABLES", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", "CREATE VIEW", "EVENT", "TRIGGER", "REFERENCES", "LOCK TABLES"];

const UserPrivilegesDialog = ({ user, host, onClose }: UserPrivilegesDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global privileges state
  const [globalPrivileges, setGlobalPrivileges] = useState<Set<string>>(new Set());

  // Database privileges state
  const [dbPrivileges, setDbPrivileges] = useState<DatabasePrivilege[]>([]);
  const [allDatabases, setAllDatabases] = useState<string[]>([]);
  const [editingDb, setEditingDb] = useState<Partial<DatabasePrivilege> | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [privsData, dbsData] = await Promise.all([
        apiService.getUserPrivileges(user, host),
        apiService.getDatabases()
      ]);
      setGlobalPrivileges(new Set(privsData.globalPrivileges));
      setDbPrivileges(privsData.databasePrivileges);
      setAllDatabases(dbsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, host]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Global Privileges Handlers ---
  const handleGlobalPrivilegeChange = (priv: string, checked: boolean) => {
    setGlobalPrivileges(prev => {
      const newPrivs = new Set(prev);
      if (checked) newPrivs.add(priv);
      else newPrivs.delete(priv);
      return newPrivs;
    });
  };

  const handleSaveGlobal = async () => {
    try {
      setIsSaving(true);
      await apiService.updateUserPrivileges(user, host, { privileges: Array.from(globalPrivileges) });
      toast({ title: "Global Privileges Updated" });
    } catch (err) {
      toast({ title: "Update Failed", description: err instanceof Error ? err.message : "An error occurred", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Database Privileges Handlers ---
  const handleRevokeDb = async (database: string) => {
    try {
      await apiService.revokeDatabasePrivileges(user, host, database);
      toast({ title: "Privileges Revoked", description: `All privileges on ${database} revoked.` });
      fetchAllData();
    } catch (err) {
      toast({ title: "Revoke Failed", description: err instanceof Error ? err.message : "An error occurred", variant: "destructive" });
    }
  };

  const handleEditDb = (dbPriv: DatabasePrivilege) => {
    setEditingDb({
      database: dbPriv.database,
      privileges: [...dbPriv.privileges],
      grantOption: dbPriv.grantOption
    });
  };

  const handleSaveDb = async () => {
    if (!editingDb || !editingDb.database) return;
    try {
      setIsSaving(true);
      await apiService.updateDatabasePrivileges(
        user, host, editingDb.database, editingDb.privileges || [], editingDb.grantOption || false
      );
      toast({ title: "Database Privileges Updated" });
      setEditingDb(null);
      fetchAllData();
    } catch (err) {
      toast({ title: "Update Failed", description: err instanceof Error ? err.message : "An error occurred", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditingDbPrivChange = (priv: string, checked: boolean) => {
    if (!editingDb) return;
    const currentPrivs = new Set(editingDb.privileges || []);
    if (checked) currentPrivs.add(priv);
    else currentPrivs.delete(priv);
    setEditingDb(prev => ({ ...prev!, privileges: Array.from(currentPrivs) }));
  };

  // --- Render Functions ---
  const renderPrivilegeCheckboxes = (title: string, privilegeList: string[], selected: Set<string>, onChange: (priv: string, checked: boolean) => void) => (
    <div key={title}>
      <h4 className="font-semibold text-md mb-2">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md">
        {privilegeList.map(priv => (
          <div key={priv} className="flex items-center space-x-2">
            <Checkbox id={`${title}-${priv}`} checked={selected.has(priv)} onCheckedChange={(checked) => onChange(priv, !!checked)} />
            <Label htmlFor={`${title}-${priv}`} className="text-sm font-normal cursor-pointer">{priv}</Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Privileges: {user}@{host}</DialogTitle>
          <DialogDescription>Manage global and database-specific privileges for this user.</DialogDescription>
        </DialogHeader>
        
        {isLoading && <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        {error && <div className="flex flex-col items-center justify-center h-96 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>{error}</p></div>}

        {!isLoading && !error && (
          <Tabs defaultValue="global" className="w-full">
            <TabsList>
              <TabsTrigger value="global">Global Privileges</TabsTrigger>
              <TabsTrigger value="database">Database-Specific</TabsTrigger>
            </TabsList>
            <TabsContent value="global" className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
              {renderPrivilegeCheckboxes("Data", GLOBAL_PRIVILEGES.data, globalPrivileges, handleGlobalPrivilegeChange)}
              {renderPrivilegeCheckboxes("Structure", GLOBAL_PRIVILEGES.structure, globalPrivileges, handleGlobalPrivilegeChange)}
              {renderPrivilegeCheckboxes("Administration", GLOBAL_PRIVILEGES.admin, globalPrivileges, handleGlobalPrivilegeChange)}
              <div className="flex justify-end">
                <Button onClick={handleSaveGlobal} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Global Privileges
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="database" className="py-4 max-h-[60vh] overflow-y-auto pr-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Existing Privileges</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Database</TableHead><TableHead>Privileges</TableHead><TableHead>Grant Option</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbPrivileges.map(p => (
                        <TableRow key={p.database}>
                          <TableCell className="font-mono">{p.database}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{p.privileges.join(', ')}</TableCell>
                          <TableCell>{p.grantOption ? 'Yes' : 'No'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEditDb(p)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRevokeDb(p.database)}><Trash2 className="h-4 w-4 mr-2" />Revoke</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dbPrivileges.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No database-specific privileges found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle>{editingDb?.database ? 'Edit' : 'Add'} Privileges on a Database</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Select
                      value={editingDb?.database || ""}
                      onValueChange={(db) => setEditingDb({ database: db, privileges: [], grantOption: false })}
                      disabled={!!editingDb?.database && dbPrivileges.some(p => p.database === editingDb.database)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select a database" /></SelectTrigger>
                      <SelectContent>
                        {allDatabases.map(db => <SelectItem key={db} value={db}>{db}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {editingDb && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md">
                        {DB_PRIVILEGES_LIST.map(priv => (
                          <div key={priv} className="flex items-center space-x-2">
                            <Checkbox id={`db-${priv}`} checked={editingDb.privileges?.includes(priv)} onCheckedChange={(checked) => handleEditingDbPrivChange(priv, !!checked)} />
                            <Label htmlFor={`db-${priv}`} className="text-sm font-normal">{priv}</Label>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="db-grant" checked={editingDb.grantOption} onCheckedChange={(checked) => setEditingDb(prev => ({ ...prev!, grantOption: !!checked }))} />
                        <Label htmlFor="db-grant">GRANT OPTION</Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditingDb(null)}>Cancel</Button>
                        <Button onClick={handleSaveDb} disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserPrivilegesDialog;