FROM node:20-slim

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install

# Create a volume for the database
VOLUME /app/data

# Make sure the application uses the volume path
ENV SQLITE_DB_PATH=/app/data/emails.db

CMD ["pnpm", "run", "start"]
