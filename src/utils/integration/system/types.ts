
export interface SystemStatus {
  moduleStatuses: {
    ai: boolean;
    blockchain: boolean;
    priceMonitoring: boolean;
    tradeExecution: boolean;
    smartContracts: boolean;
    webWorkers: boolean;
  };
  errors: {
    blockchain?: string;
    ai?: string;
    general?: string;
    priceMonitoring?: string;
    webWorkers?: string;
  };
  performance: {
    memoryUsage?: number;
    cpuUsage?: number;
  };
}
