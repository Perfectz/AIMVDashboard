FROM node:18-alpine

# Install FFmpeg for video assembly support
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the application port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get('http://127.0.0.1:8000/health',s=>{process.exit(s.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

# Start the server
CMD ["npm", "run", "serve"]
