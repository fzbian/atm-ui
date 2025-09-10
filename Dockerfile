# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci

# Copy sources
COPY . .

# Build frontend
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app

# Copy only what we need: server and build
COPY --from=builder /app/server ./server
COPY --from=builder /app/build ./build
COPY package*.json ./

# Install only production deps (express, sqlite3)
RUN npm ci --omit=dev && npm cache clean --force

# Env
ENV NODE_ENV=production
ENV PORT=8082
ENV DB_PATH=/data/db.sqlite

# Ensure data dir exists
RUN mkdir -p /data && chown -R node:node /data

USER node

EXPOSE 8082

# Start server which also serves the build
CMD ["node", "server/server.js"]
