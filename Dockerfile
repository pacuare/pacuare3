# Runs the app unchanged inside a Cloudflare Container -- see workers/container.ts
# for the Worker that fronts it and wrangler.jsonc for the container config.
FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app ./app
COPY public ./public
COPY server.ts tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "run", "start"]
