
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get the network name
  const networkName = hre.network.name;
  console.log(`Deploying to ${networkName}...`);

  // Deploy ArbitrageExecutor
  const ArbitrageExecutor = await hre.ethers.getContractFactory("ArbitrageExecutor");
  const arbitrageExecutor = await ArbitrageExecutor.deploy();
  await arbitrageExecutor.deployed();

  console.log(`ArbitrageExecutor deployed to: ${arbitrageExecutor.address}`);

  // Save deployment info
  const deploymentDir = path.join(__dirname, "../deployments", networkName);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  // Save the contract address
  const deploymentInfo = {
    ArbitrageExecutor: arbitrageExecutor.address,
    timestamp: new Date().toISOString(),
    chainId: hre.network.config.chainId
  };

  fs.writeFileSync(
    path.join(deploymentDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Generate contract address file for frontend
  updateContractAddresses(networkName, arbitrageExecutor.address);

  console.log("Deployment info saved successfully");
}

function updateContractAddresses(network, arbitrageExecutorAddress) {
  // Path to contract addresses file in the src directory
  const contractAddressesPath = path.join(__dirname, "../src/utils/blockchain/contractAddresses.ts");
  
  // Create template if file doesn't exist
  if (!fs.existsSync(contractAddressesPath)) {
    fs.writeFileSync(
      contractAddressesPath,
      `// Auto-generated file - DO NOT EDIT MANUALLY
export const CONTRACT_ADDRESSES = {
  ARBITRAGE_EXECUTOR: {
  }
};
`
    );
  }

  // Read current file
  let content = fs.readFileSync(contractAddressesPath, 'utf8');
  
  // Extract current addresses object
  const currentAddressesMatch = content.match(/ARBITRAGE_EXECUTOR: (\{[^}]*\})/s);
  if (!currentAddressesMatch) {
    throw new Error("Could not parse contract addresses file");
  }
  
  let currentAddresses = currentAddressesMatch[1];
  
  // Add or update address for this network
  const networkEntry = `    ${network}: "${arbitrageExecutorAddress}"`;
  
  if (currentAddresses.includes(`${network}:`)) {
    // Update existing entry
    currentAddresses = currentAddresses.replace(
      new RegExp(`${network}: "[^"]*"`),
      `${network}: "${arbitrageExecutorAddress}"`
    );
  } else {
    // Add new entry
    currentAddresses = currentAddresses.replace(
      '}',
      networkEntry + '\n  }'
    );
  }
  
  // Update the file
  content = content.replace(/ARBITRAGE_EXECUTOR: (\{[^}]*\})/s, `ARBITRAGE_EXECUTOR: ${currentAddresses}`);
  fs.writeFileSync(contractAddressesPath, content);
  
  console.log(`Updated contract addresses for ${network}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
