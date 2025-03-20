# PowerShell script to compile with Node.js 16
# This script requires NVM for Windows to be installed

# Check if NVM is installed
if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
    Write-Host "NVM for Windows is not installed." -ForegroundColor Red
    Write-Host "Please install it from: https://github.com/coreybutler/nvm-windows/releases" -ForegroundColor Yellow
    Write-Host "After installing, restart your terminal and run this script again." -ForegroundColor Yellow
    exit 1
}

# Save current Node.js version
$currentVersion = (node -v)
Write-Host "Current Node.js version: $currentVersion" -ForegroundColor Cyan

# Install and use Node.js 16.20.0
Write-Host "Installing Node.js 16.20.0 (if not already installed)..." -ForegroundColor Cyan
nvm install 16.20.0

Write-Host "Switching to Node.js 16.20.0..." -ForegroundColor Cyan
nvm use 16.20.0

$nodeVersion = (node -v)
Write-Host "Using Node.js version: $nodeVersion" -ForegroundColor Green

# Clean node_modules and reinstall dependencies
Write-Host "Cleaning node_modules directory..." -ForegroundColor Cyan
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
yarn install

# Compile the contracts
Write-Host "Compiling contracts..." -ForegroundColor Cyan
yarn hardhat compile

# Check if compilation was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "Compilation successful!" -ForegroundColor Green
    
    # Optionally run tests
    $runTests = Read-Host "Would you like to run tests? (y/n)"
    if ($runTests -eq "y") {
        Write-Host "Running tests..." -ForegroundColor Cyan
        yarn hardhat test
    }
} else {
    Write-Host "Compilation failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

# Switch back to original Node.js version
Write-Host "Switching back to original Node.js version: $currentVersion" -ForegroundColor Cyan
nvm use $($currentVersion.Replace("v", ""))

Write-Host "Done!" -ForegroundColor Green
