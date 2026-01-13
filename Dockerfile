# ===========================================
# Finance Dashboard - Docker Configuration
# ===========================================

FROM node:20-slim

# Install dependencies for Puppeteer (bank scraper) and better-sqlite3
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create volume mount point for database persistence
VOLUME ["/app/data"]

# Expose the web server port
EXPOSE 3000

# Default command: start the server
CMD ["npm", "start"]
