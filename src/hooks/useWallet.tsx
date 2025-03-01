
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { WalletInfo, WalletType } from '@/types';
import { 
  connectWallet, 
  disconnectWallet, 
  isWalletConnected, 
  getWalletFromStorage,
  refreshWalletInfo,
  switchNetwork as switchNetworkUtil,
  getNetworkName,
  isSupportedNetwork
} from '@/utils/wallet';
import { toast } from '@/components/ui/use-toast';

type WalletContextType = {
  wallet: WalletInfo | null;
  connecting: boolean;
  refreshing: boolean;
  networkName: string | null;
  isCorrectNetwork: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  error: string | null;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  // Check if wallet is connected on initial load
  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        const connected = isWalletConnected();
        if (connected) {
          const storedWallet = getWalletFromStorage();
          if (storedWallet) {
            console.log('Restored wallet connection from storage', storedWallet);
            setWallet(storedWallet);
            
            // Check if on supported network
            if (storedWallet.type && storedWallet.chainId) {
              const supported = isSupportedNetwork(storedWallet.type, storedWallet.chainId);
              setIsCorrectNetwork(supported);
              
              if (!supported) {
                toast({
                  title: 'Network Warning',
                  description: `You're connected to an unsupported network. Some features may not work.`,
                  variant: 'destructive',
                });
              }
            }
            
            // Refresh wallet data in background
            refreshWalletData(storedWallet);
          }
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    };

    checkWalletConnection();
  }, []);

  // Update network name whenever wallet changes
  useEffect(() => {
    if (wallet?.chainId) {
      setNetworkName(getNetworkName(wallet.chainId));
    } else {
      setNetworkName(null);
    }
  }, [wallet?.chainId]);

  const refreshWalletData = async (walletInfo: WalletInfo) => {
    try {
      setRefreshing(true);
      const updatedInfo = await refreshWalletInfo(walletInfo);
      setWallet(updatedInfo);
    } catch (err) {
      console.error('Error refreshing wallet data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const connect = async (type: WalletType) => {
    if (connecting) return;
    
    try {
      setConnecting(true);
      setError(null);
      
      const walletInfo = await connectWallet(type);
      setWallet(walletInfo);
      
      // Check if on supported network
      const supported = isSupportedNetwork(type, walletInfo.chainId);
      setIsCorrectNetwork(supported);
      
      toast({
        title: 'Wallet Connected',
        description: `Connected to ${walletInfo.address} on ${getNetworkName(walletInfo.chainId)}`,
      });
      
      if (!supported) {
        toast({
          title: 'Network Warning',
          description: `You're connected to an unsupported network. Some features may not work.`,
          variant: 'destructive',
        });
      }
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
      setNetworkName(null);
      
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

  const refreshBalance = async () => {
    if (!wallet || refreshing) return;
    
    try {
      setRefreshing(true);
      await refreshWalletData(wallet);
      
      toast({
        title: 'Balance Updated',
        description: `Your wallet balance has been refreshed`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: 'Failed to refresh wallet balance',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const switchNetwork = async (chainId: number) => {
    if (!wallet) return;
    
    try {
      await switchNetworkUtil(chainId);
      
      // Update wallet with new chainId
      const updatedWallet = { ...wallet, chainId };
      setWallet(updatedWallet);
      
      // Check if the new network is supported
      const supported = isSupportedNetwork(wallet.type, chainId);
      setIsCorrectNetwork(supported);
      
      toast({
        title: 'Network Changed',
        description: `Switched to ${getNetworkName(chainId)}`,
      });
      
      if (!supported) {
        toast({
          title: 'Network Warning',
          description: `You've switched to an unsupported network. Some features may not work.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setError(err.message || `Failed to switch to network ${chainId}`);
      
      toast({
        title: 'Network Switch Failed',
        description: err.message || `Failed to switch to network ${chainId}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <WalletContext.Provider 
      value={{ 
        wallet, 
        connecting, 
        refreshing,
        networkName,
        isCorrectNetwork,
        connect, 
        disconnect,
        refreshBalance,
        switchNetwork,
        error 
      }}
    >
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
