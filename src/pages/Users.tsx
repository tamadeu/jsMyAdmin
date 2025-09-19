import { useState, useEffect } from "react";
import { Users as UsersIcon, Loader2, AlertCircle, Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import UserPrivilegesDialog from "@/components/UserPrivilegesDialog"; // Import the dialog
import { useAuth } from "@/context/AuthContext";

interface MysqlUser {
  user: string;
  host: string;
}

const UsersPage = () => {
  const { toast } = useToast();
  const { hasPrivilege } = useAuth();
  const [users, setUsers] = useState<MysqlUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<MysqlUser | null>(null); // State for dialog

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load users";
      setError(errorMessage);
      toast({
        title: "Error loading users",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = () => {
    toast({
      title: "Not Implemented",
      description: "Adding users will be implemented soon.",
    });
  };

  const handleEditUser = (user: MysqlUser) => {
    setEditingUser(user); // Open the dialog
  };

  const handleDeleteUser = (user: MysqlUser) => {
    toast({
      title: "Not Implemented",
      description: `Deleting user ${user.user}@${user.host} will be implemented soon.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadUsers} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {editingUser && (
        <UserPrivilegesDialog
          user={editingUser.user}
          host={editingUser.host}
          onClose={() => setEditingUser(null)}
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                MySQL Users
              </CardTitle>
              <CardDescription>Manage database users and their privileges.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadUsers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {hasPrivilege("CREATE USER") && (
                <Button size="sm" onClick={handleAddUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Host</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={`${user.user}-${user.host}-${index}`}>
                  <TableCell className="font-medium">{user.user}</TableCell>
                  <TableCell>{user.host}</TableCell>
                  <TableCell className="text-right">
                    {hasPrivilege("GRANT OPTION") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Privileges
                      </Button>
                    )}
                    {hasPrivilege("CREATE USER") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteUser(user)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;