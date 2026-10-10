#!/bin/sh
# meraat container entrypoint: prepare vendor/, wait for MySQL, fix permissions
# and refresh the caches that may have been generated on another host.
set -e

cd /var/www/html

# --- vendor/ is git-ignored: install it on first boot if it is missing -------
if [ ! -f vendor/autoload.php ]; then
    echo "[meraat] vendor/ not found - running composer install"
    composer install --no-dev --prefer-dist --no-interaction --no-progress || true
fi

# --- wait until the database really accepts connections ---------------------
if [ -n "$DB_HOST" ]; then
    echo "[meraat] waiting for database $DB_HOST:${DB_PORT:-3306} ..."
    i=0
    until php -r '
        $h = getenv("DB_HOST"); $p = getenv("DB_PORT") ?: 3306;
        $d = getenv("DB_DATABASE"); $u = getenv("DB_USERNAME"); $w = getenv("DB_PASSWORD");
        try { new PDO("mysql:host=$h;port=$p;dbname=$d", $u, $w, [PDO::ATTR_TIMEOUT => 2]); }
        catch (Throwable $e) { exit(1); }
    ' >/dev/null 2>&1; do
        i=$((i + 1))
        if [ "$i" -ge 60 ]; then
            echo "[meraat] database not reachable after 60 tries - continuing anyway"
            break
        fi
        sleep 2
    done
    echo "[meraat] database is up"
fi

# --- storage/ and bootstrap/cache must stay writable by php-fpm -------------
for d in storage storage/app storage/framework storage/framework/cache \
         storage/framework/sessions storage/framework/views storage/logs \
         bootstrap/cache; do
    mkdir -p "$d" 2>/dev/null || true
done
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true

# --- drop caches that may point at the old host -----------------------------
php artisan package:discover --ansi >/dev/null 2>&1 || true
php artisan config:clear >/dev/null 2>&1 || true
php artisan route:clear  >/dev/null 2>&1 || true
php artisan view:clear   >/dev/null 2>&1 || true

exec "$@"
