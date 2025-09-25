import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/Login";
import InitialSetupWizard from "./components/InitialSetupWizard";
import { TabProvider } from "./context/TabContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DatabaseCacheProvider } from "./context/DatabaseCacheContext";
import { Loader2 } from "lucide-react";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { useState, useEffect } from "react";
import { apiService } from "./services/api";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState<'checking' | 'ready' | 'needs_initialization'>('checking');

  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const status = await apiService.getSystemStatus();
        setSystemStatus(status.status);
      } catch (error) {
        console.error('Error checking system status:', error);
        // Se houver erro ao verificar o status, assumimos que precisa de inicialização
        setSystemStatus('needs_initialization');
      }
    };

    checkSystemStatus();
  }, []);

  // Mostrar loading enquanto verifica o sistema ou está inicializando autenticação
  if (systemStatus === 'checking' || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto" />
          <p className="text-muted-foreground">
            {systemStatus === 'checking' ? 'Verificando sistema...' : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  // Se o sistema precisa de inicialização, mostrar o wizard
  if (systemStatus === 'needs_initialization') {
    return <InitialSetupWizard />;
  }

  // Sistema está pronto, seguir com o fluxo normal
  return (
    <>
      {isAuthenticated ? (
        <TabProvider navigate={navigate}>
          <Routes>
            <Route path="/*" element={<Layout />} />
          </Routes>
        </TabProvider>
      ) : (
        <Routes>
          <Route path="/*" element={<LoginPage />} />
        </Routes>
      )}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="jsmyadmin-theme">
      <AuthProvider>
        <DatabaseCacheProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <I18nextProvider i18n={i18n}>
              <BrowserRouter> {/* BrowserRouter should wrap AppContent to provide routing context */}
                <AppContent />
              </BrowserRouter>
            </I18nextProvider>
          </TooltipProvider>
        </DatabaseCacheProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;