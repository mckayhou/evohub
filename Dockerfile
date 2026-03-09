# EvoHub v2.5 - Production Dockerfile
# GEP-A2A Protocol Mini-Hub

FROM node:20-alpine AS base

# Security: Run as non-root
RUN addgroup --system --gid 1001 evohub && \
    adduser --system --uid 1001 evohub

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY --chown=evohub:evohub . .

# Create logs directory
RUN mkdir -p logs && chown -R evohub:evohub logs

# Switch to non-root user
USER evohub

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "src/app.js"]
