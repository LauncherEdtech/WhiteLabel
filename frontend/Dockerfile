FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copia public apenas se existir
RUN mkdir -p ./public
EXPOSE 3000
CMD ["node", "server.js"]
