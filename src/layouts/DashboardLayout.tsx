
import { ReactNode, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import { WalletProvider } from '@/hooks/useWallet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/toaster';

const DashboardLayout = () => {
  // Add global event listeners for wallet status changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'flashtrade_wallet') {
        console.log('Wallet storage changed in another tab');
        // If needed, we could sync wallet state across tabs here
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <ScrollArea className="flex-grow">
          <main className="pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
            <Outlet />
          </main>
        </ScrollArea>
        <footer className="p-4 text-center text-sm text-muted-foreground border-t">
          <p>FlashTrade &copy; {new Date().getFullYear()} - Powered by AI</p>
        </footer>
      </div>
    </WalletProvider>
  );
};

export default DashboardLayout;
