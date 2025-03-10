FROM node:20


RUN apt-get -y install sqlite3 libsqlite3-dev


# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy all files from the current directory to the container
COPY . .

# Install project dependencies using pnpm
RUN pnpm install

# Create a volume for the database
VOLUME /app/data

# Set environment variable for SQLite database path
ENV SQLITE_DB_PATH=/app/data/emails.db

# Command to run the application
CMD ["pnpm", "run", "start"]
