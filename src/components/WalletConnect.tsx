
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { WalletType } from '@/types';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
  Loader2, 
  Wallet, 
  ChevronDown, 
  LogOut, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Network
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SUPPORTED_NETWORKS = [
  { id: 1, name: 'Ethereum Mainnet' },
  { id: 137, name: 'Polygon' },
  { id: 56, name: 'Binance Smart Chain' },
  { id: 42161, name: 'Arbitrum One' },
  { id: 10, name: 'Optimism' },
];

const WalletConnect = () => {
  const { 
    wallet, 
    connecting, 
    refreshing,
    networkName,
    isCorrectNetwork,
    connect, 
    disconnect,
    refreshBalance,
    switchNetwork
  } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [showNetworks, setShowNetworks] = useState(false);

  const handleConnect = async (type: WalletType) => {
    await connect(type);
    setIsOpen(false);
  };

  // Format address to show first 6 and last 4 characters
  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.includes('...')) return address; // Already formatted
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (connecting) {
    return (
      <Button disabled className="min-w-[160px]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (wallet && wallet.connected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={isCorrectNetwork ? "outline" : "destructive"} 
            className="min-w-[180px] justify-between"
          >
            <div className="flex items-center">
              {isCorrectNetwork ? (
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
              ) : (
                <AlertCircle className="h-4 w-4 mr-2" />
              )}
              {formatAddress(wallet.address)}
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 animate-fade-in">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center">
                <Badge variant="secondary" className="mr-2">
                  {wallet.type}
                </Badge>
                {isCorrectNetwork ? (
                  <Badge variant="success" className="flex items-center text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported Network
                  </Badge>
                ) : (
                  <Badge variant="error" className="flex items-center text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unsupported Network
                  </Badge>
                )}
              </div>
              
              <div className="text-sm font-normal text-muted-foreground flex justify-between items-center">
                <span>{wallet.balance}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={(e) => {
                    e.preventDefault();
                    refreshBalance();
                  }}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              <div className="text-xs font-medium mt-1 flex items-center">
                <Network className="h-3 w-3 mr-1 text-muted-foreground" />
                <span>{networkName}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuItem 
              onSelect={() => setShowNetworks(!showNetworks)}
              className="cursor-pointer flex justify-between items-center"
            >
              <div className="flex items-center">
                <Network className="mr-2 h-4 w-4" />
                Switch Network
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showNetworks ? 'rotate-180' : ''}`} />
            </DropdownMenuItem>
            
            {showNetworks && (
              <div className="px-2 py-1 space-y-1">
                {SUPPORTED_NETWORKS.map((network) => (
                  <Button
                    key={network.id}
                    variant={wallet.chainId === network.id ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => switchNetwork(network.id)}
                  >
                    {wallet.chainId === network.id && (
                      <CheckCircle className="h-3 w-3 mr-2" />
                    )}
                    {network.name}
                  </Button>
                ))}
              </div>
            )}
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => disconnect()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 animate-fade-in">
        <DropdownMenuLabel>Select Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleConnect('metamask')}
          className="cursor-pointer"
        >
          <div className="flex items-center w-full">
            <img
              src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg"
              alt="MetaMask"
              className="mr-2 h-5 w-5"
            />
            <span>MetaMask</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="ml-auto h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-xs text-xs">Connect with MetaMask browser extension or mobile app</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleConnect('coinbase')}
          className="cursor-pointer"
        >
          <div className="flex items-center w-full">
            <img
              src="https://static.alchemyapi.io/images/cw3d/Wallet/coinbase-wallet.svg"
              alt="Coinbase Wallet"
              className="mr-2 h-5 w-5"
            />
            <span>Coinbase Wallet</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="ml-auto h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-xs text-xs">Connect with Coinbase Wallet app</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleConnect('walletconnect')}
          className="cursor-pointer"
        >
          <div className="flex items-center w-full">
            <img
              src="https://avatars.githubusercontent.com/u/37784886"
              alt="WalletConnect"
              className="mr-2 h-5 w-5"
            />
            <span>WalletConnect</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="ml-auto h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-xs text-xs">Scan with WalletConnect to connect</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Helper component for the info icon
const InfoIcon = (props: any) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
};

export default WalletConnect;
