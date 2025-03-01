
import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import { WalletProvider } from '@/hooks/useWallet';
import { ScrollArea } from '@/components/ui/scroll-area';

const DashboardLayout = () => {
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
