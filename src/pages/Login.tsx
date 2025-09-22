"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { apiService, DatabaseConfig } from "@/services/api"; // Import apiService

const LoginPage = () => {
  const { login } = useAuth();
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(3306);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedConfigJson = localStorage.getItem('database-config');
      if (savedConfigJson) {
        const savedConfig: DatabaseConfig = JSON.parse(savedConfigJson);
        setHost(savedConfig.database.host);
        setPort(savedConfig.database.port);
        // Do NOT load username/password from config, they are user-specific for login
      }
    } catch (e) {
      console.error("Failed to load config from localStorage", e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Save host and port to config (for frontend's general connection parameters)
      // The backend's system user credentials are NOT saved here.
      const currentConfig: DatabaseConfig = {
        database: { host, port, username: "", password: "", defaultDatabase: "mysql", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", connectionTimeout: 10000, maxConnections: 10, ssl: false, sslCertificate: "", sslKey: "", sslCA: "" },
        application: { theme: "dark", language: "en", queryTimeout: 30000, maxQueryResults: 1000, autoRefresh: false, refreshInterval: 30000 },
        security: { allowMultipleStatements: false, allowLocalInfile: false, requireSSL: false }
      };
      // Attempt to load existing config from localStorage to preserve other settings
      const savedConfigJson = localStorage.getItem('database-config');
      if (savedConfigJson) {
        const existingConfig = JSON.parse(savedConfigJson);
        currentConfig.application = existingConfig.application;
        currentConfig.security = existingConfig.security;
        currentConfig.database.defaultDatabase = existingConfig.database.defaultDatabase;
        currentConfig.database.charset = existingConfig.database.charset;
        currentConfig.database.collation = existingConfig.database.collation;
        currentConfig.database.connectionTimeout = existingConfig.database.connectionTimeout;
        currentConfig.database.maxConnections = existingConfig.database.maxConnections;
        currentConfig.database.ssl = existingConfig.database.ssl;
        currentConfig.database.sslCertificate = existingConfig.database.sslCertificate;
        currentConfig.database.sslKey = existingConfig.database.sslKey;
        currentConfig.database.sslCA = existingConfig.database.sslCA;
      }

      await apiService.saveConfig(currentConfig); // Save only host/port and other settings

      // Then attempt to login with user credentials
      await login({ host, port, username, password });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Database className="mx-auto h-10 w-10 mb-2" />
          <CardTitle className="text-2xl">phpMyAdmin</CardTitle>
          <CardDescription>
            Conecte-se ao seu Banco de Dados MySQL
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="host">Servidor</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value, 10))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;