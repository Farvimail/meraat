#!/bin/sh
# meraat container entrypoint (production).
#
# The image already contains vendor/, the compiled class map and the package
# manifest, so this script only deals with things that live outside the image:
# the mounted volumes, the database and the mounted .env.
set -e

cd /var/www/html

# --- volumes must exist and be writable by php-fpm --------------------------
# storage/ and public/images/users are named volumes. Docker seeds an empty
# volume from the image the first time, but the directories are created here
# too so a wiped volume still boots.
for d in \
    storage/app/backups \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    public/images/users ; do
    mkdir -p "$d" 2>/dev/null || true
done

chown -R www-data:www-data storage bootstrap/cache public/images/users 2>/dev/null || true
chmod -R ug+rwX storage bootstrap/cache public/images/users 2>/dev/null || true

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

# --- caches that depend on this host ----------------------------------------
# Compiled Blade views live inside the storage volume and reference absolute
# host paths, so they must not survive a rebuild or a move between hosts.
#
# `config:cache` is deliberately NOT used: config/ is read from the mounted
# .env on each boot, and a stale config cache is the classic cause of
# "I changed .env and nothing happened".
php artisan config:clear >/dev/null 2>&1 || true
php artisan route:clear  >/dev/null 2>&1 || true
php artisan view:clear   >/dev/null 2>&1 || true

exec "$@"
