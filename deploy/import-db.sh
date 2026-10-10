#!/usr/bin/env bash
#
# آوردن دیتابیس فعلی سرور داخل کانتینر دیتابیس.
#
#   ./deploy/import-db.sh /root/meraat-live.sql.gz
#   ./deploy/import-db.sh backup.sql --yes
#
# این کار فقط یک‌بار لازم است: وقتی می‌خواهی سایت فعلی (که با MySQL بومی سرور
# اجرا می‌شود) به این استک داکری منتقل شود. بعد از آن دیتابیس داخل volume
# می‌ماند و هر استقرار بعدی به آن دست نمی‌زند.
#
# توجه: تمام جداول فعلی دیتابیس مقصد DROP و از فایل بازسازی می‌شوند.
set -euo pipefail

cd "$(dirname "$0")/.."

DUMP="${1:-}"
CONFIRM="${2:-}"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$DUMP" ]  || die "مسیر فایل دامپ را بده. مثال: ./deploy/import-db.sh /root/live.sql.gz"
[ -f "$DUMP" ]  || die "فایل «$DUMP» پیدا نشد."
[ -f .env ]     || die ".env پیدا نشد."

COMPOSE=(docker compose -f docker-compose.prod.yml)

DB_NAME=$(sed -n 's/^DB_DATABASE=//p' .env | tail -n 1 | tr -d '"\r ')
DB_NAME=${DB_NAME:-inbox}

if [ -z "$("${COMPOSE[@]}" ps --status running -q db 2>/dev/null || true)" ]; then
    die "کانتینر دیتابیس بالا نیست. اول این را اجرا کن: docker compose -f docker-compose.prod.yml up -d db"
fi

if [ "$CONFIRM" != "--yes" ]; then
    cat <<EOF
دیتابیس مقصد : $DB_NAME
فایل ورودی   : $DUMP
اندازه       : $(du -h "$DUMP" | cut -f1)

تمام جداول فعلی «$DB_NAME» حذف و از این فایل بازسازی می‌شوند.
(volume دیتابیس با «docker compose -f docker-compose.prod.yml down -v» پاک می‌شود.)

برای ادامه دوباره با --yes اجرا کن:
   ./deploy/import-db.sh "$DUMP" --yes
EOF
    exit 0
fi

# قبل از دست زدن به چیزی، از وضعیت فعلی مقصد هم بکاپ بگیر تا اگر دامپ اشتباه
# بود راه برگشت وجود داشته باشد.
if [ -n "$("${COMPOSE[@]}" ps --status running -q app 2>/dev/null || true)" ]; then
    log "بکاپ دیتابیس فعلی مقصد"
    "${COMPOSE[@]}" exec -T app php artisan db:backup \
        || printf 'هشدار: بکاپ دیتابیس فعلی انجام نشد.\n'
else
    printf 'کنتینر app بالا نیست؛ از بکاپ دیتابیس مقصد صرف‌نظر شد.\n'
fi

log "بارگذاری دامپ"
MYSQL_CMD='mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
case "$DUMP" in
    *.gz)  gzip -dc "$DUMP" | "${COMPOSE[@]}" exec -T db sh -c "$MYSQL_CMD" ;;
    *.sql) cat "$DUMP"      | "${COMPOSE[@]}" exec -T db sh -c "$MYSQL_CMD" ;;
    *) die "فقط .sql یا .sql.gz پشتیبانی می‌شود." ;;
esac

log "شمارش جداول بارگذاری‌شده"
"${COMPOSE[@]}" exec -T db sh -c \
    'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "select count(*) from information_schema.tables where table_schema = database()"'

log "اجرای مهاجرت‌های باقی‌مانده"
"${COMPOSE[@]}" exec -T app php artisan migrate --force

cat <<EOF

دامپ بارگذاری شد.

آپلودهای فعلی سایت (عکس پرسنل) جدا از دیتابیس‌اند و باید به volume آپلود هم
منتقل شوند:

   docker compose -f docker-compose.prod.yml cp /var/www/meraat/public/images/users/. app:/var/www/html/public/images/users/

یا اگر volume آپلود هنوز ساخته نشده، کپی داخل پوشه پروژه پیش از اولین build
کافی است، چون volume اولین بار از محتوای ایمیج پر می‌شود.
EOF
