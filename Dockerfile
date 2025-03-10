FROM node:20-slim

RUN apt-update && apt-get install -y \
    python3 \
    make \
    gcc \
    g++ \
    libc6-dev

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

CMD ["pnpm", "run", "start"]
