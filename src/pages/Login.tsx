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
import { Database, Loader2, AlertCircle, Wrench } from "lucide-react";
import { DatabaseConfig, apiService } from "@/services/api";

type SystemState = 'checking' | 'needs_initialization' | 'initializing' | 'ready';

const LoginPage = () => {
  const { login } = useAuth();
  const [host, setHost] = useState("localhost");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemState, setSystemState] = useState<SystemState>('checking');
  const [systemMessage, setSystemMessage] = useState('');

  const checkSystem = async () => {
    setSystemState('checking');
    try {
      const { status, message } = await apiService.getSystemStatus();
      setSystemState(status);
      setSystemMessage(message);
    } catch (err) {
      setSystemState('needs_initialization');
      setSystemMessage(err instanceof Error ? err.message : 'Could not connect to server.');
    }
  };

  useEffect(() => {
    try {
      const savedConfigJson = localStorage.getItem('database-config');
      if (savedConfigJson) {
        const savedConfig: DatabaseConfig = JSON.parse(savedConfigJson);
        setHost(savedConfig.database.host);
        setUsername(savedConfig.database.username);
      }
    } catch (e) {
      console.error("Failed to load config from localStorage", e);
    }
    checkSystem();
  }, []);

  const handleInitialize = async () => {
    setSystemState('initializing');
    setError(null);
    try {
      const result = await apiService.initializeSystem();
      if (result.success) {
        await checkSystem();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during initialization.');
      setSystemState('needs_initialization');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login({ host, username, password });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (systemState) {
      case 'checking':
        return (
          <CardContent className="flex flex-col items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Verificando o sistema...</p>
          </CardContent>
        );
      case 'initializing':
        return (
          <CardContent className="flex flex-col items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Inicializando o sistema...</p>
          </CardContent>
        );
      case 'needs_initialization':
        return (
          <>
            <CardContent className="space-y-4 text-center">
              <Wrench className="mx-auto h-10 w-10 text-yellow-500" />
              <p className="text-sm text-muted-foreground">
                As tabelas do sistema necessárias para recursos como histórico de consultas e sessões não foram encontradas.
              </p>
              <p className="text-xs text-muted-foreground">{systemMessage}</p>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleInitialize} className="w-full">
                Inicializar Sistema
              </Button>
            </CardFooter>
          </>
        );
      case 'ready':
        return (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
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
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Database className="mx-auto h-10 w-10 mb-2" />
          <CardTitle className="text-2xl">phpMyAdmin</CardTitle>
          <CardDescription>
            {systemState === 'needs_initialization' ? 'Configuração Inicial Necessária' : 'Conecte-se ao seu Banco de Dados MySQL'}
          </CardDescription>
        </CardHeader>
        {renderContent()}
      </Card>
    </div>
  );
};

export default LoginPage;