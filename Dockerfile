FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json files
COPY package*.json ./

# Install dependencies (caching layer)
RUN npm install --prefer-offline --no-audit

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production --prefer-offline --no-audit

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Copy database files if they exist
COPY database ./database 2>/dev/null || true

EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start the application
CMD ["npm", "start"]
