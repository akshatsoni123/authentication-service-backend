# Multi-stage production image for authentication-service (Issue #16)
# - Stage "deps": install production node_modules (bcrypt needs Alpine build toolchain)
# - Stage "runner": copy app + deps, run as non-root

FROM node:20-alpine AS deps
WORKDIR /app

# bcrypt native compile on Alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- development (optional compose.dev target; includes nodemon) ----
FROM node:20-alpine AS deps-dev
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

FROM node:20-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY package.json package-lock.json knexfile.js ./
COPY src ./src
COPY scripts ./scripts
RUN chown -R app:app /app
USER app
EXPOSE 3000
ENTRYPOINT ["node", "scripts/docker-entrypoint.js"]
CMD ["npx", "nodemon", "src/server.js"]

# ---- production runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json knexfile.js ./
COPY src ./src
COPY scripts ./scripts

RUN chown -R app:app /app
USER app

EXPOSE 3000

ENTRYPOINT ["node", "scripts/docker-entrypoint.js"]
CMD ["node", "src/server.js"]
