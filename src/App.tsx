
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { systemIntegration } from "./utils/integration/systemIntegration";
import { logger } from "./utils/monitoring/loggingService";

const queryClient = new QueryClient();

const App = () => {
  // Initialize system when the app loads
  useEffect(() => {
    const initializeSystem = async () => {
      logger.info('app', 'Initializing application');
      await systemIntegration.initialize();
      logger.info('app', 'Application initialized');
    };
    
    initializeSystem();
    
    return () => {
      // Clean up on unmount if needed
      logger.info('app', 'Application shutdown');
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
