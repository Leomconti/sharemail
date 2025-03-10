FROM node:20-slim

# Install essential build tools
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    sqlite3

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Force rebuilding sqlite3 for the current Node.js version
RUN npm config set sqlite3_binary_host_mirror=https://mapbox-node-binary.s3.amazonaws.com/ \
    && npm config set sqlite3_binary_site=https://mapbox-node-binary.s3.amazonaws.com/sqlite3

# Install dependencies with specific rebuild for sqlite3
RUN pnpm install --no-frozen-lockfile
RUN pnpm rebuild sqlite3 --build-from-source

# Copy the rest of the application
COPY . .

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

CMD ["pnpm", "run", "start"]
