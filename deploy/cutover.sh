#!/usr/bin/env bash
#
# سوییچ دامنهی سایت زنده از PHP نیتیو سرور به استک داکر.
#
#   cd /home/ghafari/meraat && ./deploy/cutover.sh
#
# این اسکریپت را خودت اجرا کن (نیاز به sudo دارد و وسط کار رمز میپرسد).
#
# مراحل:
#   ۱) دیتابیس زنده را دوباره دامپ میکند و داخل کانتینر میریزد، تا دادههایی
#      که بعد از استقرار روی سایت زنده نوشته شدهاند از دست نروند
#   ۲) عکسهای پرسنل را داخل volume آپلود کپی میکند
#   ۳) کانتینر را تست میکند (صفحهی اصلی، ورود، یک CSS، یک عکس) — اگر جواب
#      ندهد هیچ تغییری روی nginx داده نمیشود
#   ۴) vhost قدیمی را بکاپ میگیرد و نسخهی پروکسی را مینشاند؛ اگر nginx -t
#      رد کند، خودکار برمیگردد و reload نمیشود
#   ۵) دامنه را با https تست میکند و راه بازگشت را چاپ میکند
#
# متغیرهای قابل تغییر:
#   DOMAIN=meraat.piqagram.ir   LIVE_DIR=/var/www/meraat.piqagram.ir
set -euo pipefail

cd "$(dirname "$0")/.."

# --check-only : مراحل ۱ تا ۳ را انجام میدهد و قبل از دست زدن به nginx
#                تمام میکند. برای اینکه از سالم بودن کانتینر مطمئن شوی.
CHECK_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --check-only) CHECK_ONLY=1 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) printf 'آرگومان ناشناخته: %s\n' "$arg" >&2; exit 1 ;;
    esac
done

DOMAIN="${DOMAIN:-meraat.piqagram.ir}"
LIVE_DIR="${LIVE_DIR:-/var/www/$DOMAIN}"
WEB_PORT="${WEB_PORT:-8080}"
CONF_SRC="deploy/host-nginx-meraat.conf"
CONF_DST="/etc/nginx/sites-available/$DOMAIN"
STAMP=$(date +%F-%H%M%S)
BACKUP="$CONF_DST.bak-$STAMP"
DUMP="/tmp/meraat-cutover-$STAMP.sql.gz"

COMPOSE=(docker compose -f docker-compose.prod.yml)

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m   %s\033[0m\n' "$*"; }
warn() { printf '\033[33mهشدار: %s\033[0m\n' "$*"; }
die()  { printf '\033[31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------ پیشنیاز

[ -f docker-compose.prod.yml ] || die "docker-compose.prod.yml پیدا نشد؛ از ریشه پروژه اجرا کن."
[ -f "$CONF_SRC" ]            || die "$CONF_SRC پیدا نشد."
[ -r "$LIVE_DIR/.env" ]       || die "$LIVE_DIR/.env خوانده نمیشود؛ مسیر سایت زنده را با LIVE_DIR=... بده."

command -v sudo >/dev/null 2>&1 || die "sudo نصب نیست؛ مراحل را دستی از DEPLOY.md اجرا کن."

printf 'دامنه        : %s\n' "$DOMAIN"
printf 'سایت زنده   : %s\n' "$LIVE_DIR"
printf 'کانتینر      : 127.0.0.1:%s\n' "$WEB_PORT"

# ------------------------------------------------------- ۱) تازه کردن داده

log "۱/۵ تازه کردن دیتابیس از سایت زنده"

env_get() { sed -n "s/^$1=//p" "$LIVE_DIR/.env" | tail -n 1 | tr -d "\"'\r"; }

DBH=$(env_get DB_HOST);     DBH=${DBH:-127.0.0.1}
DBP=$(env_get DB_PORT);     DBP=${DBP:-3306}
DBN=$(env_get DB_DATABASE); DBN=${DBN:-inbox}
DBU=$(env_get DB_USERNAME)
DBW=$(env_get DB_PASSWORD)

[ -n "$DBU" ] || die "DB_USERNAME در $LIVE_DIR/.env خالی است."

# --no-tablespaces لازم است چون کاربر دیتابیس اجازهی PROCESS ندارد.
MYSQL_PWD="$DBW" nice -n 10 ionice -c3 mysqldump \
    -h "$DBH" -P "$DBP" -u "$DBU" \
    --single-transaction --quick --no-tablespaces --routines --events \
    --default-character-set=utf8mb4 "$DBN" | gzip -1 > "$DUMP"

printf '   دامپ: %s (%s)\n' "$DUMP" "$(du -h "$DUMP" | cut -f1)"
tables=$(gzip -dc "$DUMP" | grep -c '^CREATE TABLE' || true)
printf '   جدولها: %s\n' "${tables:-0}"

./deploy/import-db.sh "$DUMP" --yes
rm -f "$DUMP"

# ------------------------------------------------------------ ۲) آپلودها

log "۲/۵ تازه کردن عکسهای پرسنل"

if [ -d "$LIVE_DIR/public/images/users" ]; then
    VOL=$(docker volume ls --format '{{.Name}}' | grep -E '_meraat_uploads$' | head -n 1 || true)
    [ -n "$VOL" ] || die "volume آپلود پیدا نشد؛ اول یک بار استک را بالا بیاور."

    docker run --rm \
        -v "$VOL":/dst \
        -v "$LIVE_DIR/public/images/users":/src:ro \
        alpine sh -c 'cp -a /src/. /dst/ && chown -R 33:33 /dst'

    count=$("${COMPOSE[@]}" exec -T app sh -c 'ls /var/www/html/public/images/users | wc -l' | tr -d '\r')
    printf '   %s فایل داخل volume (%s)\n' "$count" "$VOL"
else
    warn "پوشهی آپلود سایت زنده پیدا نشد: $LIVE_DIR/public/images/users"
fi

# --------------------------------------------------- ۳) تست پیش از سوییچ

log "۳/۵ تست کانتینر روی 127.0.0.1:$WEB_PORT"

check() {
    # check <مسیر> <کدهای مجاز> <برچسب>
    local path="$1" regex="$2" label="$3" code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "http://127.0.0.1:$WEB_PORT$path" || true)
    code=${code:-000}
    printf '   %-28s HTTP %s\n' "$label" "$code"
    # Matching with =~ keeps the pattern unquoted; `case $code in $allow`
    # does NOT expand an alternation inside the variable, it treats "^(2|3)[0-9][0-9]$"
    # as one literal pattern and never matches.
    [[ "$code" =~ $regex ]]
}

fail=0
check "/"       "^(2|3)[0-9][0-9]$" "صفحهی اصلی"  || fail=1
check "/login"  "^(2|3)[0-9][0-9]$" "صفحهی ورود"  || fail=1
check "/css/panel.css" "^200$" "CSS استاتیک" || fail=1

avatar=$(ls "$LIVE_DIR/public/images/users" 2>/dev/null | head -n 1 || true)
if [ -n "$avatar" ]; then
    check "/images/users/$avatar" "^200$" "عکس پرسنل" || fail=1
fi

if [ "$fail" != "0" ]; then
    die "کانتینر جواب درست نداد؛ nginx دست نخورد. لاگ: ${COMPOSE[*]} logs --tail=50 web app"
fi
ok "کانتینر سالم است."

if [ "$CHECK_ONLY" = "1" ]; then
    ok "فقط تست (--check-only): nginx دست نخورد."
    exit 0
fi

# ---------------------------------------------------------- ۴) سوییچ nginx

log "۴/۵ سوییچ nginx میزبان به کانتینر"

sudo cp -a "$CONF_SRC" "$CONF_DST.new"

if [ -f "$CONF_DST" ]; then
    sudo cp -a "$CONF_DST" "$BACKUP"
    printf '   بکاپ: %s\n' "$BACKUP"
else
    warn "$CONF_DST وجود نداشت؛ فایل تازه ساخته میشود."
fi

sudo mv "$CONF_DST.new" "$CONF_DST"

set +e
sudo nginx -t
ok_test=$?
set -e

if [ "$ok_test" != "0" ]; then
    if [ -f "$BACKUP" ]; then
        sudo cp -a "$BACKUP" "$CONF_DST"
        warn "پیکربندی معتبر نبود؛ نسخهی قبلی برگشت و nginx ریاستارت نشد."
    fi
    die "nginx -t شکست خورد."
fi

if [ ! -e "/etc/nginx/sites-enabled/$DOMAIN" ]; then
    sudo ln -s "$CONF_DST" "/etc/nginx/sites-enabled/$DOMAIN"
fi

sudo systemctl reload nginx
ok "nginx دوباره بارگذاری شد."

# --------------------------------------------------------- ۵) تست دامنه

log "۵/۵ تست دامنه"
sleep 2

final=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$DOMAIN/" || true)
final=${final:-000}
printf '   https://%s/ → HTTP %s\n' "$DOMAIN" "$final"

case "$final" in
    2*|3*)
        ok "سایت روی استک داکر است."
        ;;
    *)
        warn "دامنه پاسخ درست نداد."
        if [ -f "$BACKUP" ]; then
            printf '\nبرای برگشت به حالت قبل:\n\n   sudo cp %s %s\n   sudo systemctl reload nginx\n\n' \
                "$BACKUP" "$CONF_DST"
        fi
        exit 1
        ;;
esac

cat <<EOF

گزارش:
  وضعیت سرویسها : ${COMPOSE[*]} ps
  لاگها          : ${COMPOSE[*]} logs -f app web
  بکاپ دیتابیس   : ${COMPOSE[*]} exec app php artisan db:backup
  بازگشت nginx   : sudo cp $BACKUP $CONF_DST && sudo systemctl reload nginx

سایت زندهی قدیمی (PHP نیتیو + MySQL میزبان) دستنخورده در $LIVE_DIR باقی است،
ولی از این لحظه نوشتن روی آن معنی ندارد: دیتابیس استک داکر جای اصلی است.
EOF
