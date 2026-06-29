FROM golang:1.23-alpine AS email-verifier-builder
WORKDIR /src
COPY tools/aftership-email-verifier/go.mod tools/aftership-email-verifier/go.sum ./tools/aftership-email-verifier/
WORKDIR /src/tools/aftership-email-verifier
RUN go mod download
COPY tools/aftership-email-verifier/main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/aftership-email-verifier .

FROM node:22-slim AS node-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.test.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/submissions.sqlite
ENV EXPORT_DIR=/data/exports
ENV AFTERSHIP_EMAIL_VERIFIER_BIN=/app/bin/aftership-email-verifier
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=node-builder /app/dist ./dist
COPY --from=email-verifier-builder /out/aftership-email-verifier ./bin/aftership-email-verifier
RUN mkdir -p /data/exports /data/logs
CMD ["node", "dist/index.js"]
