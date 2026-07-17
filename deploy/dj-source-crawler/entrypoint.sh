#!/bin/sh
set -eu

# Railway volumes are mounted root-owned even when the image has a non-root
# default user. Only this directory is adjusted, then the crawler drops back to
# its dedicated unprivileged account before reading or writing source data.
install -d -o crawler -g crawler -m 0700 /data
exec su -s /bin/sh crawler -c 'exec python /app/crawler.py'
