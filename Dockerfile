FROM node:16-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy project files
COPY . .

# Set default command
CMD ["sh", "-c", "yarn hardhat compile && yarn hardhat test"]
