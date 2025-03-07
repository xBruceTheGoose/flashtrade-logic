
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book, FileText, HelpCircle, MessageSquare, BookOpen, Code } from 'lucide-react';

const Documentation = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <Book className="mr-2 h-5 w-5" />
          Documentation & Guides
        </CardTitle>
        <CardDescription>
          Learn how to use the arbitrage trading platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="overview">
              <FileText className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="guides">
              <BookOpen className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Guides</span>
            </TabsTrigger>
            <TabsTrigger value="api">
              <Code className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">API</span>
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">FAQ</span>
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <TabsContent value="overview" className="space-y-4">
              <h3 className="text-lg font-medium">Arbitrage Trading Platform</h3>
              <p>
                This platform enables users to identify and execute arbitrage opportunities
                across multiple decentralized exchanges (DEXes) with AI-powered optimization.
              </p>
              
              <h4 className="text-md font-medium mt-4">Key Features</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Real-time price monitoring across multiple DEXes</li>
                <li>Automated arbitrage opportunity detection</li>
                <li>AI-powered trade evaluation and optimization</li>
                <li>Flashloan integration for capital-efficient trading</li>
                <li>Advanced risk management and circuit breakers</li>
                <li>Performance analytics and strategy recommendations</li>
              </ul>
              
              <h4 className="text-md font-medium mt-4">System Architecture</h4>
              <p>
                The platform consists of several integrated modules:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Price Monitoring:</strong> Tracks prices across DEXes</li>
                <li><strong>Arbitrage Detection:</strong> Identifies profitable opportunities</li>
                <li><strong>Trade Execution:</strong> Manages the execution of trades</li>
                <li><strong>AI Service:</strong> Optimizes strategies and evaluates trades</li>
                <li><strong>Blockchain Service:</strong> Handles blockchain interactions</li>
              </ul>
            </TabsContent>
            
            <TabsContent value="guides" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="getting-started">
                  <AccordionTrigger>Getting Started Guide</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <h4 className="font-medium">1. Connect Your Wallet</h4>
                      <p className="text-sm">
                        Click the "Connect Wallet" button in the top right corner to connect
                        your Ethereum wallet (MetaMask, WalletConnect, etc.).
                      </p>
                      
                      <h4 className="font-medium mt-3">2. Configure Trading Parameters</h4>
                      <p className="text-sm">
                        Go to the "Settings" tab to configure your trading parameters like
                        slippage tolerance, maximum trade size, and gas price strategy.
                      </p>
                      
                      <h4 className="font-medium mt-3">3. Start Price Monitoring</h4>
                      <p className="text-sm">
                        Navigate to the "Monitoring" tab and click "Start Monitoring" to begin
                        tracking prices and detecting arbitrage opportunities.
                      </p>
                      
                      <h4 className="font-medium mt-3">4. Execute Trades</h4>
                      <p className="text-sm">
                        When opportunities are detected, you can execute them manually or enable
                        auto-execution in the settings.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="arbitrage-tutorial">
                  <AccordionTrigger>Arbitrage Trading Tutorial</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <h4 className="font-medium">Understanding Arbitrage Opportunities</h4>
                      <p className="text-sm">
                        Arbitrage opportunities occur when the same asset is priced differently
                        across different markets. This platform automatically detects these price
                        differences between DEXes and calculates potential profit.
                      </p>
                      
                      <h4 className="font-medium mt-3">Evaluating Risk</h4>
                      <p className="text-sm">
                        Each opportunity has an associated risk level. Consider factors like:
                      </p>
                      <ul className="list-disc pl-5 text-sm">
                        <li>Gas costs</li>
                        <li>Market volatility</li>
                        <li>Slippage potential</li>
                        <li>Network congestion</li>
                      </ul>
                      
                      <h4 className="font-medium mt-3">Using Flashloans</h4>
                      <p className="text-sm">
                        Flashloans allow you to execute arbitrage without significant upfront capital.
                        The platform can automatically use flashloans when needed, or you can configure
                        this behavior in settings.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="ai-optimization">
                  <AccordionTrigger>AI Optimization Guide</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <h4 className="font-medium">Setting Up AI Assistance</h4>
                      <p className="text-sm">
                        The AI system requires an API key to be set in the Settings page.
                        Once configured, the AI will analyze opportunities and provide
                        recommendations.
                      </p>
                      
                      <h4 className="font-medium mt-3">Strategy Optimization</h4>
                      <p className="text-sm">
                        The AI continuously analyzes your trading history and market conditions
                        to suggest parameter adjustments that can improve performance.
                      </p>
                      
                      <h4 className="font-medium mt-3">Risk Assessment</h4>
                      <p className="text-sm">
                        For each opportunity, the AI evaluates factors like:
                      </p>
                      <ul className="list-disc pl-5 text-sm">
                        <li>Historical price stability of tokens</li>
                        <li>DEX liquidity depth</li>
                        <li>Network congestion patterns</li>
                        <li>Estimated slippage based on trade size</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
            
            <TabsContent value="api" className="space-y-4">
              <h3 className="text-lg font-medium">API Documentation</h3>
              <p className="text-sm">
                The platform exposes several service APIs that you can use programmatically:
              </p>
              
              <div className="space-y-4 mt-4">
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Price Monitoring API</h4>
                  <code className="block bg-slate-100 dark:bg-slate-800 p-2 rounded mt-2 text-xs">
                    priceMonitoringService.startMonitoring()<br />
                    priceMonitoringService.stopMonitoring()<br />
                    priceMonitoringService.addPairToMonitor(tokenA, tokenB)<br />
                    priceMonitoringService.getPendingOpportunities()
                  </code>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Trade Execution API</h4>
                  <code className="block bg-slate-100 dark:bg-slate-800 p-2 rounded mt-2 text-xs">
                    tradeExecutor.executeTrade(opportunity, options)<br />
                    tradeExecutor.autoExecuteTrade(opportunity)<br />
                    tradeExecutor.updateExecutionConfig(config)<br />
                    tradeExecutor.getExecutionRecords()
                  </code>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">AI Service API</h4>
                  <code className="block bg-slate-100 dark:bg-slate-800 p-2 rounded mt-2 text-xs">
                    aiService.evaluateArbitrageOpportunity(opportunityData)<br />
                    aiService.generateStrategyRecommendations(analysisData)<br />
                    aiService.predictSlippage(tradeData)<br />
                    aiService.setApiKey(apiKey)
                  </code>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">System Integration API</h4>
                  <code className="block bg-slate-100 dark:bg-slate-800 p-2 rounded mt-2 text-xs">
                    systemIntegration.initialize()<br />
                    systemIntegration.processOpportunityWithAI(opportunityId)<br />
                    systemIntegration.getSystemStatus()<br />
                    systemIntegration.canExecuteTrades()
                  </code>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="faq" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="faq-1">
                  <AccordionTrigger>What is arbitrage trading?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      Arbitrage trading is the practice of taking advantage of price differences
                      for the same asset in different markets. You buy the asset at a lower price
                      in one market and sell it at a higher price in another market, pocketing the
                      difference as profit.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="faq-2">
                  <AccordionTrigger>How much capital do I need to start?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      With flashloan functionality, you can execute arbitrage trades with minimal
                      upfront capital. However, you'll need some ETH to cover gas fees for transactions.
                      Without flashloans, the capital required depends on the size of the opportunities
                      you want to target.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="faq-3">
                  <AccordionTrigger>Is arbitrage trading risk-free?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      While arbitrage is often considered lower risk than other trading strategies,
                      it is not risk-free. Risks include market movement between trade execution,
                      transaction failures, slippage, and gas costs exceeding profits. The platform's
                      risk management features and AI evaluation help mitigate these risks.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="faq-4">
                  <AccordionTrigger>What are circuit breakers?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      Circuit breakers are safety mechanisms that automatically stop trading
                      when certain conditions are met. For example, if several consecutive trades
                      fail, or if price deviations exceed expected thresholds. These prevent
                      potential losses during unusual market conditions.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="faq-5">
                  <AccordionTrigger>Do I need the AI features to use the platform?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      No, the AI features are optional. The platform will function without AI
                      assistance, but enabling AI can help optimize your trading parameters
                      and evaluate opportunities more effectively.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Documentation;
