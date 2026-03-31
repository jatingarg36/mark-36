# Build stage
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source/config files
COPY . .

# Build the app (same build Vercel will use)
RUN npm run build

# Production stage — serve with Node.js static server
FROM node:23-alpine

WORKDIR /app

# Install a lightweight static server for SPA routing
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist .

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start with entrypoint script to generate runtime config
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["serve", "-s", ".", "-l", "3000"]
