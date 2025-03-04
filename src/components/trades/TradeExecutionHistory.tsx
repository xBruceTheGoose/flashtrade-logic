import React, { useState, useEffect } from 'react';
import { TradeExecutionRecord } from '@/utils/arbitrage/types';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { tradeExecutionStorage } from '@/utils/arbitrage/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { truncateHash, formatTimestamp, getStatusColor } from '@/utils/common/utils';
import { toast } from '@/hooks/use-toast';

export function TradeExecutionHistory() {
  const [trades, setTrades] = useState<TradeExecutionRecord[]>([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfit: "0 ETH",
    averageExecutionTime: 0,
    successRate: 0
  });

  // Load trades and stats
  const loadData = () => {
    setTrades(tradeExecutor.getExecutionRecords());
    setStats(tradeExecutor.getPerformanceStats());
  };

  // Load on mount and set up refresh timer
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle clear records
  const handleClearRecords = () => {
    if (confirm('Are you sure you want to clear all trade execution records?')) {
      tradeExecutionStorage.clearRecords();
      loadData();
    }
  };

  // Handle export records
  const handleExportRecords = () => {
    try {
      const json = tradeExecutionStorage.exportRecords();
      
      // Create and download file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trade-execution-records-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `${trades.length} records exported to JSON.`
      });
    } catch (error) {
      console.error('Error exporting records:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export records.",
        variant: "destructive"
      });
    }
  };

  // Handle transaction click to open explorer
  const handleTxClick = (txHash?: string) => {
    if (!txHash) return;
    
    // Open transaction in explorer
    // This would be enhanced in a real implementation to use the correct explorer URL
    window.open(`https://etherscan.io/tx/${txHash}`, '_blank');
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case 'completed':
        return "default";
      case 'pending':
      case 'preparing':
      case 'estimating':
      case 'ready':
      case 'executing':
        return "secondary";
      case 'failed':
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Trade Execution History</CardTitle>
        <CardDescription>
          View details of executed arbitrage trades
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Stats section */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 p-3 rounded">
            <div className="text-sm text-gray-500">Success Rate</div>
            <div className="text-xl font-bold">{stats.successRate.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <div className="text-sm text-gray-500">Total Profit</div>
            <div className="text-xl font-bold">{stats.totalProfit}</div>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <div className="text-sm text-gray-500">Avg. Execution Time</div>
            <div className="text-xl font-bold">
              {stats.averageExecutionTime ? 
                `${(stats.averageExecutionTime / 1000).toFixed(2)}s` : 
                'N/A'}
            </div>
          </div>
        </div>

        {/* Trades table */}
        {trades.length > 0 ? (
          <div className="rounded border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>DEXes</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>{formatTimestamp(trade.timestamp)}</TableCell>
                    <TableCell>
                      {trade.tokenInSymbol} → {trade.tokenOutSymbol}
                    </TableCell>
                    <TableCell>
                      {trade.sourceDex} → {trade.targetDex}
                    </TableCell>
                    <TableCell>{trade.tradeSize}</TableCell>
                    <TableCell>{trade.actualProfit || trade.expectedProfit}</TableCell>
                    <TableCell>
                      {trade.transactionHash ? (
                        <span 
                          className="text-blue-500 cursor-pointer hover:underline"
                          onClick={() => handleTxClick(trade.transactionHash)}
                        >
                          {truncateHash(trade.transactionHash)}
                        </span>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(trade.status)}>
                        {trade.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No trade execution records found
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleClearRecords}
          disabled={trades.length === 0}
        >
          Clear Records
        </Button>
        <Button 
          onClick={handleExportRecords}
          disabled={trades.length === 0}
        >
          Export Records
        </Button>
      </CardFooter>
    </Card>
  );
}
