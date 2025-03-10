# Use official Node.js runtime as base image (using 20 since your error shows v20.18.3)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install SQLite3 and build dependencies
RUN apk update && apk add --no-cache \
    sqlite \
    sqlite-dev \
    python3 \
    make \
    g++ \
    && npm install -g pnpm

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# Install dependencies and ensure sqlite3 is built from source
RUN pnpm install --frozen-lockfile \
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
