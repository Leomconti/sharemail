# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies, including python3 with distutils
RUN apk update && apk add --no-cache \
    sqlite \
    sqlite-dev \
    python3 \
    py3-pip \
    make \
    g++ \
    linux-headers \
    && npm install -g pnpm \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies and explicitly build sqlite3
RUN pnpm install --frozen-lockfile \
    && pnpm add sqlite3 --save \
    && cd node_modules/.pnpm/sqlite3*/node_modules/sqlite3 \
    && npm rebuild --build-from-source

# Final stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk update && apk add --no-cache \
    sqlite \
    && npm install -g pnpm

# Copy built node_modules and app files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
