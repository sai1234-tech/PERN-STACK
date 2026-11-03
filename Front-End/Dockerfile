# =============================================================================
# PERN HRMS - Frontend Dockerfile (Senior Multi-Stage: Dev + Nginx Prod)
# =============================================================================

# -----------------------------------------------------------------------------
# Base: Node.js 20 LTS Alpine
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# -----------------------------------------------------------------------------
# Target: Development (Live Vite Hot-Reload Server)
# -----------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# -----------------------------------------------------------------------------
# Stage: Production Builder
# -----------------------------------------------------------------------------
FROM base AS builder
# Do not omit devDependencies because Vite, Rollup, and plugins are needed to build
RUN npm ci --include=dev
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Target: Production (Hardened Nginx Alpine Reverse Proxy)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy production bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck to verify Nginx availability (explicitly using IPv4 loopback)
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
