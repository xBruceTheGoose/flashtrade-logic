const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function validateDeployment(network) {
  console.log(`\n🔍 Validating deployment on ${network}...`);

  // Load deployment data
  const deploymentPath = path.join(__dirname, `../deployments/${network}/deployment.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network ${network}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Validate ArbitrageExecutor
  const arbitrageExecutor = await ethers.getContractAt(
    'ArbitrageExecutor',
    deployment.ArbitrageExecutor
  );

  // Validate SecurityManager
  const securityManager = await ethers.getContractAt(
    'SecurityManager',
    deployment.SecurityManager
  );

  console.log('\n🔒 Validating Security Settings...');
  
  // Check SecurityManager configuration
  const maxGasPrice = await securityManager.maxGasPrice();
  const rateLimit = await securityManager.rateLimit();
  const rateLimitWindow = await securityManager.rateLimitWindow();

  // Validate security thresholds
  const expectedMaxGasPrice = ethers.utils.parseUnits('500', 'gwei');
  if (maxGasPrice.gt(expectedMaxGasPrice)) {
    throw new Error(`MaxGasPrice too high: ${ethers.utils.formatUnits(maxGasPrice, 'gwei')} gwei`);
  }

  // Validate contract connections
  const executorSecurityManager = await arbitrageExecutor.securityManager();
  if (executorSecurityManager.toLowerCase() !== deployment.SecurityManager.toLowerCase()) {
    throw new Error('ArbitrageExecutor not properly connected to SecurityManager');
  }

  // Validate access controls
  const adminRole = await securityManager.ADMIN_ROLE();
  const hasAdmin = await securityManager.hasRole(adminRole, deployment.AdminAddress);
  if (!hasAdmin) {
    throw new Error('Admin role not properly configured');
  }

  // Validate emergency controls
  const isPaused = await securityManager.paused();
  console.log(`Contract paused status: ${isPaused}`);

  // Validate bytecode
  const arbitrageExecutorBytecode = await ethers.provider.getCode(deployment.ArbitrageExecutor);
  const securityManagerBytecode = await ethers.provider.getCode(deployment.SecurityManager);

  if (arbitrageExecutorBytecode === '0x' || securityManagerBytecode === '0x') {
    throw new Error('Contract bytecode not found - deployment may have failed');
  }

  // Log validation results
  console.log('\n✅ Deployment Validation Results:');
  console.log(`Network: ${network}`);
  console.log(`ArbitrageExecutor: ${deployment.ArbitrageExecutor}`);
  console.log(`SecurityManager: ${deployment.SecurityManager}`);
  console.log(`Max Gas Price: ${ethers.utils.formatUnits(maxGasPrice, 'gwei')} gwei`);
  console.log(`Rate Limit: ${rateLimit.toString()} trades`);
  console.log(`Rate Limit Window: ${rateLimitWindow.toString()} seconds`);

  // Write validation report
  const reportPath = path.join(__dirname, `../deployments/${network}/validation-report.json`);
  const report = {
    timestamp: new Date().toISOString(),
    network,
    contracts: {
      ArbitrageExecutor: {
        address: deployment.ArbitrageExecutor,
        bytecodeExists: arbitrageExecutorBytecode !== '0x'
      },
      SecurityManager: {
        address: deployment.SecurityManager,
        bytecodeExists: securityManagerBytecode !== '0x',
        configuration: {
          maxGasPrice: maxGasPrice.toString(),
          rateLimit: rateLimit.toString(),
          rateLimitWindow: rateLimitWindow.toString()
        }
      }
    },
    securityChecks: {
      adminRoleConfigured: hasAdmin,
      contractsConnected: executorSecurityManager.toLowerCase() === deployment.SecurityManager.toLowerCase(),
      isPaused
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Validation report written to ${reportPath}`);
}

// If running directly
if (require.main === module) {
  const network = process.argv[2];
  if (!network) {
    console.error('Please provide a network name');
    process.exit(1);
  }

  validateDeployment(network)
    .then(() => {
      console.log('\n✅ Validation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = validateDeployment;
