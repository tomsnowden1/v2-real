# ── Stage 1: Build Vite frontend ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install frontend deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build with proxy mode enabled — VITE_AI_PROXY_URL tells the frontend
# to route AI calls through our server instead of directly to OpenAI.
# The key is NEVER baked into the bundle.
ARG VITE_AI_PROXY_URL=/api/openai/v1
ENV VITE_AI_PROXY_URL=${VITE_AI_PROXY_URL}

RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only server deps
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Copy server code
COPY server/index.js ./server/index.js

# Copy built frontend from stage 1
COPY --from=builder /app/dist ./dist

# Cloud Run requires PORT 8080
ENV PORT=8080
EXPOSE 8080

# OPENAI_API_KEY and MAX_DAILY_SPEND_USD are set via Cloud Run env vars
CMD ["node", "server/index.js"]
