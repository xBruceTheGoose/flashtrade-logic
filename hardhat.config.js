require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";

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
      gasPrice: "auto",
      timeout: 20000
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 20000
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
