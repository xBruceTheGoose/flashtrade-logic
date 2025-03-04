
import { useState, useEffect } from 'react';
import { DEX } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle } from 'lucide-react';
import { MAX_CONFIGS } from '@/utils/arbitrage/constants';
import { toast } from '@/hooks/use-toast';

interface DEXSelectorProps {
  selectedDexes: string[];
  setSelectedDexes: (dexes: string[]) => void;
  disabled?: boolean;
}

const DEXSelector = ({ selectedDexes, setSelectedDexes, disabled = false }: DEXSelectorProps) => {
  const [validDexIds, setValidDexIds] = useState<Set<string>>(new Set());

  // Validate available DEXes on mount
  useEffect(() => {
    // Create a set of valid DEX IDs for faster lookup
    const validIds = new Set(availableDEXes.map(dex => dex.id));
    setValidDexIds(validIds);
    
    // Filter out any invalid DEXes from the initial selection
    const validSelected = selectedDexes.filter(id => validIds.has(id));
    if (validSelected.length !== selectedDexes.length) {
      console.warn('Invalid DEX IDs detected in selection, filtering them out');
      setSelectedDexes(validSelected);
    }
  }, [availableDEXes]);

  const handleDexToggle = (dexId: string) => {
    // Validate DEX ID
    if (!validDexIds.has(dexId)) {
      console.error(`Attempted to toggle invalid DEX ID: ${dexId}`);
      toast({
        title: "Security Warning",
        description: "Invalid DEX identifier detected",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedDexes.includes(dexId)) {
      setSelectedDexes(selectedDexes.filter(id => id !== dexId));
    } else {
      // Check if we're exceeding the maximum allowed configurations
      if (selectedDexes.length >= MAX_CONFIGS) {
        toast({
          title: "Limit Reached",
          description: `You can monitor a maximum of ${MAX_CONFIGS} DEXes at once`,
          variant: "destructive"
        });
        return;
      }
      setSelectedDexes([...selectedDexes, dexId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">DEXes to Monitor</div>
      <div className="grid grid-cols-1 gap-2">
        {availableDEXes.map(dex => (
          <Card 
            key={dex.id} 
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-3">
                <span className="text-xs font-bold">{dex.name.charAt(0)}</span>
              </div>
              <div>
                <div className="font-medium">{dex.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedDexes.includes(dex.id) ? 'Monitoring enabled' : 'Not monitoring'}
                </div>
              </div>
            </div>
            <Switch 
              checked={selectedDexes.includes(dex.id)} 
              onCheckedChange={() => handleDexToggle(dex.id)}
              disabled={disabled}
            />
          </Card>
        ))}
      </div>
      
      <div className="text-xs text-muted-foreground mt-2">
        Enable DEXes to monitor for arbitrage opportunities. More DEXes may increase the likelihood of finding opportunities but will use more resources.
      </div>
      
      {selectedDexes.length === 0 && (
        <div className="text-yellow-600 text-xs flex items-center mt-2">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>At least one DEX should be selected for monitoring</span>
        </div>
      )}
    </div>
  );
};

export default DEXSelector;
