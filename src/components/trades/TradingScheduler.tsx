
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TradingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: string[];
}

interface TradingSchedulerProps {
  tradingHours: TradingHours;
  setTradingHours: (hours: TradingHours) => void;
  disabled?: boolean;
}

const daysOfWeek = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' }
];

const TradingScheduler = ({ tradingHours, setTradingHours, disabled = false }: TradingSchedulerProps) => {
  const toggleSchedule = (enabled: boolean) => {
    setTradingHours({ ...tradingHours, enabled });
  };

  const updateTime = (field: 'startTime' | 'endTime', value: string) => {
    setTradingHours({ ...tradingHours, [field]: value });
  };

  const toggleDay = (day: string) => {
    const updatedDays = tradingHours.days.includes(day)
      ? tradingHours.days.filter(d => d !== day)
      : [...tradingHours.days, day];
    
    setTradingHours({ ...tradingHours, days: updatedDays });
  };

  const setAllDays = () => {
    setTradingHours({
      ...tradingHours,
      days: daysOfWeek.map(d => d.id)
    });
  };

  const setWeekdays = () => {
    setTradingHours({
      ...tradingHours,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    });
  };

  const setWeekends = () => {
    setTradingHours({
      ...tradingHours,
      days: ['saturday', 'sunday']
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="enable-schedule" className="font-medium">Trading Schedule</Label>
        <Switch
          id="enable-schedule"
          checked={tradingHours.enabled}
          onCheckedChange={toggleSchedule}
          disabled={disabled}
        />
      </div>
      
      <Card className={`p-4 space-y-4 ${!tradingHours.enabled ? 'opacity-50' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              id="start-time"
              type="time"
              value={tradingHours.startTime}
              onChange={(e) => updateTime('startTime', e.target.value)}
              disabled={disabled || !tradingHours.enabled}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="end-time">End Time</Label>
            <Input
              id="end-time"
              type="time"
              value={tradingHours.endTime}
              onChange={(e) => updateTime('endTime', e.target.value)}
              disabled={disabled || !tradingHours.enabled}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Trading Days</Label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map(day => (
              <Badge
                key={day.id}
                variant={tradingHours.days.includes(day.id) ? "default" : "outline"}
                className={`cursor-pointer ${disabled || !tradingHours.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !disabled && tradingHours.enabled && toggleDay(day.id)}
              >
                {day.label}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={setAllDays}
            disabled={disabled || !tradingHours.enabled}
          >
            All Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={setWeekdays}
            disabled={disabled || !tradingHours.enabled}
          >
            Weekdays
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={setWeekends}
            disabled={disabled || !tradingHours.enabled}
          >
            Weekends
          </Button>
        </div>
      </Card>
      
      <div className="text-xs text-muted-foreground">
        Configure when trades should be executed. Outside these hours, the system will monitor but not execute trades.
      </div>
    </div>
  );
};

export default TradingScheduler;
