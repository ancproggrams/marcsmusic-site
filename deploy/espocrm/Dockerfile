FROM espocrm/espocrm:10.0.0-apache

COPY start-railway.sh /usr/local/bin/start-railway-espocrm

RUN rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf; \
    ln -sf ../mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load; \
    ln -sf ../mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf; \
    chmod +x /usr/local/bin/start-railway-espocrm

EXPOSE 80

ENTRYPOINT []
CMD ["start-railway-espocrm", "apache2-foreground"]
