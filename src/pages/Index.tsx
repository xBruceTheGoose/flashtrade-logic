
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import GlassCard from '@/components/ui/GlassCard';
import { ArrowRight, Zap, RefreshCcw, BarChart2 } from 'lucide-react';

const Index = () => {
  const { wallet } = useWallet();
  const heroRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const animateHero = () => {
      if (heroRef.current) {
        heroRef.current.classList.add('animate-fade-in');
      }
    };
    
    // Slight delay for animation
    setTimeout(animateHero, 100);
  }, []);
  
  return (
    <div className="space-y-20 py-10">
      {/* Hero Section */}
      <section 
        ref={heroRef} 
        className="relative text-center py-16 md:py-28 opacity-0 transition-opacity"
      >
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#d6dbf380_1px,transparent_1px),linear-gradient(to_bottom,#d6dbf380_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        
        <div className="max-w-3xl mx-auto px-4">
          <div className="inline-block mb-6">
            <div className="flex items-center space-x-2 bg-secondary py-1 px-3 rounded-full text-sm">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>Execute flashloan-funded arbitrage trades across DEXes</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700">
            AI-Powered Arbitrage Trading
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Harness the power of flashloans and AI to execute profitable arbitrage trades across decentralized exchanges.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button asChild size="lg" className="px-8 py-6 text-lg">
              <Link to="/dashboard">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="px-8 py-6 text-lg">
              <a href="#features">
                Learn More
              </a>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Why Choose FlashTrade</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our advanced platform provides everything you need to capitalize on DEX arbitrage opportunities.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
          <GlassCard className="animate-slide-up" style={{animationDelay: '0ms'}}>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Flashloan Integration</h3>
            <p className="text-muted-foreground">
              Execute large arbitrage trades without needing upfront capital using flashloans.
            </p>
          </GlassCard>
          
          <GlassCard className="animate-slide-up" style={{animationDelay: '150ms'}}>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
              <RefreshCcw className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-DEX Support</h3>
            <p className="text-muted-foreground">
              Connect to multiple DEXes simultaneously to find the best arbitrage opportunities.
            </p>
          </GlassCard>
          
          <GlassCard className="animate-slide-up" style={{animationDelay: '300ms'}}>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
              <BarChart2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Real-time Monitoring</h3>
            <p className="text-muted-foreground">
              Track your transactions and profits with detailed analytics and reporting.
            </p>
          </GlassCard>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16">
        <GlassCard className="max-w-4xl mx-auto text-center py-16">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Trading?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect your wallet and start capitalizing on DEX arbitrage opportunities today.
          </p>
          
          <Button asChild size="lg" className="px-8 py-6 text-lg">
            <Link to="/dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </GlassCard>
      </section>
    </div>
  );
};

export default Index;
