
const fs = require('fs');
const path = require('path');

// Read the current package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add test scripts
packageJson.scripts = {
  ...packageJson.scripts,
  "test": "jest",
  "test:unit": "jest --testMatch='**/*.test.ts'",
  "test:integration": "jest --testMatch='**/*.integration.test.ts'",
  "test:e2e": "jest --testMatch='**/__tests__/*.e2e.test.ts'",
  "test:security": "jest --testMatch='**/test/security/*.test.ts'",
  "test:performance": "jest --testMatch='**/*.performance.test.ts'",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "typecheck": "tsc --noEmit",
  "test:contracts": "hardhat test"
};

// Write back the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('Updated package.json with test scripts');
