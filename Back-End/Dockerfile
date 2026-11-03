# =============================================================================
# PERN HRMS - Backend Dockerfile (Senior Multi-Stage: Dev + Prod)
# =============================================================================

# -----------------------------------------------------------------------------
# Base: Hardened Alpine Linux with Node.js 20 LTS & Tini (Signal Forwarding)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install tini for proper PID 1 signal forwarding (graceful SIGTERM/SIGINT)
RUN apk add --no-cache tini wget curl

WORKDIR /app

# Ensure non-root node user owns workspace directory
RUN mkdir -p /app/uploads && chown -R node:node /app

# Install dependencies first for optimal Docker layer caching
COPY --chown=node:node package*.json ./

# -----------------------------------------------------------------------------
# Target: Development (Includes nodemon and full devDependencies)
# -----------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY --chown=node:node . .
USER node
EXPOSE 5005
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Target: Production (Lean, hardened, non-root, production dependencies only)
# -----------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .

USER node
EXPOSE 5005

# Healthcheck to verify Express API responsiveness
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5005/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
