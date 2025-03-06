
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, BarChart2, Settings, Menu, X, BarChart3 } from 'lucide-react';
import WalletConnect from './WalletConnect';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const Header = () => {
  const { pathname } = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const routes = [
    { path: "/", label: "Home" },
    { path: "/dashboard", label: "Dashboard", icon: <BarChart2 className="h-4 w-4 mr-2" /> },
    { path: "/monitoring", label: "Monitoring", icon: <BarChart3 className="h-4 w-4 mr-2" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="h-4 w-4 mr-2" /> },
  ];

  const NavItems = () => (
    <>
      {routes.map((route) => (
        <Link key={route.path} to={route.path}>
          <Button
            variant={isActive(route.path) ? "default" : "ghost"}
            className="flex items-center"
            onClick={() => setIsMenuOpen(false)}
          >
            {route.icon}
            {route.label}
          </Button>
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            <span className="text-xl font-bold">ArbiTrade</span>
          </Link>
        </div>

        {isMobile ? (
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-4 pt-12">
              <NavItems />
              <div className="mt-auto">
                <WalletConnect />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <nav className="flex items-center gap-2">
            <NavItems />
            <WalletConnect />
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
