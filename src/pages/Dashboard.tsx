
import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ArbitrageOpportunitiesPanel from '@/components/dashboard/ArbitrageOpportunitiesPanel';
import PerformancePanel from '@/components/dashboard/PerformancePanel';
import TradingHistoryPanel from '@/components/dashboard/TradingHistoryPanel';
import WalletPanel from '@/components/dashboard/WalletPanel';
import StrategyRecommendationsPanel from '@/components/dashboard/StrategyRecommendationsPanel';
import AIStrategyDashboard from '@/components/dashboard/AIStrategyDashboard';
import { Activity, AlertOctagon, Cpu, LineChart, History } from 'lucide-react';
import SystemStatus from '@/components/system/SystemStatus';
import { useWallet } from '@/hooks/useWallet';

const Dashboard = () => {
  const { wallet } = useWallet();
  const isConnected = wallet?.connected || false;

  return (
    <div className="container mx-auto p-4 pb-16 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">Trading Dashboard</CardTitle>
              <CardDescription>
                Monitor performance and manage trading activities
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="md:col-span-1">
          <SystemStatus />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Tabs defaultValue="opportunities" className="space-y-4">
            <TabsList>
              <TabsTrigger value="opportunities" className="flex items-center">
                <Activity className="mr-1 h-4 w-4" />
                Opportunities
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center">
                <History className="mr-1 h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center">
                <LineChart className="mr-1 h-4 w-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center">
                <Cpu className="mr-1 h-4 w-4" />
                AI Strategy
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities" className="space-y-4">
              <ArbitrageOpportunitiesPanel />
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <TradingHistoryPanel />
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <PerformancePanel />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <AIStrategyDashboard />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <WalletPanel />
          
          <Card className="shadow-md overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <AlertOctagon className="mr-2 h-5 w-5" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <div className="p-4">
              {isConnected ? (
                <ul className="space-y-2">
                  <li className="text-sm py-2 px-3 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                    System operating normally
                  </li>
                </ul>
              ) : (
                <div className="text-sm py-2 px-3 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-md">
                  Connect wallet to view alerts
                </div>
              )}
            </div>
          </Card>
          
          <StrategyRecommendationsPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
