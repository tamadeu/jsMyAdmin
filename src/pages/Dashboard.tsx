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
import { useTranslation } from "react-i18next"; // Import useTranslation

interface ServerStatus {
  version: string;
  uptime: string;
  connections: number;
  status: string;
}

const Dashboard = () => {
  const { t } = useTranslation(); // Initialize useTranslation
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
      setError(error instanceof Error ? error.message : t('dashboard.failedToLoadDashboard'));
      toast({
        title: t("dashboard.failedToLoadDashboard"),
        description: t("dashboard.checkConfig"),
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
          <p className="text-muted-foreground">{t("dashboard.loadingDashboard")}</p>
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
          <Button onClick={loadDashboardData} variant="outline">
            {t("dashboard.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Server Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <CardTitle>{t("dashboard.serverInfo")}</CardTitle>
            </div>
            <CardDescription>{t("dashboard.serverInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{t("dashboard.server")}:</span> <span className="font-medium">{user?.host || 'N/A'}</span></div>
            <div className="flex justify-between"><span>{t("dashboard.serverType")}:</span> <span className="font-medium">MySQL</span></div>
            <div className="flex justify-between"><span>{t("dashboard.serverConnection")}:</span> <span className="font-medium">{t("dashboard.noSsl")}</span></div>
            <div className="flex justify-between"><span>{t("dashboard.serverVersion")}:</span> <span className="font-medium">{serverStatus?.version || 'N/A'}</span></div>
            <div className="flex justify-between"><span>{t("dashboard.uptime")}:</span> <span className="font-medium">{serverStatus?.uptime || 'N/A'} {t("dashboard.seconds")}</span></div>
            <div className="flex justify-between"><span>{t("dashboard.user")}:</span> <span className="font-medium">{user?.username || 'N/A'}@{user?.host || 'N/A'}</span></div>
            <div className="flex justify-between"><span>{t("dashboard.serverCharset")}:</span> <span className="font-medium">UTF-8 Unicode (utf8mb4)</span></div>
          </CardContent>
        </Card>

        {/* Application Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <CardTitle>{t("dashboard.appInfo")}</CardTitle>
            </div>
            <CardDescription>{t("dashboard.appInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{t("dashboard.appVersion")}:</span> <span className="font-medium">1.0.0</span></div>
            <div className="flex justify-between"><span>{t("dashboard.frontend")}:</span> <span className="font-medium">React, TypeScript, Tailwind CSS</span></div>
            <div className="flex justify-between"><span>{t("dashboard.backend")}:</span> <span className="font-medium">Node.js, Express</span></div>
            <div className="flex justify-between"><span>{t("dashboard.databaseDriver")}:</span> <span className="font-medium">mysql2</span></div>
            <div className="flex justify-between"><span>{t("dashboard.documentation")}:</span> <a href="https://www.dyad.sh/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Dyad.sh</a></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;