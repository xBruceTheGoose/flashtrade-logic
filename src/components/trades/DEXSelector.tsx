
import { DEX } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface DEXSelectorProps {
  selectedDexes: string[];
  setSelectedDexes: (dexes: string[]) => void;
  disabled?: boolean;
}

const DEXSelector = ({ selectedDexes, setSelectedDexes, disabled = false }: DEXSelectorProps) => {
  const handleDexToggle = (dexId: string) => {
    if (selectedDexes.includes(dexId)) {
      setSelectedDexes(selectedDexes.filter(id => id !== dexId));
    } else {
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
    </div>
  );
};

export default DEXSelector;
