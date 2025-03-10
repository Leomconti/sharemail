FROM node:20


# dependencies
RUN \
  apt-get update && \
  apt-get -y install \
  build-essential \
  curl \
  git-core \
  python-software-properties \
  libcurl4-openssl-dev \
  libc6-dev \
  libreadline-dev \
  libssl-dev \
  libxml2-dev \
  libxslt1-dev \
  libyaml-dev \
  zlib1g-dev

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
