
import { useState, useEffect } from 'react';
import { LogEntry, LogFilter, logger } from '@/utils/monitoring/loggingService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Trash2, Search, RefreshCw, FileUp, FileCog } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';

const LogsViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [modules, setModules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadLogs();
  }, []);
  
  useEffect(() => {
    // Apply filters
    let result = logs;
    
    // Filter by log level
    if (selectedLogLevel !== 'all') {
      result = result.filter(log => log.level === selectedLogLevel);
    }
    
    // Filter by module
    if (selectedModule !== 'all') {
      result = result.filter(log => log.module === selectedModule);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(term) || 
        log.module.toLowerCase().includes(term) ||
        (log.tags && log.tags.some(tag => tag.toLowerCase().includes(term))) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(term))
      );
    }
    
    // Sort by timestamp descending (newest first)
    result = [...result].sort((a, b) => b.timestamp - a.timestamp);
    
    setFilteredLogs(result);
  }, [logs, selectedLogLevel, selectedModule, searchTerm]);
  
  const loadLogs = () => {
    setIsLoading(true);
    
    // Get all logs
    const allLogs = logger.getLogs();
    setLogs(allLogs);
    
    // Extract unique modules for filter
    const uniqueModules = Array.from(new Set(allLogs.map(log => log.module)));
    setModules(uniqueModules);
    
    setIsLoading(false);
  };
  
  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      logger.clearLogs();
      loadLogs();
      toast({
        title: "Logs Cleared",
        description: "All logs have been cleared."
      });
    }
  };
  
  const exportLogs = () => {
    const jsonData = logger.exportLogs();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Logs Exported",
      description: "Logs have been exported as a JSON file."
    });
  };
  
  const importLogs = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      
      const file = target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const success = logger.importLogs(content);
          
          if (success) {
            loadLogs();
            toast({
              title: "Logs Imported",
              description: "Logs have been imported successfully."
            });
          } else {
            toast({
              title: "Import Failed",
              description: "Failed to import logs. Invalid format.",
              variant: "destructive"
            });
          }
        } catch (error) {
          toast({
            title: "Import Error",
            description: "An error occurred while importing logs.",
            variant: "destructive"
          });
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  };
  
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'debug': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warn': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold';
      default: return '';
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  return (
    <GlassCard className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <FileCog className="mr-2 h-6 w-6" />
            System Logs
          </h2>
          <p className="text-muted-foreground">
            Debug and audit logs for application events
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          <Button variant="secondary" onClick={exportLogs}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          
          <Button variant="secondary" onClick={importLogs}>
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          
          <Button variant="destructive" onClick={clearLogs}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Log Summary */}
      <div className="mb-6">
        <Card>
          <CardHeader className="py-4">
            <CardTitle>Log Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-2">
                <div className="text-sm text-muted-foreground">Total Logs</div>
                <div className="text-2xl font-semibold">{logs.length}</div>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 rounded-md px-3 py-2">
                <div className="text-sm text-muted-foreground">Info</div>
                <div className="text-2xl font-semibold">
                  {logs.filter(log => log.level === 'info').length}
                </div>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-md px-3 py-2">
                <div className="text-sm text-muted-foreground">Warnings</div>
                <div className="text-2xl font-semibold">
                  {logs.filter(log => log.level === 'warn').length}
                </div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/20 rounded-md px-3 py-2">
                <div className="text-sm text-muted-foreground">Errors</div>
                <div className="text-2xl font-semibold">
                  {logs.filter(log => log.level === 'error' || log.level === 'critical').length}
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-2">
                <div className="text-sm text-muted-foreground">Debug</div>
                <div className="text-2xl font-semibold">
                  {logs.filter(log => log.level === 'debug').length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search Logs</Label>
                <div className="flex mt-1">
                  <Input
                    id="search"
                    placeholder="Search in messages, modules, tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-grow"
                  />
                  <Button variant="ghost" className="ml-2">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="level-filter">Level</Label>
                <Select
                  value={selectedLogLevel}
                  onValueChange={setSelectedLogLevel}
                >
                  <SelectTrigger id="level-filter" className="mt-1">
                    <SelectValue placeholder="Select Log Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="module-filter">Module</Label>
                <Select
                  value={selectedModule}
                  onValueChange={setSelectedModule}
                >
                  <SelectTrigger id="module-filter" className="mt-1">
                    <SelectValue placeholder="Select Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {modules.map(module => (
                      <SelectItem key={module} value={module}>
                        {module}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Logs List */}
      <Card className="mb-6">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center justify-between">
            <span>Logs</span>
            <span className="text-sm font-normal">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] rounded-md border">
            {filteredLogs.length > 0 ? (
              <div className="space-y-2 p-4">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-3 border rounded-md">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={getLogLevelColor(log.level)}>
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">{log.module}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="my-1">{log.message}</p>
                    {log.tags && log.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {log.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {log.data && (
                      <div className="mt-2 text-xs">
                        <div className="text-muted-foreground mb-1">Additional Data:</div>
                        <pre className="bg-muted p-2 rounded overflow-auto max-h-[100px]">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FileCog className="h-12 w-12 mb-2 opacity-20" />
                <p>No logs found matching the current filters</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </GlassCard>
  );
};

export default LogsViewer;
