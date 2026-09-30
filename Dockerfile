# KliekNet dashboard — production image (used by Coolify)
FROM node:22-bookworm-slim

WORKDIR /app

# Install backend dependencies first (cached between deploys)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund

# Copy the rest of the app (frontend pages + backend code)
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# /data = persistent volume for the SQLite database and uploads
VOLUME ["/data"]
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "index.js"]
