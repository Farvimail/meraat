# meraat.piqagram.ir - Laravel 5.6 runtime (PHP 7.4 FPM)
#
# The application code is bind-mounted by docker-compose, so this image only
# carries the PHP runtime, the extensions meraat actually uses (GD for the
# avatar uploader, exif for photo orientation) and the php.ini tuning.
FROM php:7.4-fpm

# php:7.4-fpm is built on Debian bullseye, which has been moved to the Debian
# archive: the live bullseye-security index still advertises package versions
# whose files were deleted (404), so apt fails there. Pointing apt at the
# frozen archive keeps the index and the pool consistent, which makes the
# build reproducible. Check-Valid-Until must be disabled because the archive's
# Release files are expired by design.
RUN set -eux; \
    printf 'deb http://archive.debian.org/debian bullseye main\ndeb http://archive.debian.org/debian-security bullseye-security main\n' > /etc/apt/sources.list; \
    printf 'Acquire::Check-Valid-Until "false";\nAcquire::Retries "3";\n' > /etc/apt/apt.conf.d/99debian-archive; \
    cat /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libpng-dev libjpeg62-turbo-dev libfreetype6-dev libzip-dev libonig-dev unzip mariadb-client; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring exif gd zip bcmath opcache; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# composer is only used the first time the container starts without vendor/
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/app.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/php/fpm-pool.conf /usr/local/etc/php-fpm.d/zz-pool.conf
COPY docker/entrypoint.sh /usr/local/bin/meraat-entrypoint
RUN chmod +x /usr/local/bin/meraat-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["meraat-entrypoint"]
CMD ["php-fpm"]
