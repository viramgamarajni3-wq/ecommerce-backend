FROM node:20-alpine AS builder

WORKDIR /app

# Copy root lock, package.json AND turbo config
COPY package*.json turbo.json ./
# Copy workspace package.json
COPY backend/medusa-server/package.json ./backend/medusa-server/

# Install root dependencies (caching layer)
RUN npm install --prefer-offline --no-audit

# Copy source
COPY backend/medusa-server ./backend/medusa-server

# Build app using workspace logic
RUN npm run build --workspace=medusa-server

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
COPY backend/medusa-server/package.json ./backend/medusa-server/
RUN npm install --only=production --prefer-offline --no-audit

# Copy compiled files
COPY --from=builder /app/backend/medusa-server/dist ./backend/medusa-server/dist
COPY --from=builder /app/backend/medusa-server/database ./backend/medusa-server/database

EXPOSE 9000

# Start command (using workspace script)
CMD ["npm", "run", "start", "--workspace=medusa-server"]
