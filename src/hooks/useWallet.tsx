
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { WalletInfo, WalletType } from '@/types';
import { connectWallet, disconnectWallet, isWalletConnected } from '@/utils/wallet';
import { toast } from '@/components/ui/use-toast';

type WalletContextType = {
  wallet: WalletInfo | null;
  connecting: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if wallet is already connected (e.g. from localStorage)
    const checkWalletConnection = async () => {
      try {
        const connected = isWalletConnected();
        if (connected) {
          // In a real implementation, we would restore the connection here
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    };

    checkWalletConnection();
  }, []);

  const connect = async (type: WalletType) => {
    if (connecting) return;
    
    try {
      setConnecting(true);
      setError(null);
      
      const walletInfo = await connectWallet(type);
      setWallet(walletInfo);
      
      toast({
        title: 'Wallet Connected',
        description: `Connected to ${walletInfo.address}`,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      
      toast({
        title: 'Connection Failed',
        description: err.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectWallet();
      setWallet(null);
      
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect wallet');
      
      toast({
        title: 'Disconnection Failed',
        description: err.message || 'Failed to disconnect wallet',
        variant: 'destructive',
      });
    }
  };

  return (
    <WalletContext.Provider value={{ wallet, connecting, connect, disconnect, error }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
