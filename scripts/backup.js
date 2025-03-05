
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Add dependency for archiver
<lov-add-dependency>archiver@5.3.1</lov-add-dependency>

/**
 * Backup script for critical project files and deployments
 * This script creates archives of important configuration and deployment data
 */

const BACKUP_DIR = path.join(__dirname, '../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Critical directories to backup
const CRITICAL_DIRS = [
  { src: 'src/utils/blockchain', dest: 'blockchain-utils' },
  { src: 'src/utils/contracts', dest: 'contracts-utils' },
  { src: 'src/contracts', dest: 'contracts-src' },
  { src: 'deployments', dest: 'deployments' },
  { src: 'src/config', dest: 'config' },
];

// Archive each directory
CRITICAL_DIRS.forEach(({ src, dest }) => {
  const srcPath = path.join(__dirname, '..', src);
  
  // Skip if directory doesn't exist
  if (!fs.existsSync(srcPath)) {
    console.log(`Skipping backup of ${src} - directory does not exist`);
    return;
  }
  
  const outputPath = path.join(BACKUP_DIR, `${dest}-${TIMESTAMP}.zip`);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    console.log(`✅ Backup of ${src} created: ${outputPath} (${archive.pointer()} bytes)`);
  });
  
  archive.on('error', (err) => {
    throw err;
  });
  
  archive.pipe(output);
  archive.directory(srcPath, false);
  archive.finalize();
});

// Create database of deployments
console.log('Creating deployment database...');
const deploymentDb = {};
const deploymentsDir = path.join(__dirname, '../deployments');

if (fs.existsSync(deploymentsDir)) {
  const networks = fs.readdirSync(deploymentsDir);
  
  networks.forEach(network => {
    const deploymentPath = path.join(deploymentsDir, network, 'deployment.json');
    if (fs.existsSync(deploymentPath)) {
      try {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        deploymentDb[network] = deployment;
      } catch (err) {
        console.error(`Error reading deployment for ${network}:`, err);
      }
    }
  });
  
  // Write the deployment database
  const deploymentDbPath = path.join(BACKUP_DIR, `deployment-db-${TIMESTAMP}.json`);
  fs.writeFileSync(deploymentDbPath, JSON.stringify(deploymentDb, null, 2));
  console.log(`✅ Deployment database created: ${deploymentDbPath}`);
}

// Create a full project backup (excluding node_modules and other large directories)
console.log('Creating full project backup (excluding node_modules)...');
const fullBackupPath = path.join(BACKUP_DIR, `full-project-${TIMESTAMP}.zip`);
const fullBackupOutput = fs.createWriteStream(fullBackupPath);
const fullBackupArchive = archiver('zip', { zlib: { level: 9 } });

fullBackupOutput.on('close', () => {
  console.log(`✅ Full project backup created: ${fullBackupPath} (${fullBackupArchive.pointer()} bytes)`);
});

fullBackupArchive.on('error', (err) => {
  throw err;
});

fullBackupArchive.pipe(fullBackupOutput);

// Add all project files excluding node_modules and other directories
const projectRoot = path.join(__dirname, '..');
fullBackupArchive.glob('**/*', {
  cwd: projectRoot,
  ignore: [
    'node_modules/**',
    'dist/**',
    'cache/**',
    '.git/**',
    'backups/**'
  ]
});

fullBackupArchive.finalize();

console.log('Backup process completed!');
