
import { ethers } from 'ethers';

export class MockProvider extends ethers.providers.Provider {
  _isProvider = true;
  network = { chainId: 1, name: 'mainnet' };
  
  async getNetwork() {
    return this.network;
  }
  
  async getBlockNumber() {
    return 123456;
  }
  
  async getGasPrice() {
    return ethers.BigNumber.from('50000000000');
  }
  
  async getBalance(address: string) {
    return ethers.utils.parseEther('10.0');
  }
  
  // Add more methods as needed
}

export class MockSigner extends ethers.Signer {
  provider = new MockProvider();
  address = '0x1234567890123456789012345678901234567890';
  
  connect() {
    return this;
  }
  
  async getAddress() {
    return this.address;
  }
  
  async signMessage(message: string) {
    return '0xsignedmessage';
  }
  
  async signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>) {
    return '0xsignedtransaction';
  }
}

// Mock blockchain service
export const mockBlockchainService = {
  getCurrentProvider: jest.fn().mockReturnValue(new MockProvider()),
  getProvider: jest.fn().mockReturnValue(new MockProvider()),
  getSigner: jest.fn().mockReturnValue(new MockSigner()),
  isWalletConnected: jest.fn().mockReturnValue(true),
  setWalletType: jest.fn(),
  getBalance: jest.fn().mockResolvedValue('10.0'),
  getTokenBalance: jest.fn().mockResolvedValue('100.0'),
  getTokenAllowance: jest.fn().mockResolvedValue('50.0'),
  getNetworkConfig: jest.fn().mockReturnValue({
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/your-infura-id',
    nativeCurrency: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  }),
};
