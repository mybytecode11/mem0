FROM node:22.14-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-workspace.yaml ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

FROM node:22.14-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev

# Expose HTTP port
EXPOSE 8080

ENTRYPOINT ["node", "dist/index.js"]