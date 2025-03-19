import { config } from 'dotenv';
import { JsonRpcProvider } from 'ethers';
import type { Config } from '@jest/types';
import '@types/node';

// Load environment variables
config();

declare global {
  namespace NodeJS {
    interface Global {
      waitForTransaction: (txPromise: Promise<any>) => Promise<any>;
    }
  }
}

// Set up global test environment
beforeEach(() => {
  jest.setTimeout(30000);
});

// Mock provider for tests that don't need a real network
export const mockProvider = new JsonRpcProvider();

// Mock environment variables for testing
process.env.TEST_RPC_URL = 'http://localhost:8545';
process.env.SECURITY_MANAGER_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.ARBITRAGE_EXECUTOR_ADDRESS = '0x0987654321098765432109876543210987654321';

// Global test utilities
global.waitForTransaction = async (txPromise: Promise<any>) => {
  const tx = await txPromise;
  await tx.wait();
  return tx;
};

// Mock monitoring functions
jest.mock('../config/monitoring', () => ({
  trackMetric: jest.fn(),
  initializeMonitoring: jest.fn(),
}));

// Extended matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
