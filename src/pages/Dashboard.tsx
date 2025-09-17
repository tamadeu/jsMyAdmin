import { useState, useEffect } from "react";
import { Database, Table, Server, Users, Play, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface DatabaseStats {
  totalDatabases: number;
  totalTables: number;
  storageUsed: string;
  storagePercent: number;
  activeConnections: number;
}

interface DatabaseInfo {
  name: string;
  totalTables: number;
  totalSize: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DatabaseStats>({
    totalDatabases: 0,
    totalTables: 0,
    storageUsed: "0 GB",
    storagePercent: 0,
    activeConnections: 0
  });
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryHistory = [
    { query: "SELECT * FROM users WHERE status = \"active\" ORDER BY created_at...", time: "0.045s", timestamp: "2024-01-15 14:30:22" },
    { query: "UPDATE products SET stock = stock - 1 WHERE id = 123", time: "0.012s", timestamp: "2024-01-15 14:25:15" },
    { query: "SELECT COUNT(*) as total_orders FROM orders WHERE DATE(created_...", time: "0.089s", timestamp: "2024-01-15 14:20:08" }
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load databases
      const databaseNames = await apiService.getDatabases();
      
      // Load detailed information for each database
      const databasesWithInfo = await Promise.all(
        databaseNames.map(async (dbName) => {
          try {
            const { tables, totalTables } = await apiService.getTables(dbName); // Desestruturando a resposta
            
            // Calculate total size (simplified calculation)
            const totalSizeMB = tables.reduce((acc, table) => {
              const sizeStr = table.size.replace(' MB', '').replace(' GB', '');
              const size = parseFloat(sizeStr);
              return acc + (table.size.includes('GB') ? size * 1024 : size);
            }, 0);

            return {
              name: dbName,
              totalTables: totalTables, // Usando totalTables do objeto retornado
              totalSize: totalSizeMB > 1024 
                ? `${(totalSizeMB / 1024).toFixed(1)} GB` 
                : `${totalSizeMB.toFixed(1)} MB`,
              status: "active"
            };
          } catch (error) {
            console.error(`Error loading info for ${dbName}:`, error);
            return {
              name: dbName,
              totalTables: 0,
              totalSize: "0 MB",
              status: "error"
            };
          }
        })
      );

      setDatabases(databasesWithInfo);

      // Calculate overall statistics
      const totalTables = databasesWithInfo.reduce((acc, db) => acc + db.totalTables, 0);
      const totalSizeMB = databasesWithInfo.reduce((acc, db) => {
        const sizeStr = db.totalSize.replace(' MB', '').replace(' GB', '');
        const size = parseFloat(sizeStr);
        return acc + (db.totalSize.includes('GB') ? size * 1024 : size);
      }, 0);

      // Try to get server status
      let connections = 0;
      try {
        const serverStatus = await apiService.getServerStatus();
        connections = serverStatus.connections;
      } catch (error) {
        console.warn('Could not fetch server status:', error);
      }

      setStats({
        totalDatabases: databaseNames.length,
        totalTables,
        storageUsed: totalSizeMB > 1024 
          ? `${(totalSizeMB / 1024).toFixed(1)} GB` 
          : `${totalSizeMB.toFixed(1)} MB`,
        storagePercent: Math.min((totalSizeMB / 1024 / 15) * 100, 100), // Assuming 15GB limit
        activeConnections: connections
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      toast({
        title: "Error loading dashboard",
        description: "Please check your database connection in Configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">Failed to load dashboard data</p>
          <Button onClick={loadDashboardData} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Database Dashboard</h1>
        <p className="text-muted-foreground">Overview of your MySQL databases and recent activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Databases</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDatabases}</div>
            <p className="text-xs text-muted-foreground">Connected databases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
              <Table className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTables}</div>
            <p className="text-xs text-muted-foreground">Across all databases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.storageUsed}</div>
            <Progress value={stats.storagePercent} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">{stats.storagePercent.toFixed(1)}% of estimated limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConnections}</div>
            <p className="text-xs text-muted-foreground">Current connections</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Databases */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Databases</CardTitle>
            </div>
            <CardDescription>Manage your database instances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {databases.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No databases found</p>
              </div>
            ) : (
              databases.map((db) => (
                <div key={db.name} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      db.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="font-medium">{db.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {db.totalTables} {db.totalTables === 1 ? 'table' : 'tables'} • {db.totalSize}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">utf8mb4_unicode_ci</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                <CardTitle>Recent Query Activity</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/sql')}>
                Open SQL Editor
              </Button>
            </div>
            <CardDescription>Latest SQL operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {queryHistory.map((query, index) => (
              <div key={index} className="p-3 bg-accent rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-mono">{query.query}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{query.timestamp}</span>
                      <span>{query.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;