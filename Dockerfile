# Multi-stage build for AI Platform
FROM node:20-alpine AS base

# Install dependencies for building native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G nodejs nodejs

WORKDIR /app

# Copy built application
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs backend/src ./src
COPY --chown=nodejs:nodejs backend/package*.json ./

# Generate Prisma client
RUN npx prisma generate

# Create directories for logs and uploads
RUN mkdir -p logs uploads mcp-servers && \
    chown -R nodejs:nodejs logs uploads mcp-servers

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]