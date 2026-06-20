# Build off-server (GitHub Actions) → imagem self-contained (Next standalone).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Variáveis NEXT_PUBLIC_* são embutidas no bundle em build-time (são públicas).
# URL e anon key do Supabase têm DEFAULT aqui (são públicas por design) para o build
# ser self-contained no EasyPanel — sem precisar configurar build args. Para trocar de
# projeto Supabase, sobrescreva via --build-arg ou edite os defaults abaixo.
ARG NEXT_PUBLIC_SUPABASE_URL=https://zbwztbekgqivplrpdoxl.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpid3p0YmVrZ3FpdnBscnBkb3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTk5NzcsImV4cCI6MjA5NzUzNTk3N30.RZuWH0SxpAAoMao7bScawY8bYiVKT0fnc2TbLHVoxpM
ARG NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_CONFIG_ID
ARG NEXT_PUBLIC_META_GRAPH_VERSION
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_META_APP_ID=$NEXT_PUBLIC_META_APP_ID \
    NEXT_PUBLIC_META_CONFIG_ID=$NEXT_PUBLIC_META_CONFIG_ID \
    NEXT_PUBLIC_META_GRAPH_VERSION=$NEXT_PUBLIC_META_GRAPH_VERSION
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
