FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./package.json
RUN npm install --omit=dev
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm install typescript --save-dev && npm run build
RUN mkdir -p /data/exports /data/logs
CMD ["node", "dist/index.js"]
