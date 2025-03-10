FROM node:20-slim

# Set working directory
WORKDIR /app

# Install build dependencies for sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    gcc \
    g++ \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies WITHOUT frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Copy the rest of your application code
COPY . .

# Create a directory for the SQLite database
RUN mkdir -p /app/data

# Set environment variable for database path
ENV SQLITE_DB_PATH=/app/data/database.db

# Expose the port your app runs on
EXPOSE 3000

# Command to run your application (updated to use server.js as per your error)
CMD ["pnpm", "start"]
