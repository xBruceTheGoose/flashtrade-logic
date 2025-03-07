import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import ArbitragePanel from "@/components/ArbitragePanel";
import PriceMonitoringPanel from "@/components/PriceMonitoringPanel";
import { Activity, AlertTriangle, BookText, ChevronRight, Cpu, LayoutDashboard, LineChart, Settings, Zap } from "lucide-react";
import SystemStatus from "@/components/system/SystemStatus";
import Documentation from "@/components/system/Documentation";
import { useWallet } from "@/hooks/useWallet";

const Index = () => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const isWalletConnected = wallet?.connected || false;

  return (
    <div className="container mx-auto p-4 pb-16 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-md h-full">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                Crypto Arbitrage Trading Platform
              </CardTitle>
              <CardDescription>
                Automated trading system with AI-powered strategy optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Identify and execute profitable arbitrage opportunities across multiple
                decentralized exchanges with advanced monitoring, AI-powered strategy optimization,
                and automated execution capabilities.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card className="bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md flex items-center">
                      <Activity className="h-4 w-4 mr-2" />
                      Price Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    Track prices across DEXes in real-time and detect arbitrage opportunities automatically.
                  </CardContent>
                </Card>
                
                <Card className="bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md flex items-center">
                      <Zap className="h-4 w-4 mr-2" />
                      Trading Execution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    Execute trades manually or automatically with customizable risk parameters.
                  </CardContent>
                </Card>
                
                <Card className="bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md flex items-center">
                      <Cpu className="h-4 w-4 mr-2" />
                      AI Optimization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    Leverage AI to optimize trading strategies based on market conditions and performance data.
                  </CardContent>
                </Card>
                
                <Card className="bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md flex items-center">
                      <LineChart className="h-4 w-4 mr-2" />
                      Performance Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    Track trading performance with detailed analytics and improvement recommendations.
                  </CardContent>
                </Card>
              </div>
              
              {!isWalletConnected && (
                <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-900 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Connect Wallet</AlertTitle>
                  <AlertDescription>
                    Connect your wallet to start using the platform features.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/dashboard')} className="flex items-center">
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Go to Dashboard
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              
              <Button variant="outline" onClick={() => navigate('/settings')} className="flex items-center">
                <Settings className="mr-1 h-4 w-4" />
                Configure Settings
              </Button>
              
              <Button variant="secondary" className="flex items-center ml-auto">
                <BookText className="mr-1 h-4 w-4" />
                View Tutorials
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <SystemStatus />
        </div>
      </div>
      
      <Tabs defaultValue="documentation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
          <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="documentation" className="space-y-4">
          <Documentation />
        </TabsContent>
        
        <TabsContent value="arbitrage" className="space-y-4">
          <ArbitragePanel />
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          <PriceMonitoringPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
