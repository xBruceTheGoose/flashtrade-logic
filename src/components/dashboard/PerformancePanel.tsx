
import { useMemo } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { BarChart3, TrendingUp, Activity, DollarSign, Clock } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TradeExecutionRecord } from '@/utils/arbitrage/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ethers } from 'ethers';

interface PerformancePanelProps {
  trades: TradeExecutionRecord[];
}

const PerformancePanel = ({ trades }: PerformancePanelProps) => {
  // Only include successful trades for performance metrics
  const successfulTrades = trades.filter(trade => trade.success);
  
  // Calculate performance metrics
  const metrics = useMemo(() => {
    const totalTrades = trades.length;
    const successfulTradesCount = successfulTrades.length;
    const successRate = totalTrades > 0 ? (successfulTradesCount / totalTrades) * 100 : 0;
    
    // Calculate total profit
    let totalProfit = 0;
    for (const trade of successfulTrades) {
      if (trade.profitAmount) {
        totalProfit += parseFloat(trade.profitAmount);
      }
    }
    
    // Calculate average execution time
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    for (const trade of trades) {
      if (trade.executionTime) {
        totalExecutionTime += trade.executionTime;
        executionTimeCount++;
      }
    }
    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    
    return {
      totalTrades,
      successfulTradesCount,
      successRate: successRate.toFixed(1),
      totalProfit: totalProfit.toFixed(5),
      avgExecutionTime: avgExecutionTime.toFixed(0),
    };
  }, [trades, successfulTrades]);
  
  // Group trades by day for the chart
  const chartData = useMemo(() => {
    const last7Days = new Array(7).fill(0).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }),
        timestamp: date.getTime(),
        profit: 0,
        trades: 0,
      };
    });
    
    // Map of timestamp to index in last7Days array
    const dayMap = last7Days.reduce((acc, day, index) => {
      acc[day.timestamp] = index;
      return acc;
    }, {} as Record<number, number>);
    
    // Fill in the profit data
    for (const trade of successfulTrades) {
      const tradeDate = new Date(trade.timestamp);
      tradeDate.setHours(0, 0, 0, 0);
      const tradeDay = tradeDate.getTime();
      
      // Check if this trade is within our 7-day window
      const dayIndex = dayMap[tradeDay];
      if (dayIndex !== undefined) {
        if (trade.profitAmount) {
          last7Days[dayIndex].profit += parseFloat(trade.profitAmount);
        }
        last7Days[dayIndex].trades += 1;
      }
    }
    
    // Format profit to 5 decimal places
    return last7Days.map(day => ({
      ...day,
      profit: parseFloat(day.profit.toFixed(5)),
    }));
  }, [successfulTrades]);

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Performance Metrics
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProfit} ETH</div>
            <p className="text-xs text-muted-foreground">
              Across {metrics.successfulTradesCount} successful trades
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.successfulTradesCount} of {metrics.totalTrades} trades
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trade Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              Total trades executed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Execution</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgExecutionTime} ms</div>
            <p className="text-xs text-muted-foreground">
              Average execution time
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex-grow min-h-[300px]">
        <h3 className="text-lg font-medium mb-4">7-Day Profit History</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 25,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip 
              formatter={(value) => [`${value} ETH`, 'Profit']}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            <Bar dataKey="profit" name="Profit (ETH)" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

export default PerformancePanel;
