
import React, { useEffect, useState } from 'react';
import StrategyRecommendationsPanel from './StrategyRecommendationsPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { 
  Brain, 
  Key,
  AlertTriangle, 
  CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { aiService } from '@/utils/ai/aiService';
import { getAIConfig } from '@/utils/ai/config';

const AIStrategyDashboard = () => {
  const [apiKey, setApiKey] = useState('');
  const [isKeyValid, setIsKeyValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  useEffect(() => {
    // Check if AI service is already configured
    const config = getAIConfig();
    if (config.apiKey) {
      setIsConfigured(aiService.isInitializedAndReady());
    }
  }, []);
  
  const validateKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }
    
    setIsChecking(true);
    
    try {
      const isValid = await aiService.validateApiKey(apiKey);
      setIsKeyValid(isValid);
      
      if (isValid) {
        // Save the API key
        aiService.setApiKey(apiKey);
        setIsConfigured(true);
        
        toast({
          title: "API Key Validated",
          description: "Your API key has been saved and validated",
        });
      } else {
        toast({
          title: "Invalid API Key",
          description: "The API key could not be validated",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      setIsKeyValid(false);
      
      toast({
        title: "Validation Error",
        description: "An error occurred while validating the API key",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  if (!isConfigured) {
    return (
      <div className="bg-background/60 backdrop-blur-md border rounded-lg p-6 flex flex-col items-center">
        <Brain className="h-12 w-12 mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">AI Strategy Optimization</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-lg">
          Set up AI-powered strategy optimization to analyze your trade history, 
          optimize parameters, and make intelligent recommendations.
        </p>
        
        <div className="flex flex-col w-full max-w-md gap-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              Coinbase API Key
            </label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Coinbase API key"
                className="flex-grow"
              />
              <Button onClick={validateKey} disabled={isChecking}>
                {isChecking ? "Validating..." : "Validate"}
              </Button>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Don't have an API key?
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Get a Coinbase API Key</AlertDialogTitle>
                <AlertDialogDescription>
                  To use AI Strategy Optimization, you need a Coinbase API key with the required permissions.
                  Follow these steps to obtain your API key:
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <p className="text-sm">
                    Log in to your Coinbase account and navigate to Settings &gt; API.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <p className="text-sm">
                    Create a new API key with "Read" permissions.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <p className="text-sm">
                    Copy the API key and enter it here in the application.
                  </p>
                </div>
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Your API key is stored locally on your device and never shared with any third parties.
                    It's only used to access Coinbase's AI capabilities.
                  </p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <a 
                    href="https://www.coinbase.com/settings/api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
                  >
                    Go to Coinbase
                  </a>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }
  
  return (
    <Tabs defaultValue="recommendations" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="recommendations">
          <Brain className="h-4 w-4 mr-2" />
          Strategy Recommendations
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="recommendations" className="mt-0">
        <StrategyRecommendationsPanel />
      </TabsContent>
    </Tabs>
  );
};

export default AIStrategyDashboard;
