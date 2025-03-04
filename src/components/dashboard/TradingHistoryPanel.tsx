
import { useState } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { Clock, ExternalLink, Filter, ArrowDownUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TradeExecutionRecord } from '@/utils/arbitrage/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ethers } from 'ethers';

interface TradingHistoryPanelProps {
  trades: TradeExecutionRecord[];
}

const TradingHistoryPanel = ({ trades }: TradingHistoryPanelProps) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'profit'>('newest');
  const [selectedTrade, setSelectedTrade] = useState<TradeExecutionRecord | null>(null);
  
  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    if (filter === 'success') return trade.success;
    if (filter === 'failed') return !trade.success;
    return true;
  });
  
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (sort === 'newest') return b.timestamp - a.timestamp;
    if (sort === 'oldest') return a.timestamp - b.timestamp;
    if (sort === 'profit') {
      const profitA = a.profitAmount ? parseFloat(a.profitAmount) : 0;
      const profitB = b.profitAmount ? parseFloat(b.profitAmount) : 0;
      return profitB - profitA;
    }
    return 0;
  });
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  const viewTradeDetails = (trade: TradeExecutionRecord) => {
    setSelectedTrade(trade);
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Trading History
        </h2>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trades</SelectItem>
              <SelectItem value="success">Successful</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sort} onValueChange={(value) => setSort(value as any)}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="profit">Highest Profit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {sortedTrades.length > 0 ? (
        <div className="overflow-x-auto flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pair</TableHead>
                <TableHead>DEXes</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">
                    {formatDate(trade.timestamp)}
                  </TableCell>
                  <TableCell>
                    {trade.tokenIn} → {trade.tokenOut}
                  </TableCell>
                  <TableCell>
                    {trade.sourceDex} → {trade.targetDex}
                  </TableCell>
                  <TableCell>
                    {trade.profitAmount && trade.success ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {trade.profitAmount} ({trade.profitPercentage}%)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {trade.success ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => viewTradeDetails(trade)}>
                            <Info className="h-4 w-4" />
                            <span className="sr-only">Details</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Trade Details</DialogTitle>
                            <DialogDescription>
                              {formatDate(trade.timestamp)}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-2">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium">Status</div>
                              <div>{trade.success ? 'Success' : 'Failed'}</div>
                              
                              <div className="font-medium">Token Pair</div>
                              <div>{trade.tokenIn} → {trade.tokenOut}</div>
                              
                              <div className="font-medium">DEXes</div>
                              <div>{trade.sourceDex} → {trade.targetDex}</div>
                              
                              <div className="font-medium">Amount</div>
                              <div>{trade.amountIn} {trade.tokenIn}</div>
                              
                              <div className="font-medium">Profit</div>
                              <div className={trade.success ? "text-green-600 dark:text-green-400" : ""}>
                                {trade.profitAmount ? `${trade.profitAmount} (${trade.profitPercentage}%)` : '-'}
                              </div>
                              
                              <div className="font-medium">Gas Used</div>
                              <div>{trade.gasUsed || '-'}</div>
                              
                              <div className="font-medium">Execution Time</div>
                              <div>{trade.executionTime ? `${trade.executionTime} ms` : '-'}</div>
                            </div>
                            
                            {trade.txHash && (
                              <div className="pt-2 border-t">
                                <div className="font-medium mb-1">Transaction Hash</div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-muted p-1 rounded text-xs truncate flex-grow">
                                    {trade.txHash}
                                  </code>
                                  <a 
                                    href={`https://etherscan.io/tx/${trade.txHash}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-500 hover:text-blue-600"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                            )}
                            
                            {trade.error && (
                              <div className="pt-2 border-t">
                                <div className="font-medium mb-1">Error</div>
                                <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                  {trade.error}
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {trade.txHash && (
                        <a 
                          href={`https://etherscan.io/tx/${trade.txHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">View on Etherscan</span>
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium">No Trade History</h3>
          <p className="text-muted-foreground text-sm max-w-md mt-1">
            {filter !== 'all' 
              ? `No ${filter} trades found in your history.` 
              : "Execute trades to build your trading history."}
          </p>
        </div>
      )}
    </GlassCard>
  );
};

export default TradingHistoryPanel;
