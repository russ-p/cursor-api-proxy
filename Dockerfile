# Build stageB
FROM node:lts-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy TypeScript source
COPY tsconfig.json ./
COPY src/ ./src/

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# Build TypeScript
RUN npm run build

# Production stage
FROM node:lts-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create directory for sessions log
RUN mkdir -p /app/.cursor-api-proxy/sessions

# Expose default port
EXPOSE 8765

# Set environment variables
ENV CURSOR_BRIDGE_HOST=0.0.0.0 \
    CURSOR_BRIDGE_PORT=8765 \
    CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=true

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the proxy
CMD ["node", "dist/cli.js"]