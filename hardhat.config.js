require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is required");
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "london"
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: false,
      gas: 12000000,
      blockGasLimit: 12000000
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 20000
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      gasPrice: async () => {
        try {
          const { default: axios } = await import('axios');
          const response = await axios.get('https://gasstation.polygon.technology/v2');
          const data = response.data;
          return ethers.parseUnits(Math.ceil(data.fast.maxFee).toString(), 'gwei');
        } catch (error) {
          console.error('Failed to fetch gas price, using default');
          return ethers.parseUnits('50', 'gwei');
        }
      },
      timeout: 20000,
      gasLimit: 8000000
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 20000,
      gasLimit: 10000000
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: ["mocks/"],
    src: "./src/contracts"
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
