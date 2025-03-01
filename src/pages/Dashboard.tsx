
import { useEffect } from 'react';
import DEXPanel from '@/components/DEXPanel';
import ArbitragePanel from '@/components/ArbitragePanel';
import TransactionMonitor from '@/components/TransactionMonitor';
import { useWallet } from '@/hooks/useWallet';

const Dashboard = () => {
  const { wallet } = useWallet();
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          {wallet?.connected ? (
            <span className="text-green-600 dark:text-green-400">Connected</span>
          ) : (
            <span className="text-yellow-600 dark:text-yellow-400">Wallet not connected</span>
          )}
        </div>
      </div>
      
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <DEXPanel />
        </div>
        
        <div className="lg:col-span-5">
          <ArbitragePanel />
        </div>
        
        <div className="lg:col-span-4">
          <TransactionMonitor />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
