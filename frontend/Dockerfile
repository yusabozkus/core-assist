FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PADDLE_ENV=production
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
RUN node -e "const u=new URL(process.env.NEXT_PUBLIC_API_URL); if(u.protocol!=='https:') throw Error('Public API must use HTTPS'); if(!['production','sandbox'].includes(process.env.NEXT_PUBLIC_PADDLE_ENV)) throw Error('Invalid Paddle environment')" \
    && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
