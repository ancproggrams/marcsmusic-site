FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY crawler.py /app/crawler.py
COPY sources.json /app/sources.json
COPY entrypoint.sh /app/entrypoint.sh

RUN useradd --system --create-home --uid 10001 crawler \
    && mkdir -p /data \
    && chown -R crawler:crawler /app /data \
    && chmod 0755 /app/entrypoint.sh

USER root
ENTRYPOINT ["/app/entrypoint.sh"]
