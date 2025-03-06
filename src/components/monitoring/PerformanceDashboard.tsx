
import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, AlertCircle, Server, DownloadCloud, Zap, Activity, RefreshCw } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { analyticsService, PerformanceMetric, SystemHealth, SystemAlert } from '@/utils/monitoring/analyticsService';
import { logger } from '@/utils/monitoring/loggingService';
import { toast } from '@/hooks/use-toast';

const PerformanceDashboard = () => {
  const [applicationMetrics, setApplicationMetrics] = useState<PerformanceMetric[]>([]);
  const [blockchainMetrics, setBlockchainMetrics] = useState<PerformanceMetric[]>([]);
  const [tradeMetrics, setTradeMetrics] = useState<PerformanceMetric[]>([]);
  const [gasMetrics, setGasMetrics] = useState<PerformanceMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<SystemAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load data on component mount
  useEffect(() => {
    refreshData();
    
    // Check if monitoring is already running
    setIsMonitoring(analyticsService.getSystemHealth().components.monitoring === 'active');
    
    // Set up an interval to refresh data every 30 seconds
    const intervalId = setInterval(() => {
      refreshData();
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  const refreshData = () => {
    setIsLoading(true);
    
    // Get metrics for different categories
    setApplicationMetrics(analyticsService.getMetrics('application'));
    setBlockchainMetrics(analyticsService.getMetrics('blockchain'));
    setTradeMetrics(analyticsService.getMetrics('trade'));
    setGasMetrics(analyticsService.getMetrics('gas'));
    
    // Get system health
    setSystemHealth(analyticsService.getSystemHealth());
    
    // Get unacknowledged alerts
    setActiveAlerts(analyticsService.getAlerts(undefined, undefined, false));
    
    setIsLoading(false);
  };
  
  const toggleMonitoring = () => {
    if (isMonitoring) {
      analyticsService.stopMonitoring();
      logger.info('monitoring', 'Monitoring stopped by user');
      toast({
        title: "Monitoring Stopped",
        description: "Performance monitoring has been stopped"
      });
    } else {
      analyticsService.startMonitoring();
      logger.info('monitoring', 'Monitoring started by user');
      toast({
        title: "Monitoring Started",
        description: "Performance monitoring has been started"
      });
    }
    
    setIsMonitoring(!isMonitoring);
  };
  
  const generateReport = () => {
    try {
      const report = analyticsService.generatePerformanceReport('daily');
      logger.info('monitoring', 'Performance report generated', { reportId: report.id });
      
      toast({
        title: "Report Generated",
        description: "Performance report has been generated successfully"
      });
    } catch (error) {
      logger.error('monitoring', 'Failed to generate report', { error });
      
      toast({
        title: "Report Generation Failed",
        description: "Failed to generate performance report",
        variant: "destructive"
      });
    }
  };
  
  const acknowledgeAlert = (alertId: string) => {
    analyticsService.acknowledgeAlert(alertId);
    setActiveAlerts(activeAlerts.filter(alert => alert.id !== alertId));
    
    logger.info('monitoring', 'Alert acknowledged', { alertId });
  };
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  const prepareTimeSeriesData = (metrics: PerformanceMetric[], key: string) => {
    return metrics
      .filter(metric => metric.name === key)
      .map(metric => ({
        time: formatTimestamp(metric.timestamp),
        value: metric.value,
        timestamp: metric.timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  };
  
  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'connected': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'disconnected': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'unavailable': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };
  
  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };
  
  return (
    <GlassCard className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <BarChart3 className="mr-2 h-6 w-6" />
            Performance & Monitoring
          </h2>
          <p className="text-muted-foreground">
            System metrics, blockchain interaction, and trade performance
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant={isMonitoring ? "destructive" : "default"} 
            onClick={toggleMonitoring}
          >
            {isMonitoring ? (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Start Monitoring
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          <Button variant="secondary" onClick={generateReport}>
            <DownloadCloud className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>
      
      {/* System Health Overview */}
      {systemHealth && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">System Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <Badge className={getHealthStatusColor(systemHealth.status)}>
                  {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Blockchain</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <Badge className={getHealthStatusColor(systemHealth.components.blockchain)}>
                  {systemHealth.components.blockchain.charAt(0).toUpperCase() + systemHealth.components.blockchain.slice(1)}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Arbitrage</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <Badge className={getHealthStatusColor(systemHealth.components.arbitrage)}>
                  {systemHealth.components.arbitrage.charAt(0).toUpperCase() + systemHealth.components.arbitrage.slice(1)}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <Badge className={getHealthStatusColor(systemHealth.components.monitoring)}>
                  {systemHealth.components.monitoring.charAt(0).toUpperCase() + systemHealth.components.monitoring.slice(1)}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <Badge className={getHealthStatusColor(systemHealth.components.storage)}>
                  {systemHealth.components.storage.charAt(0).toUpperCase() + systemHealth.components.storage.slice(1)}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Active Alerts</h3>
          <div className="space-y-2">
            {activeAlerts.map(alert => (
              <Card key={alert.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <Badge className={getAlertLevelColor(alert.level)}>
                        {alert.level.charAt(0).toUpperCase() + alert.level.slice(1)}
                      </Badge>
                      <p className="mt-1">{alert.message}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                    Acknowledge
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Performance Metrics Tabs */}
      <Tabs defaultValue="trades">
        <TabsList className="mb-4">
          <TabsTrigger value="trades">
            <Zap className="mr-2 h-4 w-4" />
            Trade Performance
          </TabsTrigger>
          <TabsTrigger value="blockchain">
            <Server className="mr-2 h-4 w-4" />
            Blockchain
          </TabsTrigger>
          <TabsTrigger value="gas">
            <Activity className="mr-2 h-4 w-4" />
            Gas Costs
          </TabsTrigger>
          <TabsTrigger value="application">
            <BarChart3 className="mr-2 h-4 w-4" />
            Application
          </TabsTrigger>
        </TabsList>
        
        {/* Trade Performance Tab */}
        <TabsContent value="trades" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
                <CardDescription>Trade execution success percentage</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareTimeSeriesData(tradeMetrics, 'success_rate')}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      name="Success Rate (%)" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Execution Time</CardTitle>
                <CardDescription>Average trade execution time (ms)</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareTimeSeriesData(tradeMetrics, 'average_execution_time')}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      name="Execution Time (ms)" 
                      stroke="#82ca9d" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Blockchain Tab */}
        <TabsContent value="blockchain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Connection Status</CardTitle>
              <CardDescription>Blockchain connection status over time</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareTimeSeriesData(blockchainMetrics, 'wallet_connected')}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="stepAfter" 
                    dataKey="value" 
                    name="Connected (1=Yes, 0=No)" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Gas Costs Tab */}
        <TabsContent value="gas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gas Price Trend</CardTitle>
              <CardDescription>Gas price over time (Gwei)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareTimeSeriesData(gasMetrics, 'gas_price')}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    name="Gas Price (Gwei)" 
                    stroke="#ff7300" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Application Tab */}
        <TabsContent value="application" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Uptime</CardTitle>
                <CardDescription>Application uptime (seconds)</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareTimeSeriesData(applicationMetrics, 'uptime')}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      name="Uptime (seconds)" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>JS Heap Size (MB)</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareTimeSeriesData(applicationMetrics, 'memory_usage')}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      name="Memory Usage (MB)" 
                      stroke="#82ca9d" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </GlassCard>
  );
};

export default PerformanceDashboard;
