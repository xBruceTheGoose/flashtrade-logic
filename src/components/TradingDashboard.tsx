import React, { useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ethers } from 'ethers';
import { PriceMonitor } from '../services/PriceMonitor';
import { debounce } from 'lodash';
import { trackMetric } from '../config/monitoring';

interface Trade {
  id: string;
  pair: string;
  amount: string;
  price: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

interface PriceData {
  current: string;
  change24h: number;
  volume: string;
}

// Memoized price display component
const PriceDisplay = memo(({ price, change24h }: { 
  price: string; 
  change24h: number;
}) => {
  const changeColor = change24h >= 0 ? 'text-green-500' : 'text-red-500';
  
  return (
    <div className="flex items-center space-x-2">
      <span className="font-mono">{price}</span>
      <span className={changeColor}>
        {change24h > 0 ? '+' : ''}{change24h.toFixed(2)}%
      </span>
    </div>
  );
});

// Memoized trade row component
const TradeRow = memo(({ trade }: { trade: Trade }) => {
  const statusColor = {
    pending: 'bg-yellow-100',
    completed: 'bg-green-100',
    failed: 'bg-red-100'
  }[trade.status];

  return (
    <div className={`flex items-center p-2 ${statusColor}`}>
      <span className="w-1/4">{trade.pair}</span>
      <span className="w-1/4">{trade.amount}</span>
      <span className="w-1/4">{trade.price}</span>
      <span className="w-1/4">{trade.status}</span>
    </div>
  );
});

export const TradingDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const priceMonitorRef = useRef<PriceMonitor>();
  const cleanupRef = useRef<(() => void)[]>([]);

  // Virtualized list for trade history
  const { data: trades = [] } = useQuery<Trade[]>('trades', 
    () => fetch('/api/trades').then(res => res.json()),
    { staleTime: 5000 }
  );

  const rowVirtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 40,
    overscan: 5
  });

  // Memoized price data transformation
  const { data: prices } = useQuery<Record<string, PriceData>>('prices', 
    () => fetch('/api/prices').then(res => res.json()),
    { staleTime: 1000 }
  );

  const sortedPairs = useMemo(() => {
    if (!prices) return [];
    return Object.entries(prices)
      .sort(([, a], [, b]) => 
        parseFloat(b.volume) - parseFloat(a.volume)
      );
  }, [prices]);

  // Optimized price update handler
  const handlePriceUpdate = useCallback(debounce((pair: string, price: string) => {
    queryClient.setQueryData<Record<string, PriceData>>('prices', 
      old => old ? {
        ...old,
        [pair]: {
          ...old[pair],
          current: price
        }
      } : {}
    );
  }, 100), [queryClient]);

  // Memory-efficient WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || '');
    const cleanup = () => ws.close();
    cleanupRef.current.push(cleanup);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handlePriceUpdate(data.pair, data.price);
    };

    return cleanup;
  }, [handlePriceUpdate]);

  // Initialize price monitor
  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    priceMonitorRef.current = new PriceMonitor(provider);

    return () => {
      priceMonitorRef.current?.cleanup();
      cleanupRef.current.forEach(cleanup => cleanup());
    };
  }, []);

  // Performance tracking
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        trackMetric('react_render_time', entry.duration);
      });
    });

    observer.observe({ entryTypes: ['render'] });
    return () => observer.disconnect();
  }, []);

  // Memoized trade statistics
  const tradeStats = useMemo(() => {
    return trades.reduce((acc, trade) => ({
      total: acc.total + 1,
      completed: acc.completed + (trade.status === 'completed' ? 1 : 0),
      failed: acc.failed + (trade.status === 'failed' ? 1 : 0),
      volume: acc.volume + parseFloat(trade.amount)
    }), { total: 0, completed: 0, failed: 0, volume: 0 });
  }, [trades]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats Section */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-100">
        <div className="stat-card">
          <h3>Total Trades</h3>
          <p>{tradeStats.total}</p>
        </div>
        <div className="stat-card">
          <h3>Success Rate</h3>
          <p>{((tradeStats.completed / tradeStats.total) * 100).toFixed(2)}%</p>
        </div>
        <div className="stat-card">
          <h3>24h Volume</h3>
          <p>{tradeStats.volume.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Active Pairs</h3>
          <p>{sortedPairs.length}</p>
        </div>
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {sortedPairs.slice(0, 6).map(([pair, data]) => (
          <div key={pair} className="price-card">
            <h4>{pair}</h4>
            <PriceDisplay 
              price={data.current} 
              change24h={data.change24h} 
            />
          </div>
        ))}
      </div>

      {/* Virtualized Trade History */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ height: '400px' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <TradeRow trade={trades[virtualRow.index]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
