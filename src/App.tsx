import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import { TabProvider } from "./context/TabContext"; // Import TabProvider

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="phpmyadmin-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TabProvider> {/* Wrap with TabProvider */}
            <Routes>
              <Route path="/" element={<Layout />} /> {/* Layout will now handle tabs */}
              {/* Keep NotFound for direct invalid URL access */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TabProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;