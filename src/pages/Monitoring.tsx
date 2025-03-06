
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileCog, PieChart, AlertCircle, DownloadCloud } from 'lucide-react';
import PerformanceDashboard from '@/components/monitoring/PerformanceDashboard';
import LogsViewer from '@/components/monitoring/LogsViewer';
import { analyticsService } from '@/utils/monitoring/analyticsService';
import { logger } from '@/utils/monitoring/loggingService';
import { useEffect } from 'react';

const Monitoring = () => {
  useEffect(() => {
    // Start analytics service if not already running
    const systemHealth = analyticsService.getSystemHealth();
    if (systemHealth.components.monitoring !== 'active') {
      analyticsService.startMonitoring();
    }
    
    // Log page visit
    logger.info('navigation', 'Monitoring page visited', { timestamp: Date.now() });
    
    return () => {
      // No need to stop monitoring when leaving the page
    };
  }, []);
  
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">System Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor application performance, blockchain interactions, and trade executions
        </p>
      </div>
      
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance Metrics
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileCog className="h-4 w-4 mr-2" />
            System Logs
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance">
          <PerformanceDashboard />
        </TabsContent>
        
        <TabsContent value="logs">
          <LogsViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Monitoring;
