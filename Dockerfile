# Use Node.js 20 Alpine for a lightweight image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY util/ ./util/
COPY public/ ./public/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]
