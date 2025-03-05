
import { runAllSecurityTests } from './security/securityTests';

/**
 * Main test runner that can be used to execute different test suites
 */
async function runTests() {
  const testType = process.argv[2] || 'all';
  
  console.log(`Running ${testType} tests...`);
  
  switch (testType) {
    case 'security':
      await runAllSecurityTests();
      break;
      
    case 'performance':
      console.log('Performance tests are run separately with Jest');
      break;
      
    case 'contracts':
      console.log('Contract tests are run with Hardhat');
      break;
      
    case 'all':
    default:
      console.log('All tests should be run with their respective test runners');
      // You could invoke different test runners here
      break;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
