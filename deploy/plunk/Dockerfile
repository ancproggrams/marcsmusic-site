# Reproducible Plunk API/worker image with the reviewed native MXRoute patch.
# This Dockerfile intentionally builds the exact upstream commit plus the
# checked-in patch; it never injects SMTP variables into an unpatched SES image.

FROM node:20-slim AS source

ARG UPSTREAM_REF=8f23d8aac479ae4e7d9926965f090c75afd3f6d5
WORKDIR /src

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --filter=blob:none --no-checkout https://github.com/useplunk/plunk.git /src \
    && git -C /src fetch --depth=1 origin "$UPSTREAM_REF" \
    && git -C /src checkout --detach "$UPSTREAM_REF" \
    && test "$(git -C /src rev-parse HEAD)" = "$UPSTREAM_REF"

COPY patches/0001-mxroute-native-starttls.patch /tmp/0001-mxroute-native-starttls.patch
RUN git -C /src apply --check /tmp/0001-mxroute-native-starttls.patch \
    && git -C /src apply /tmp/0001-mxroute-native-starttls.patch \
    && test ! -e /src/apps/api/src/services/SESService.ts \
    && ! find /src/apps/api/src -type f -not -path '*/__tests__/*' -print0 | xargs -0 grep --line-number --fixed-strings '@aws-sdk/client-ses' \
    && ! grep --line-number --fixed-strings '@aws-sdk/client-ses' /src/apps/api/package.json

FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=source /src/ ./

RUN corepack enable \
    && corepack prepare yarn@4.9.1 --activate \
    && yarn install --immutable \
    && yarn turbo build --filter=api

FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV SERVICE=api
COPY --from=build /app/ ./

# The API exposes /health. Set SERVICE=worker for the dedicated BullMQ worker
# Railway service, or SERVICE=migrate for the single migration-owner release
# service. Do not run both API and worker processes in one instance.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "case \"$SERVICE\" in migrate) exec yarn workspace @plunk/db migrate:prod ;; worker) exec node apps/api/dist/jobs/worker.js ;; api|'') exec node apps/api/dist/app.js ;; *) echo \"unknown SERVICE=$SERVICE\" >&2; exit 64 ;; esac"]
