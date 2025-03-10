FROM node:20-slim

# Set working directory
WORKDIR /app

# Install SQLite3 and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    gcc \
    g++ \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# Install dependencies and ensure sqlite3 is built from source
RUN pnpm install \
    && pnpm add sqlite3 --save \
    && pnpm rebuild sqlite3

# Copy the rest of your application code
COPY . .

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

# Command to run your application (updated to use server.js as per your error)
CMD ["pnpm", "run", "start"]
