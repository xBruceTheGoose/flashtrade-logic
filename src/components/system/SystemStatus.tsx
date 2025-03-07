
import { useEffect, useState } from 'react';
import { systemIntegration } from '@/utils/integration/systemIntegration';
import { appState, AppState } from '@/utils/integration/stateManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, AlertTriangle, Activity, Zap } from 'lucide-react';

const SystemStatus = () => {
  const [status, setStatus] = useState(systemIntegration.getSystemStatus());
  const [appCurrentState, setAppCurrentState] = useState(appState.getState());
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    // Initialize system on component mount
    const initSystem = async () => {
      const success = await systemIntegration.initialize();
      setStatus(systemIntegration.getSystemStatus());
      setInitialized(true);
      
      // Update app state based on initialization result
      if (success) {
        appState.setState(AppState.READY);
      } else {
        appState.setState(AppState.ERROR);
      }
    };
    
    initSystem();
    
    // Listen for app state changes
    const unsubscribe = appState.addListener((newState) => {
      setAppCurrentState(newState);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-500' : 'text-red-500';
  };
  
  const getStatusIcon = (isActive: boolean) => {
    return isActive ? 
      <CheckCircle className="h-5 w-5 text-green-500" /> : 
      <AlertCircle className="h-5 w-5 text-red-500" />;
  };
  
  const getAppStateDetails = () => {
    switch (appCurrentState) {
      case AppState.INITIALIZING:
        return {
          color: 'bg-blue-500',
          icon: <Activity className="h-4 w-4" />,
          description: 'System is starting up'
        };
      case AppState.READY:
        return {
          color: 'bg-green-500',
          icon: <CheckCircle className="h-4 w-4" />,
          description: 'System is ready for operation'
        };
      case AppState.MONITORING:
        return {
          color: 'bg-blue-500',
          icon: <Activity className="h-4 w-4" />,
          description: 'Actively monitoring for opportunities'
        };
      case AppState.TRADING:
        return {
          color: 'bg-indigo-500',
          icon: <Zap className="h-4 w-4" />,
          description: 'Trading operations active'
        };
      case AppState.PAUSED:
        return {
          color: 'bg-yellow-500',
          icon: <AlertTriangle className="h-4 w-4" />,
          description: 'System temporarily paused'
        };
      case AppState.ERROR:
        return {
          color: 'bg-red-500',
          icon: <AlertCircle className="h-4 w-4" />,
          description: 'System encountered an error'
        };
      default:
        return {
          color: 'bg-gray-500',
          icon: <AlertCircle className="h-4 w-4" />,
          description: 'Unknown state'
        };
    }
  };
  
  const stateDetails = getAppStateDetails();
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!initialized ? (
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Initializing system...</div>
            <Progress value={33} className="h-2" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System State:</span>
              <Badge className={`${stateDetails.color} text-white`}>
                <span className="flex items-center">
                  {stateDetails.icon}
                  <span className="ml-1">{appCurrentState}</span>
                </span>
              </Badge>
            </div>
            
            <div className="text-xs text-slate-500 mb-2">{stateDetails.description}</div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium mb-1">Module Status:</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                  <span className="text-sm">AI Service</span>
                  {getStatusIcon(status.moduleStatuses.ai)}
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                  <span className="text-sm">Blockchain</span>
                  {getStatusIcon(status.moduleStatuses.blockchain)}
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                  <span className="text-sm">Price Monitoring</span>
                  {getStatusIcon(status.moduleStatuses.priceMonitoring)}
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                  <span className="text-sm">Trade Execution</span>
                  {getStatusIcon(status.moduleStatuses.tradeExecution)}
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                  <span className="text-sm">Smart Contracts</span>
                  {getStatusIcon(status.moduleStatuses.smartContracts)}
                </div>
              </div>
            </div>
            
            {appCurrentState === AppState.ERROR && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>System Error</AlertTitle>
                <AlertDescription>
                  One or more system components failed to initialize properly.
                  Check logs for more details or try refreshing the page.
                </AlertDescription>
              </Alert>
            )}
            
            {systemIntegration.canExecuteTrades() && (
              <Alert className="mt-4 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Ready for Trading</AlertTitle>
                <AlertDescription>
                  All required systems are online and ready for trade execution
                  {systemIntegration.isAIAssistanceAvailable() && " with AI assistance"}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemStatus;
