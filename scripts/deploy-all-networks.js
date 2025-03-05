
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Networks to deploy to
const networks = [
  'ethereum',      // Mainnet
  'polygon',       // Polygon mainnet
  'bsc',           // Binance Smart Chain mainnet
  'arbitrum',      // Arbitrum mainnet
  'optimism',      // Optimism mainnet
  'goerli',        // Ethereum testnet
  'mumbai',        // Polygon testnet
  'bsc-testnet'    // BSC testnet
];

// Create a backup of the current contract addresses
function backupContractAddresses() {
  const contractAddressesPath = path.join(__dirname, '../src/utils/blockchain/contractAddresses.ts');
  if (fs.existsSync(contractAddressesPath)) {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `contractAddresses-${timestamp}.ts`);
    
    fs.copyFileSync(contractAddressesPath, backupPath);
    console.log(`Backed up contract addresses to ${backupPath}`);
  }
}

// Main deployment function
async function deployToAllNetworks() {
  // Backup current addresses
  backupContractAddresses();
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Deploy to each network
  for (const network of networks) {
    console.log(`\n========== DEPLOYING TO ${network.toUpperCase()} ==========\n`);
    
    try {
      // Run the deployment script for this network
      execSync(`npx hardhat run scripts/deploy.js --network ${network}`, { stdio: 'inherit' });
      console.log(`\n✅ Successfully deployed to ${network}\n`);
    } catch (error) {
      console.error(`\n❌ Failed to deploy to ${network}: ${error.message}\n`);
    }
  }
  
  console.log('\n========== DEPLOYMENT SUMMARY ==========\n');
  
  // Check which networks were successfully deployed
  for (const network of networks) {
    const deploymentPath = path.join(deploymentsDir, network, 'deployment.json');
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      console.log(`${network}: ✅ - ArbitrageExecutor at ${deployment.ArbitrageExecutor}`);
    } else {
      console.log(`${network}: ❌ - Deployment failed or not attempted`);
    }
  }
}

// Run the deployment
deployToAllNetworks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
