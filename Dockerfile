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

RUN pnpm install

# Copy the rest of the application
COPY . .

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

CMD ["pnpm", "run", "start"]
