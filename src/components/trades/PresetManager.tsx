
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PresetManagerProps {
  configName: string;
  setConfigName: (name: string) => void;
  onSave: () => void;
  disabled?: boolean;
}

// Mock saved presets for demonstration
const mockPresets = [
  { id: '1', name: 'Conservative Trading' },
  { id: '2', name: 'Aggressive Strategy' },
  { id: '3', name: 'Weekend Only' }
];

const PresetManager = ({ configName, setConfigName, onSave, disabled = false }: PresetManagerProps) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showNewPreset, setShowNewPreset] = useState(false);

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = mockPresets.find(p => p.id === presetId);
    if (preset) {
      setConfigName(preset.name);
      // In a real app, we'd load the preset configuration here
      toast({
        title: 'Preset Loaded',
        description: `Loaded configuration: ${preset.name}`
      });
    }
  };

  const handleSavePreset = () => {
    if (!configName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your configuration',
        variant: 'destructive'
      });
      return;
    }
    
    // Call the onSave function passed from parent
    onSave();
    
    // In a real app, we'd save the new preset here
    toast({
      title: 'Preset Saved',
      description: `Configuration "${configName}" has been saved`
    });
    
    setShowNewPreset(false);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;
    
    const preset = mockPresets.find(p => p.id === selectedPreset);
    if (preset) {
      // In a real app, we'd delete the preset here
      toast({
        title: 'Preset Deleted',
        description: `Configuration "${preset.name}" has been deleted`
      });
      setSelectedPreset('');
    }
  };

  return (
    <Card className="p-4 w-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Configuration Presets</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewPreset(!showNewPreset)}
            disabled={disabled}
          >
            {showNewPreset ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> New Preset</>}
          </Button>
        </div>
        
        {showNewPreset ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Enter configuration name"
                disabled={disabled}
              />
            </div>
            <Button
              onClick={handleSavePreset}
              disabled={disabled || !configName.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-1" />
              Save as Preset
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="preset-select" className="text-xs">Load Preset</Label>
              <Select
                value={selectedPreset}
                onValueChange={handlePresetSelect}
                disabled={disabled}
              >
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Select a preset configuration" />
                </SelectTrigger>
                <SelectContent>
                  {mockPresets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDeletePreset}
              disabled={disabled || !selectedPreset}
              title="Delete selected preset"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PresetManager;
