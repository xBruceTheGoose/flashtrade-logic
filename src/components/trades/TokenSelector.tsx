
import { useState } from 'react';
import { Token } from '@/types';
import { commonTokens } from '@/utils/dex';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X, Plus, Search } from 'lucide-react';

interface TokenSelectorProps {
  selectedTokens: string[];
  setSelectedTokens: (tokens: string[]) => void;
  disabled?: boolean;
}

const TokenSelector = ({ selectedTokens, setSelectedTokens, disabled = false }: TokenSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  
  const filteredTokens = commonTokens.filter(token => 
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const displayTokens = showAll ? filteredTokens : filteredTokens.slice(0, 8);
  
  const handleTokenToggle = (tokenAddress: string) => {
    if (selectedTokens.includes(tokenAddress)) {
      setSelectedTokens(selectedTokens.filter(addr => addr !== tokenAddress));
    } else {
      setSelectedTokens([...selectedTokens, tokenAddress]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-sm font-medium">Selected Tokens</div>
        <div className="flex flex-wrap gap-2">
          {selectedTokens.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No tokens selected</div>
          ) : (
            selectedTokens.map(tokenAddress => {
              const token = commonTokens.find(t => t.address === tokenAddress);
              return token ? (
                <Badge 
                  key={tokenAddress} 
                  variant="secondary"
                  className="flex items-center gap-1 py-1 px-2"
                >
                  {token.symbol}
                  <button 
                    onClick={() => handleTokenToggle(tokenAddress)}
                    className="ml-1 focus:outline-none disabled:cursor-not-allowed"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })
          )}
        </div>
      </div>
      
      <div className="text-sm font-medium">Available Tokens</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {displayTokens.map(token => (
          <Card 
            key={token.address} 
            className={`
              flex items-center justify-between p-2 cursor-pointer 
              ${selectedTokens.includes(token.address) ? 'bg-primary/10 border-primary/30' : ''}
              ${disabled ? 'opacity-70 cursor-not-allowed' : ''}
            `}
            onClick={() => !disabled && handleTokenToggle(token.address)}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-2">
                <span className="text-xs font-bold">{token.symbol.charAt(0)}</span>
              </div>
              <div>
                <div className="font-medium">{token.symbol}</div>
                <div className="text-xs text-muted-foreground">{token.name}</div>
              </div>
            </div>
            <Button 
              variant={selectedTokens.includes(token.address) ? "default" : "outline"} 
              size="sm"
              className="h-7 px-2"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                !disabled && handleTokenToggle(token.address);
              }}
            >
              {selectedTokens.includes(token.address) ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </Card>
        ))}
      </div>
      
      {filteredTokens.length > 8 && (
        <Button
          variant="ghost"
          className="w-full text-xs"
          onClick={() => setShowAll(!showAll)}
          disabled={disabled}
        >
          {showAll ? (
            <>Show Less <ChevronUp className="ml-1 h-3 w-3" /></>
          ) : (
            <>Show More <ChevronDown className="ml-1 h-3 w-3" /></>
          )}
        </Button>
      )}
    </div>
  );
};

export default TokenSelector;
