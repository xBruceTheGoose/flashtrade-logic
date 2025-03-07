
import { useEffect, useState } from 'react';
import { systemIntegration } from '@/utils/integration/systemIntegration';
import { appState, AppState } from '@/utils/integration/stateManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, AlertTriangle, Activity, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SystemStatus = () => {
  const [status, setStatus] = useState(systemIntegration.getSystemStatus());
  const [appCurrentState, setAppCurrentState] = useState(appState.getState());
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  
  const initSystem = async () => {
    setInitializing(true);
    try {
      const success = await systemIntegration.initialize();
      setStatus(systemIntegration.getSystemStatus());
      setInitialized(true);
      
      // Update app state based on initialization result
      if (success) {
        appState.setState(AppState.READY);
      } else if (status.moduleStatuses.ai) {
        // If AI is available but blockchain failed, we can still operate in limited mode
        appState.setState(AppState.PAUSED);
      } else {
        appState.setState(AppState.ERROR);
      }
    } catch (error) {
      console.error("Error initializing system:", error);
    } finally {
      setInitializing(false);
    }
  };
  
  useEffect(() => {
    // Initialize system on component mount
    initSystem();
    
    // Listen for app state changes
    const unsubscribe = appState.addListener((newState) => {
      setAppCurrentState(newState);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Update status when app state changes
  useEffect(() => {
    setStatus(systemIntegration.getSystemStatus());
  }, [appCurrentState]);
  
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
  
  const handleRetry = () => {
    initSystem();
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {initializing ? (
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
                  {status.errors.blockchain && (
                    <div className="mt-2 text-sm">
                      <strong>Blockchain Error:</strong> {status.errors.blockchain}
                    </div>
                  )}
                  {status.errors.general && (
                    <div className="mt-2 text-sm">
                      <strong>Error:</strong> {status.errors.general}
                    </div>
                  )}
                  <Button 
                    onClick={handleRetry} 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry Connection
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {appCurrentState === AppState.PAUSED && (
              <Alert className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-900 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Limited Functionality</AlertTitle>
                <AlertDescription>
                  Some system components are unavailable. 
                  {status.errors.blockchain && (
                    <div className="mt-2 text-sm">
                      Blockchain connectivity issue: {status.errors.blockchain}
                    </div>
                  )}
                  {systemIntegration.isAIAssistanceAvailable() && (
                    <div className="mt-2 text-sm">
                      AI assistance is still available.
                    </div>
                  )}
                  <Button 
                    onClick={handleRetry} 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry Connection
                  </Button>
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
