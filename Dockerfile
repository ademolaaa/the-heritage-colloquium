# Stage 1: Build the frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:local

# Stage 2: Production image
FROM node:18-alpine
WORKDIR /app

# Install dependencies for production
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server ./server
COPY api ./api 
# (api is php, but maybe we need some assets from it? No, it's just legacy php)

# Copy other necessary files
COPY .env.example .env

# Expose port
EXPOSE 8787

# Start the server
CMD ["node", "server/index.js"]
