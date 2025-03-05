
# Testing Framework

This directory contains a comprehensive testing framework for the application, including:

## Unit Tests
- Tests for individual functions in isolation
- Located in `__tests__` directories near the files they test
- Run with `npm run test:unit`

## Integration Tests
- Tests for interactions between components
- Located in `__tests__` directories with `.integration.test.ts` suffix
- Run with `npm run test:integration`

## E2E Tests
- End-to-end tests for complete workflows
- Located in `e2e` directory
- Run with `npm run test:e2e`

## Smart Contract Tests
- Tests for smart contract functionality
- Located in the root `test` directory
- Run with `npx hardhat test` or `npm run test:contracts`

## Performance Tests
- Tests to measure and benchmark application performance
- Located in `__tests__` directories with `.performance.test.ts` suffix
- Run with `npm run test:performance`

## Security Tests
- Tests to identify potential security vulnerabilities
- Located in `security` directory
- Run with `npm run test:security`

## Mock Objects
- Mock implementations for testing
- Located in `mocks` directory

## Running Tests
- All tests: `npm test`
- Specific test file: `npm test -- src/path/to/test.test.ts`
- With coverage: `npm run test:coverage`

## Continuous Integration
- GitHub Actions workflow in `.github/workflows/test.yml`
- Runs on push to main/develop and on pull requests
- Includes linting, type checking, and all test suites

## Adding New Tests
1. Create test files with `.test.ts` suffix
2. Import the component/function to test
3. Write test cases using Jest syntax
4. Run tests to verify

## Test Patterns
- Use `describe` blocks to group related tests
- Use `beforeEach` to set up test environment
- Use `afterEach` to clean up after tests
- Mock external dependencies
- Test edge cases and error conditions
