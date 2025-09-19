import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/Login"; // Importa LoginPage
import { TabProvider } from "./context/TabContext";
import { AuthProvider, useAuth } from "./context/AuthContext"; // Importa AuthProvider e useAuth

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated } = useAuth();

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;