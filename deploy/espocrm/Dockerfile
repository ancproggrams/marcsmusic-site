# MarcsMusic production outreach extension deployment marker: 2026-07-15.
FROM espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35

ARG TARGETARCH

ENV ESPOCRM_VERSION=10.0.2

COPY start-railway.sh /usr/local/bin/start-railway-espocrm
COPY run-railway-processes.sh /usr/local/bin/run-railway-espocrm
COPY run-shared-daemon.sh /usr/local/bin/run-shared-espocrm-daemon
COPY run-runtime-watchdog.sh /usr/local/bin/run-espocrm-watchdog
COPY install-outreach-extension.sh /usr/local/bin/install-outreach-extension
COPY database-state.php /usr/local/bin/espocrm-database-state
COPY validate-runtime-config.php /usr/local/bin/espocrm-validate-runtime-config
COPY runtime-attestation.php /usr/local/bin/espocrm-runtime-attestation
COPY assert-outreach-schema.php /usr/local/bin/espocrm-assert-outreach-schema
COPY with-mysql-advisory-lock.php /usr/local/bin/with-mysql-advisory-lock
COPY validate-deployment-attestation.php /usr/local/bin/espocrm-validate-deployment-attestation
COPY runtime.php /opt/marcsmusic/runtime.php
COPY Dockerfile /opt/marcsmusic/image-build/Dockerfile
COPY readyz.php /var/www/html/public/readyz.php
COPY build-extension-package.php /usr/local/bin/build-espocrm-extension-package
COPY build-runtime-contract.php /usr/local/bin/build-espocrm-runtime-contract
COPY extensions/marcsmusic-outreach /opt/marcsmusic-outreach-extension

RUN set -eux; \
    case "$TARGETARCH" in \
        amd64) \
            tini_asset='tini-static-amd64'; \
            tini_sha256='c5b0666b4cb676901f90dfcb37106783c5fe2077b04590973b885950611b30ee' \
            ;; \
        arm64) \
            tini_asset='tini-static-arm64'; \
            tini_sha256='eae1d3aa50c48fb23b8cbdf4e369d0910dfc538566bfd09df89a774aa84a48b9' \
            ;; \
        *) \
            echo >&2 "Unsupported target architecture for the pinned init binary: $TARGETARCH"; \
            exit 1 \
            ;; \
    esac; \
    curl --fail --show-error --silent --location \
        "https://github.com/krallin/tini/releases/download/v0.19.0/${tini_asset}" \
        --output /usr/local/bin/tini; \
    echo "${tini_sha256}  /usr/local/bin/tini" | sha256sum --check --strict; \
    chmod 0755 /usr/local/bin/tini; \
    command -v setsid; \
    command -v setpriv; \
    command -v flock; \
    command -v timeout; \
    command -v sync; \
    php -r 'exit(function_exists("posix_getpwnam") && function_exists("posix_getgrnam") ? 0 : 1);'; \
    php /usr/local/bin/build-espocrm-extension-package \
        /opt/marcsmusic-outreach-extension \
        /opt/marcsmusic-outreach-extension.zip \
        /opt/marcsmusic-outreach-installed-payload.json; \
    php -r 'file_put_contents("/opt/marcsmusic-outreach-extension.sha256", hash_file("sha256", "/opt/marcsmusic-outreach-extension.zip") . PHP_EOL);'; \
    rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf; \
    ln -sf ../mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load; \
    ln -sf ../mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf; \
    chmod 0644 \
        /opt/marcsmusic/runtime.php \
        /opt/marcsmusic-outreach-extension.sha256 \
        /opt/marcsmusic-outreach-installed-payload.json \
        /usr/local/bin/espocrm-database-state \
        /usr/local/bin/espocrm-validate-runtime-config \
        /usr/local/bin/espocrm-runtime-attestation \
        /usr/local/bin/espocrm-assert-outreach-schema \
        /usr/local/bin/with-mysql-advisory-lock \
        /usr/local/bin/espocrm-validate-deployment-attestation \
        /usr/local/bin/build-espocrm-runtime-contract; \
    chmod 0755 \
        /usr/local/bin/start-railway-espocrm \
        /usr/local/bin/run-railway-espocrm \
        /usr/local/bin/run-shared-espocrm-daemon \
        /usr/local/bin/run-espocrm-watchdog \
        /usr/local/bin/install-outreach-extension; \
    php /usr/local/bin/build-espocrm-runtime-contract \
        /opt/marcsmusic-runtime-contract.sha256 \
        'espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35'; \
    chmod 0444 /opt/marcsmusic-runtime-contract.sha256

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/tini", "-g", "--", "/usr/local/bin/start-railway-espocrm"]
CMD ["run-railway-espocrm"]
