
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { WalletType } from '@/types';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Loader2, Wallet, ChevronDown, LogOut } from 'lucide-react';
import Badge from './ui/Badge';

const WalletConnect = () => {
  const { wallet, connecting, connect, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  const handleConnect = async (type: WalletType) => {
    await connect(type);
    setIsOpen(false);
  };

  // Format address to show first 6 and last 4 characters
  const formatAddress = (address: string) => {
    if (!address) return '';
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
          <Button variant="outline" className="min-w-[180px] justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
              {formatAddress(wallet.address)}
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 animate-fade-in">
          <div className="px-2 py-1.5 text-sm font-medium">
            <Badge variant="info" className="mb-1">
              {wallet.type}
            </Badge>
            <p className="text-muted-foreground text-xs mt-1">
              {wallet.balance}
            </p>
          </div>
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
        <DropdownMenuItem onClick={() => handleConnect('metamask')}>
          <img
            src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg"
            alt="MetaMask"
            className="mr-2 h-5 w-5"
          />
          MetaMask
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('coinbase')}>
          <img
            src="https://static.alchemyapi.io/images/cw3d/Wallet/coinbase-wallet.svg"
            alt="Coinbase Wallet"
            className="mr-2 h-5 w-5"
          />
          Coinbase Wallet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('walletconnect')}>
          <img
            src="https://avatars.githubusercontent.com/u/37784886"
            alt="WalletConnect"
            className="mr-2 h-5 w-5"
          />
          WalletConnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletConnect;
