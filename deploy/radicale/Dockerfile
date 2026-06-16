FROM python:3.12-alpine

RUN pip install --no-cache-dir "radicale[bcrypt]==3.*"

COPY config /etc/radicale/config

VOLUME ["/data"]
EXPOSE 5232

CMD ["radicale", "--config", "/etc/radicale/config"]
