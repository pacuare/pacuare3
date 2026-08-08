FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app ./app
COPY public ./public
COPY scripts ./scripts
COPY db ./db
COPY server.ts tsconfig.json ./

ENV NODE_ENV=production
# Matches server.ts's default; override with -e PORT=... at run time.
EXPOSE 44100

CMD ["npm", "run", "start:prod"]
