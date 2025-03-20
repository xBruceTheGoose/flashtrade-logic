import { Contract, JsonRpcProvider, ContractTransactionResponse, Interface, BytesLike, TransactionRequest } from 'ethers';
import { ArbitrageOpportunity, Token } from '../types';
import { getContractAddress } from '../utils/blockchain/contractAddresses';
import { getAbi } from '../utils/common/utils';

export class ArbitrageExecutor extends Contract {
  private readonly abi: Interface;
  constructor(address: string, abi: Interface, provider: JsonRpcProvider) {
    super(address, abi, provider);
    this.abi = abi;
  }

  static connect(address: string, provider: JsonRpcProvider): ArbitrageExecutor {
    const abi = getAbi('ArbitrageExecutor');
    return new ArbitrageExecutor(address, abi, provider);
  }

  async initialize(): Promise<void> {
    // Initialization logic
  }

  async execute(opportunity: ArbitrageOpportunity, token: Token): Promise<ContractTransactionResponse> {
    const { dexA, dexB, amountA, amountB } = opportunity;
    const { address: tokenAddress } = token;
    const arbitrageExecutorAddress = getContractAddress('ArbitrageExecutor');

    const data = this.abi.encodeFunctionData('executeArbitrage', [
      dexA.address,
      dexB.address,
      tokenAddress,
      amountA,
      amountB,
    ]);

    const tx: TransactionRequest = {
      to: arbitrageExecutorAddress,
      data,
      gasLimit: 500000, // Example gas limit
    };

    const signer = this.runner;
    if (!signer) {
      throw new Error('No signer available');
    }

    const transactionResponse = await signer.sendTransaction(tx);
    return transactionResponse;
  }
}
