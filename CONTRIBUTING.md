# Contributing to Flash Trade Logic

## Development Setup

1. **Prerequisites**
   - Node.js (v18 or higher)
   - npm or yarn
   - Git

2. **Environment Setup**
```bash
# Clone the repository
git clone <repository-url>
cd flashtrade-logic

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

3. **Configure Environment**
   - Fill in required values in `.env`
   - Never commit actual API keys or private keys

## Development Workflow

1. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Code Standards**
- Use TypeScript for type safety
- Follow ESLint configuration
- Write tests for new features
- Document code changes
- Follow smart contract best practices

3. **Pre-commit Checks**
```bash
# Run tests
npm test

# Run linting
npm run lint

# Check smart contract security
npx hardhat check
```

4. **Commit Guidelines**
Use semantic commit messages:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test updates
- `security:` Security improvements

## Testing

1. **Unit Tests**
```bash
npm run test:unit
```

2. **Integration Tests**
```bash
npm run test:integration
```

3. **Smart Contract Tests**
```bash
npx hardhat test
```

## Security

1. **Smart Contract Development**
- Follow Solidity best practices
- Use OpenZeppelin contracts when possible
- Document all state changes
- Include proper access control

2. **Security Checks**
- Run security tools before commits
- Review gas usage
- Check for reentrancy
- Validate input parameters

## Deployment

1. **Test Networks**
```bash
npx hardhat run scripts/deploy.js --network goerli
```

2. **Production Deployment**
- Requires admin approval
- Must pass all tests
- Security audit required
- Documentation must be updated

## Documentation

1. **Code Documentation**
- Use JSDoc for JavaScript/TypeScript
- Use NatSpec for Solidity
- Update architecture docs

2. **API Documentation**
- Document new endpoints
- Include request/response examples
- Note any rate limits

## Review Process

1. **Pull Request Requirements**
- Passing tests
- Updated documentation
- Security considerations
- Gas optimization (for contracts)

2. **Review Checklist**
- Code quality
- Test coverage
- Security implications
- Performance impact

## Questions?

Contact the core team or open an issue for clarification.
