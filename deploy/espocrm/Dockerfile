FROM espocrm/espocrm:latest

COPY start-railway.sh /usr/local/bin/start-railway-espocrm

RUN if command -v a2dismod >/dev/null 2>&1; then \
      a2dismod mpm_event mpm_worker || true; \
      a2enmod mpm_prefork || true; \
    fi; \
    chmod +x /usr/local/bin/start-railway-espocrm

EXPOSE 80

ENTRYPOINT ["start-railway-espocrm"]
CMD ["apache2-foreground"]
