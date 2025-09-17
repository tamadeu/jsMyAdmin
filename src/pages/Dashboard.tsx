import { useState, useEffect } from "react";
import { Database, Table, Server, Users, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDatabases: 4,
    totalTables: 39,
    storageUsed: "10.2 GB",
    storagePercent: 68,
    activeConnections: 3
  });

  const databases = [
    { 
      name: "ecommerce_prod", 
      totalTables: 15,
      totalSize: "2.4 GB",
      status: "active"
    },
    { 
      name: "user_analytics", 
      totalTables: 8,
      totalSize: "856 MB",
      status: "active"
    },
    { 
      name: "content_management", 
      totalTables: 12,
      totalSize: "1.2 GB",
      status: "active"
    },
    { 
      name: "logs_archive", 
      totalTables: 4,
      totalSize: "5.8 GB",
      status: "active"
    }
  ];

  const queryHistory = [
    { query: "SELECT * FROM users WHERE status = \"active\" ORDER BY created_at...", time: "0.045s", timestamp: "2024-01-15 14:30:22" },
    { query: "UPDATE products SET stock = stock - 1 WHERE id = 123", time: "0.012s", timestamp: "2024-01-15 14:25:15" },
    { query: "SELECT COUNT(*) as total_orders FROM orders WHERE DATE(created_...", time: "0.089s", timestamp: "2024-01-15 14:20:08" }
  ];

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
            <p className="text-xs text-muted-foreground">+2 from last month</p>
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
            <p className="text-xs text-muted-foreground">+12 from last month</p>
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
            <p className="text-xs text-muted-foreground mt-1">{stats.storagePercent}% of 15 GB limit</p>
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
            <p className="text-xs text-muted-foreground">2 admin, 1 read-only</p>
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
            {databases.map((db) => (
              <div key={db.name} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <div className="font-medium">{db.name}</div>
                    <div className="text-sm text-muted-foreground">{db.totalTables} tables • {db.totalSize}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">utf8mb4_unicode_ci</div>
              </div>
            ))}
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