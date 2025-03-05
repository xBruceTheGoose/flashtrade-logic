
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c174070a-5981-4bb8-8d67-883eddd9729c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c174070a-5981-4bb8-8d67-883eddd9729c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Deployment Guide

This project supports multiple deployment options and environments.

### Frontend Deployment

#### Deploy to Netlify

1. Connect your repository to Netlify
2. Set the build command to `npm run build`
3. Set the publish directory to `dist`
4. Add environment variables as needed

#### Deploy to Vercel

1. Connect your repository to Vercel
2. The Vercel configuration file (`vercel.json`) is already set up
3. Vercel will automatically detect the correct settings

#### Manual Deployment

```sh
# Build for production
npm run build

# The dist folder can be deployed to any static hosting service
```

### Smart Contract Deployment

#### Deploy to a specific network

```sh
# Deploy to Ethereum mainnet
npx hardhat run scripts/deploy.js --network ethereum

# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon
```

#### Deploy to all networks

```sh
# Deploy to all configured networks
node scripts/deploy-all-networks.js
```

### Environment Configuration

The application uses different configurations based on the environment:

- `development`: Local development environment
- `staging`: Pre-production testing environment
- `production`: Production environment

To specify the environment during build:

```sh
# Build for production
npm run build -- --mode production

# Build for staging
npm run build -- --mode staging
```

### Custom Domain Setup

1. Configure your DNS provider by adding:
   - An A record pointing to your hosting provider's IP
   - A CNAME record for the www subdomain

2. In your hosting provider (Netlify/Vercel):
   - Go to domain settings
   - Add your custom domain
   - Enable HTTPS

### Backup and Recovery

Run the backup script to create archives of critical project files:

```sh
node scripts/backup.js
```

Backups will be stored in the `backups` directory.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Ethers.js for blockchain interaction
- Hardhat for smart contract development
