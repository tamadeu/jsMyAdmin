"use client";

import { useState, useEffect } from "react";
import { Database, Table, Server, Users, Play, Loader2, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface ServerStatus {
  version: string;
  uptime: string;
  connections: number;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentServerStatus = await apiService.getServerStatus();
      setServerStatus(currentServerStatus);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Server Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <CardTitle>Database Server</CardTitle>
            </div>
            <CardDescription>General information about the connected MySQL server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Server:</span> <span className="font-medium">{user?.host || 'N/A'}</span></div>
            <div className="flex justify-between"><span>Server type:</span> <span className="font-medium">MySQL</span></div>
            <div className="flex justify-between"><span>Server connection:</span> <span className="font-medium">No SSL is being used</span></div>
            <div className="flex justify-between"><span>Server version:</span> <span className="font-medium">{serverStatus?.version || 'N/A'}</span></div>
            <div className="flex justify-between"><span>Uptime:</span> <span className="font-medium">{serverStatus?.uptime || 'N/A'} seconds</span></div>
            <div className="flex justify-between"><span>User:</span> <span className="font-medium">{user?.username || 'N/A'}@{user?.host || 'N/A'}</span></div>
            <div className="flex justify-between"><span>Server charset:</span> <span className="font-medium">UTF-8 Unicode (utf8mb4)</span></div>
          </CardContent>
        </Card>

        {/* Application Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <CardTitle>Application Information</CardTitle>
            </div>
            <CardDescription>Details about this jsMyAdmin application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>jsMyAdmin Version:</span> <span className="font-medium">1.0.0</span></div>
            <div className="flex justify-between"><span>Frontend:</span> <span className="font-medium">React, TypeScript, Tailwind CSS</span></div>
            <div className="flex justify-between"><span>Backend:</span> <span className="font-medium">Node.js, Express</span></div>
            <div className="flex justify-between"><span>Database Driver:</span> <span className="font-medium">mysql2</span></div>
            <div className="flex justify-between"><span>Documentation:</span> <a href="https://www.dyad.sh/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Dyad.sh</a></div>
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
            <div className="text-center py-4">
              <p className="text-muted-foreground">No recent queries available.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;