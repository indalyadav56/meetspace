# Multi-stage Dockerfile for Next.js admin application
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Development stage
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build application for production
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy build output and source code
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "run", "start"]
