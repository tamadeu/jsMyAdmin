import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom"; // Import useNavigate
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/Login";
import { TabProvider } from "./context/TabContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DatabaseCacheProvider } from "./context/DatabaseCacheContext";
import { Loader2 } from "lucide-react";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate(); // Get navigate function here

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <TabProvider navigate={navigate}> {/* Pass navigate to TabProvider */}
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