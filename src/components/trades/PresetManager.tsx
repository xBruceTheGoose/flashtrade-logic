
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Save, Trash2, AlertTriangle, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { sanitizeStringInput, secureLocalStorage } from '@/utils/validation';
import { MAX_CONFIGS } from '@/utils/arbitrage/constants';

interface Preset {
  id: string;
  name: string;
  config: any; // In a real app, we'd have a stronger type
  timestamp: number;
}

interface PresetManagerProps {
  configName: string;
  setConfigName: (name: string) => void;
  onSave: () => void;
  disabled?: boolean;
  currentConfig?: any; // Current configuration to save
}

const PresetManager = ({ 
  configName, 
  setConfigName, 
  onSave, 
  disabled = false,
  currentConfig = {}
}: PresetManagerProps) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved presets from secure storage
  useEffect(() => {
    try {
      const savedPresets = secureLocalStorage.getItem<Preset[]>('trade_config_presets', []);
      setPresets(savedPresets);
      setError(null);
    } catch (err: any) {
      console.error('Error loading presets:', err);
      setError('Failed to load saved configurations');
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      // Validate preset data before using it
      if (!preset.name || !preset.config) {
        toast({
          title: 'Invalid Preset',
          description: 'The selected preset appears to be corrupted',
          variant: 'destructive'
        });
        return;
      }
      
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
    
    // Sanitize name to prevent security issues
    const sanitizedName = sanitizeStringInput(configName, 50);
    
    // Check if we've reached the maximum number of presets
    if (presets.length >= MAX_CONFIGS && !presets.some(p => p.name === sanitizedName)) {
      toast({
        title: 'Preset Limit Reached',
        description: `You can save a maximum of ${MAX_CONFIGS} presets. Please delete one first.`,
        variant: 'destructive'
      });
      return;
    }
    
    // Create new preset or update existing
    const existingIndex = presets.findIndex(p => p.name === sanitizedName);
    const newPreset: Preset = {
      id: existingIndex >= 0 ? presets[existingIndex].id : Date.now().toString(),
      name: sanitizedName,
      config: currentConfig,
      timestamp: Date.now()
    };
    
    try {
      let updatedPresets: Preset[];
      
      if (existingIndex >= 0) {
        // Update existing preset
        updatedPresets = [...presets];
        updatedPresets[existingIndex] = newPreset;
        
        toast({
          title: 'Preset Updated',
          description: `Configuration "${sanitizedName}" has been updated`
        });
      } else {
        // Add new preset
        updatedPresets = [...presets, newPreset];
        
        toast({
          title: 'Preset Saved',
          description: `Configuration "${sanitizedName}" has been saved`
        });
      }
      
      setPresets(updatedPresets);
      secureLocalStorage.setItem('trade_config_presets', updatedPresets);
      
      // Call the onSave function passed from parent
      onSave();
      
      setShowNewPreset(false);
    } catch (err) {
      console.error('Error saving preset:', err);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive'
      });
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;
    
    try {
      const preset = presets.find(p => p.id === selectedPreset);
      if (preset) {
        const updatedPresets = presets.filter(p => p.id !== selectedPreset);
        setPresets(updatedPresets);
        secureLocalStorage.setItem('trade_config_presets', updatedPresets);
        
        toast({
          title: 'Preset Deleted',
          description: `Configuration "${preset.name}" has been deleted`
        });
        
        setSelectedPreset('');
      }
    } catch (err) {
      console.error('Error deleting preset:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete configuration',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 w-full">
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2">Loading configurations...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 w-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Label className="font-medium">Configuration Presets</Label>
            <Shield className="h-4 w-4 ml-2 text-blue-500" title="Securely stored configurations" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewPreset(!showNewPreset)}
            disabled={disabled}
          >
            {showNewPreset ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> New Preset</>}
          </Button>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded-md text-sm flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {error}
          </div>
        )}
        
        {showNewPreset ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={configName}
                onChange={(e) => setConfigName(sanitizeStringInput(e.target.value, 50))}
                placeholder="Enter configuration name"
                disabled={disabled}
                maxLength={50}
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Maximum 50 characters</span>
                <span>{configName.length}/50</span>
              </div>
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
                disabled={disabled || presets.length === 0}
              >
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder={presets.length === 0 ? "No saved presets" : "Select a preset configuration"} />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(preset => (
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
        
        {presets.length >= MAX_CONFIGS && (
          <div className="text-amber-600 text-xs flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1" />
            <span>Maximum number of presets reached ({MAX_CONFIGS})</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PresetManager;
