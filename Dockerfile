FROM node:20-alpine

WORKDIR /app

RUN apk update && apk add --no-cache \
    sqlite \
    sqlite-dev \
    python3 \
    make \
    g++ \
    && npm install -g npm


RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies including sqlite
RUN pnpm install sqlite3 --save

# Copy the rest of your application code
COPY . .

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

CMD ["pnpm", "run", "start"]
