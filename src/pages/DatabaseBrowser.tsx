import { useState } from "react";
import { useParams } from "react-router-dom";
import { Database, Table, Search, Filter, RotateCcw, Download, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const DatabaseBrowser = () => {
  const { database, table } = useParams();
  const [searchTerm, setSearchTerm] = useState("");

  const sampleUsers = [
    { id: 1, username: "john_doe", email: "john@example.com", created_at: "2024-01-10 10:30:00", status: "active" },
    { id: 2, username: "jane_smith", email: "jane@example.com", created_at: "2024-01-11 14:20:00", status: "active" },
    { id: 3, username: "bob_wilson", email: "bob@example.com", created_at: "2024-01-12 09:15:00", status: "inactive" },
    { id: 4, username: "alice_brown", email: "alice@example.com", created_at: "2024-01-13 16:45:00", status: "active" },
    { id: 5, username: "charlie_davis", email: "charlie@example.com", created_at: "2024-01-14 11:30:00", status: "pending" }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Table: {table}</h1>
          <div className="text-sm text-muted-foreground">
            Databases / {database} / {table}
          </div>
        </div>
      </div>

      {/* Table Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">InnoDB</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">45,231</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">12.4 MB</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">utf8mb4_unicode_ci</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Modified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">2024-01-15 14:30:22</div>
          </CardContent>
        </Card>
      </div>

      {/* Browse Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Browse Data</CardTitle>
              <CardDescription>5 rows</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Insert Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search in table..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Select defaultValue="10">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">
                      <Checkbox />
                    </th>
                    <th className="p-3 text-left">id</th>
                    <th className="p-3 text-left">username</th>
                    <th className="p-3 text-left">email</th>
                    <th className="p-3 text-left">created_at</th>
                    <th className="p-3 text-left">status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleUsers.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        <Checkbox />
                      </td>
                      <td className="p-3">{user.id}</td>
                      <td className="p-3">{user.username}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">{user.created_at}</td>
                      <td className="p-3">
                        <Badge 
                          variant={user.status === "active" ? "default" : user.status === "inactive" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing 1 to 5 of 5 entries</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm">1</Button>
                <Button variant="outline" size="sm" disabled>Next</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseBrowser;