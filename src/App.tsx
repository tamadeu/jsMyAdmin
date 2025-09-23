import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/Login";
import { TabProvider } from "./context/TabContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DatabaseCacheProvider } from "./context/DatabaseCacheContext";
import { Loader2 } from "lucide-react";
import { I18nextProvider } from "react-i18next"; // Import I18nextProvider
import i18n from "./i18n"; // Import i18n instance

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <TabProvider>
          <Routes>
            <Route path="/*" element={<Layout />} />
          </Routes>
        </TabProvider>
      ) : (
        <Routes>
          <Route path="/*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="phpmyadmin-theme">
      <AuthProvider>
        <DatabaseCacheProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <I18nextProvider i18n={i18n}> {/* Wrap AppContent with I18nextProvider */}
              <AppContent />
            </I18nextProvider>
          </TooltipProvider>
        </DatabaseCacheProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;