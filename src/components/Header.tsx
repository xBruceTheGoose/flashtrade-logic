
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, Home, BarChart2, Menu, X } from 'lucide-react';
import WalletConnect from './WalletConnect';
import { useIsMobile } from '@/hooks/use-mobile';

const Header = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Close mobile menu when route changes
    setIsOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Home', icon: <Home className="h-4 w-4 mr-2" /> },
    { path: '/dashboard', label: 'Dashboard', icon: <BarChart2 className="h-4 w-4 mr-2" /> },
    { path: '/settings', label: 'Settings', icon: <Settings className="h-4 w-4 mr-2" /> },
  ];

  return (
    <header 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 py-4 px-6 transition-all duration-300',
        'glass-effect',
        scrolled ? 'shadow-sm backdrop-blur-md' : 'backdrop-blur-xs'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="text-2xl font-bold text-primary flex items-center">
            <svg 
              className="w-8 h-8 mr-2" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M8 14L12 10L16 14" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M8 18L12 14L16 18" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            FlashTrade
          </Link>
        </div>
        
        {isMobile ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            
            {isOpen && (
              <div className="absolute top-full left-0 right-0 glass-effect p-4 shadow-md animate-fade-in">
                <nav className="flex flex-col space-y-2">
                  {navItems.map((item) => (
                    <Link 
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center px-4 py-2 rounded-md transition-colors',
                        isActive(item.path)
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-secondary'
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-4">
                  <WalletConnect />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-1 mr-4">
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-secondary'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
            <WalletConnect />
          </div>
        )}
      </div>
    </header>
  );
};

// Helper function from lib/utils.ts to avoid import issues
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default Header;
