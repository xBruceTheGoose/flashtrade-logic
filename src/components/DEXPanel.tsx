
import { useState, useEffect } from 'react';
import GlassCard from './ui/GlassCard';
import { Badge } from '@radix-ui/react-toast';
import { DEX } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, Settings } from 'lucide-react';

const DEXPanel = () => {
  const { wallet } = useWallet();
  const [dexes, setDexes] = useState<DEX[]>(availableDEXes);
  const [loading, setLoading] = useState(false);

  const toggleDEX = (id: string) => {
    setDexes(prev => 
      prev.map(dex => 
        dex.id === id 
          ? { ...dex, active: !dex.active } 
          : dex
      )
    );
  };

  const refreshDEXes = async () => {
    setLoading(true);
    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">DEX Selection</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={refreshDEXes} 
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <div className="grid gap-4">
        {dexes.map((dex) => (
          <div 
            key={dex.id} 
            className="flex items-center justify-between p-3 rounded-md bg-background/50 border border-border/50"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-3">
                {/* Placeholder for DEX logo */}
                <span className="text-xs font-bold">{dex.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="font-medium">{dex.name}</h3>
                <Badge 
                  variant={dex.active ? "secondary" : "default"}
                  className={dex.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs px-2 py-0.5" : "text-xs px-2 py-0.5"}
                >
                  {dex.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <Switch 
              checked={dex.active} 
              onCheckedChange={() => toggleDEX(dex.id)}
              disabled={!wallet?.connected}
            />
          </div>
        ))}
      </div>
      
      {!wallet?.connected && (
        <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          Connect your wallet to activate and configure DEXes
        </div>
      )}
      
      <div className="mt-auto pt-4">
        <Button variant="outline" className="w-full" disabled={!wallet?.connected}>
          <Settings className="h-4 w-4 mr-2" />
          Advanced Configuration
        </Button>
      </div>
    </GlassCard>
  );
};

export default DEXPanel;
