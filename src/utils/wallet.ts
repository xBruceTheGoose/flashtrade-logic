
import { WalletInfo, WalletType } from '@/types';

const WALLET_STORAGE_KEY = 'flashtrade_wallet';

// Get network name based on chainId
export const getNetworkName = (chainId: number): string => {
  const networks: Record<number, string> = {
    1: 'Ethereum Mainnet',
    3: 'Ropsten Testnet',
    4: 'Rinkeby Testnet',
    5: 'Goerli Testnet',
    42: 'Kovan Testnet',
    56: 'Binance Smart Chain',
    137: 'Polygon Mainnet',
    42161: 'Arbitrum One',
    10: 'Optimism',
    // Add more networks as needed
  };
  
  return networks[chainId] || `Chain ID ${chainId}`;
};

// Mapping of supported networks for each wallet type
const supportedNetworks: Record<WalletType, number[]> = {
  metamask: [1, 3, 4, 5, 42, 56, 137, 42161, 10],
  coinbase: [1, 3, 4, 5, 42, 137, 42161, 10],
  walletconnect: [1, 56, 137, 42161, 10],
  null: []
};

// Placeholder function to simulate wallet connection
export const connectWallet = async (walletType: WalletType): Promise<WalletInfo> => {
  try {
    console.log(`Connecting to ${walletType} wallet...`);
    
    // In a real implementation, this would use the appropriate wallet SDK
    // For now, we'll simulate a successful connection with dummy data
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate random address and balance for simulation
    const addressPrefix = walletType === 'metamask' ? '0x1234' : 
                           walletType === 'coinbase' ? '0x5678' : '0x9ABC';
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const address = `${addressPrefix}...${randomSuffix}`;
    
    const balance = (Math.random() * 10).toFixed(4) + ' ETH';
    const chainId = walletType === 'metamask' ? 1 : walletType === 'coinbase' ? 137 : 56;
    
    const walletInfo: WalletInfo = {
      address,
      balance,
      chainId,
      connected: true,
      type: walletType
    };
    
    // Save to localStorage
    saveWalletToStorage(walletInfo);
    
    return walletInfo;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw new Error('Failed to connect wallet');
  }
};

export const disconnectWallet = async (): Promise<void> => {
  try {
    // Simulate disconnection delay
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Wallet disconnected');
    
    // Clear from localStorage
    localStorage.removeItem(WALLET_STORAGE_KEY);
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    throw new Error('Failed to disconnect wallet');
  }
};

export const getWalletBalance = async (address: string): Promise<string> => {
  // Simulate API call to get balance
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a random balance for simulation
  return (Math.random() * 10).toFixed(4) + ' ETH';
};

export const isWalletConnected = (): boolean => {
  const walletInfo = getWalletFromStorage();
  return walletInfo?.connected || false;
};

export const switchNetwork = async (chainId: number): Promise<void> => {
  try {
    console.log(`Switching to network ${chainId}...`);
    // Simulate network switch delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update localStorage with new chainId
    const walletInfo = getWalletFromStorage();
    if (walletInfo) {
      saveWalletToStorage({
        ...walletInfo,
        chainId
      });
    }
  } catch (error) {
    console.error('Error switching network:', error);
    throw new Error(`Failed to switch to network ${chainId}`);
  }
};

export const refreshWalletInfo = async (currentInfo: WalletInfo): Promise<WalletInfo> => {
  try {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Get updated balance
    const newBalance = await getWalletBalance(currentInfo.address);
    
    const updatedInfo: WalletInfo = {
      ...currentInfo,
      balance: newBalance
    };
    
    // Update in localStorage
    saveWalletToStorage(updatedInfo);
    
    return updatedInfo;
  } catch (error) {
    console.error('Error refreshing wallet info:', error);
    return currentInfo; // Return original info on error
  }
};

export const isSupportedNetwork = (type: WalletType, chainId: number): boolean => {
  return supportedNetworks[type]?.includes(chainId) || false;
};

// Save wallet info to localStorage
const saveWalletToStorage = (walletInfo: WalletInfo): void => {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletInfo));
  } catch (error) {
    console.error('Error saving wallet to storage:', error);
  }
};

// Get wallet info from localStorage
export const getWalletFromStorage = (): WalletInfo | null => {
  try {
    const data = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!data) return null;
    
    return JSON.parse(data) as WalletInfo;
  } catch (error) {
    console.error('Error retrieving wallet from storage:', error);
    return null;
  }
};
