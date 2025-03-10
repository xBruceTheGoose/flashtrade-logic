
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useEffect, useRef } from "react";
import { systemIntegration } from "./utils/integration/systemIntegration";
import { logger } from "./utils/monitoring/loggingService";
import { workerManager } from "./utils/blockchain/priceMonitoring/worker/workerManager";

// Create a QueryClient with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: false
    }
  }
});

const App = () => {
  // Use ref to track initialization state
  const initialized = useRef(false);
  
  // Initialize system when the app loads
  useEffect(() => {
    if (initialized.current) return;
    
    initialized.current = true;
    
    const initializeSystem = async () => {
      logger.info('app', 'Initializing application');
      await systemIntegration.initialize();
      logger.info('app', 'Application initialized');
    };
    
    initializeSystem();
    
    // Add event listener for offline/online status
    const handleConnectionChange = () => {
      if (navigator.onLine) {
        logger.info('app', 'Application is online');
        // Reinitialize if was offline
        systemIntegration.initialize();
      } else {
        logger.warn('app', 'Application is offline');
      }
    };
    
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    
    // Register beforeunload handler to clean up resources
    const handleBeforeUnload = () => {
      logger.info('app', 'Application unloading');
      // Clean up resources
      workerManager.terminateWorker();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // Clean up on unmount
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      systemIntegration.shutdown();
      workerManager.terminateWorker();
      
      logger.info('app', 'Application shutdown');
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
