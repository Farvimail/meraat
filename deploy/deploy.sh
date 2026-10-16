#!/usr/bin/env bash
#
# استقرار meraat روی سرور.
#
#   cd /var/www/meraat && ./deploy/deploy.sh
#
# کارهایی که می‌کند: بررسی .env، بکاپ پیش از استقرار، ساخت ایمیج، بالا آوردن
# سرویس‌ها، اجرای مهاجرت‌ها، پاک کردن کش‌ها و تست سلامت.
#
# داده زنده دست‌نخورده می‌ماند: این استک هیچ‌وقت inbox.sql را import نمی‌کند و
# دیتابیس و آپلودها روی volume می‌مانند. برای آوردن دیتابیس فعلی سرور داخل
# داکر یک‌بار deploy/import-db.sh را اجرا کن.
set -euo pipefail

cd "$(dirname "$0")/.."

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mهشدار: %s\033[0m\n' "$*"; }
die()  { printf '\033[31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }

env_get() {
    # آخرین مقدار یک کلید در .env، بدون کوتیشن و بدون CR
    sed -n "s/^$1=//p" .env | tail -n 1 | sed -e 's/^"//' -e 's/"$//' | tr -d '\r'
}

# ---------------------------------------------------------------- پیش‌نیازها

log "بررسی پیش‌نیازها"

[ -f docker-compose.prod.yml ] || die "docker-compose.prod.yml پیدا نشد؛ از ریشه پروژه اجرا کن."
[ -f .env ] || die "فایل .env وجود ندارد. از .env.production.example بساز: cp .env.production.example .env"

command -v docker >/dev/null 2>&1 || die "docker نصب نیست یا در PATH نیست"
docker info >/dev/null 2>&1 || die "دیمن داکر در دسترس نیست (systemctl status docker)"

# انتخاب ابزار compose: پلاگین v2 اگر باشد، وگرنه docker-compose v1.
#
# چرا این شاخه لازم شد: بعضی سرورها (از جمله همین سرور) فقط
# `docker-compose` نسخهٔ ۱.۲۹ دارند و `docker compose` را نمی‌شناسند. آن نسخه
# فیلد `name:` بالای فایل را نمی‌فهمد و با خطا رد می‌کند، پس برایش یک رونوشت
# بدون آن خط ساخته می‌شود و نام پروژه با `-p` داده می‌شود — همان نتیجه، بدون
# دست‌زدن به فایل اصلی.
# پلاگین `docker compose` (v2) گاهی فقط برای یک کاربرِ خاص نصب است. روی همین
# سرورِ meraat، کاربر root فقط `docker-compose` نسخهٔ ۱ را دارد و آن نسخه روی
# ایمیج‌هایی که موتورِ جدیدِ داکر ساخته باشد با `KeyError: 'ContainerConfig'`
# می‌میرد. پس اگر پلاگین در PATH نبود، binary مستقلِ compose v2 را در
# مسیرهای شناخته‌شدهٔ پلاگین (از جمله خانهٔ کاربریِ همان کسی که پلاگین را
# نصب کرده) جست‌وجو می‌کنیم؛ همان binary هم دقیقاً همان کار را می‌کند.
# هر مسیر جدا و فقط اگر واقعاً وجود داشت جست‌وجو می‌شود. `find` روی مسیرِ
# ناموجود کدِ خطا برمی‌گرداند و چون زیرِ `set -euo pipefail` هستیم، همین یک
# مسیرِ نبوده کل استقرار را **بی‌هیچ پیامی** بعد از «بررسی پیش‌نیازها» می‌بست
# (روی همین سرور فقط `/usr/libexec/docker/cli-plugins` وجود دارد).
COMPOSE_V2_BIN=""
for plugin_dir in \
    /usr/local/lib/docker/cli-plugins \
    /usr/libexec/docker/cli-plugins \
    /usr/local/share/docker/cli-plugins \
    "$HOME/.docker/cli-plugins" \
    /home/*/.docker/cli-plugins
do
    [ -d "$plugin_dir" ] || continue

    found=$(find "$plugin_dir" -maxdepth 1 -type f -name 'docker-compose*' 2>/dev/null | head -n 1 || true)

    if [ -n "$found" ]; then
        COMPOSE_V2_BIN="$found"
        break
    fi
done

if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose -f docker-compose.prod.yml)
    compose_version=$(docker compose version --short 2>/dev/null | tr -d 'v\r' || true)

    # فیلد name در docker-compose.prod.yml به compose 2.3.3+ نیاز دارد.
    case "$compose_version" in
        2.0.*|2.1.*|2.2.*) die "نسخه compose شما $compose_version است؛ حداقل 2.3.3 لازم است" ;;
    esac
elif [ -n "$COMPOSE_V2_BIN" ]; then
    warn "پلاگین docker compose در PATH کاربر فعلی نیست؛ از binary مستقل استفاده می‌شود: $COMPOSE_V2_BIN"
    COMPOSE=("$COMPOSE_V2_BIN" -f docker-compose.prod.yml)
    compose_version=$("$COMPOSE_V2_BIN" version --short 2>/dev/null | tr -d 'v\r' || true)

    case "$compose_version" in
        2.0.*|2.1.*|2.2.*) die "نسخه compose شما $compose_version است؛ حداقل 2.3.3 لازم است" ;;
    esac
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_FILE_V1=.compose.v1.yml
    grep -v '^name:' docker-compose.prod.yml > "$COMPOSE_FILE_V1"
    COMPOSE=(docker-compose -p meraat-prod -f "$COMPOSE_FILE_V1")
    compose_version=$(docker-compose version --short 2>/dev/null | tr -d 'v\r' || true)
    warn "پلاگین docker compose نیست؛ با docker-compose $compose_version ادامه می‌دهیم."
else
    die "نه پلاگین docker compose نصب است و نه دستور docker-compose"
fi

grep -qE '^APP_KEY=base64:.+' .env \
    || die "APP_KEY در .env خالی یا نامعتبر است. همان APP_KEY سایت فعلی سرور را بگذار (key:generate نزن)."

grep -qE '^DB_PASSWORD=.+'      .env || die "DB_PASSWORD در .env خالی است."
grep -qE '^DB_ROOT_PASSWORD=.+' .env || die "DB_ROOT_PASSWORD در .env خالی است."

# تازه‌سازیِ زنده (هابِ WebSocket) خاموشیِ بی‌خطری دارد، پس خالی بودنِ کلید فقط
# هشدار است و نه توقف: سرویس بالا می‌آید ولی هر خبرِ ثبت را با ۴۰۳ رد می‌کند و
# پنل به همان درخواست‌های دوره‌ای برمی‌گردد. یک هشدار اینجا کافی است تا کسی
# فکر نکند «استقرار موفق شد ولی چرا هنوز ۱۰ ثانیه تأخیر دارم؟»
grep -qE '^HUB_SECRET=.+' .env \
    || warn "HUB_SECRET در .env خالی است: تازه‌سازیِ زندهٔ پنل خاموش می‌ماند (پنل با درخواست‌های دوره‌ای کار می‌کند). راهِ روشن‌کردن: ws/README.md"

WEB_BIND=$(env_get WEB_BIND)
WEB_BIND=${WEB_BIND:-127.0.0.1}
WEB_PORT=$(env_get WEB_PORT)
WEB_PORT=${WEB_PORT:-8080}

printf '   compose %s | انتشار روی %s:%s\n' "${compose_version:-?}" "$WEB_BIND" "$WEB_PORT"

# ------------------------------------------------------- بکاپ پیش از استقرار

if [ -n "$("${COMPOSE[@]}" ps -q app 2>/dev/null || true)" ]; then
    log "بکاپ دیتابیس پیش از استقرار"
    if ! "${COMPOSE[@]}" exec -T app php artisan db:backup; then
        warn "بکاپ پیش از استقرار انجام نشد (دیتابیس احتمالا هنوز بالا نیست)."
    fi
else
    printf '   استک در حال اجرا نیست؛ از بکاپ پیش از استقرار صرف‌نظر شد.\n'
fi

# ------------------------------------------------------------- ساخت و اجرا

log "ساخت ایمیج (کد داخل ایمیج پخته می‌شود)"
"${COMPOSE[@]}" build

log "بالا آوردن سرویس‌ها"
"${COMPOSE[@]}" up -d --remove-orphans

log "انتظار برای دیتابیس"
i=0
until "${COMPOSE[@]}" exec -T db sh -c 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
        die "دیتابیس بعد از ۱۲۰ ثانیه بالا نیامد. لاگ: ${COMPOSE[*]} logs db"
    fi
    sleep 2
done
printf '   دیتابیس آماده است.\n'

log "اجرای مهاجرت‌های دیتابیس"
"${COMPOSE[@]}" exec -T app php artisan migrate --force

log "پاک کردن کش‌های وابسته به هاست"
"${COMPOSE[@]}" exec -T app php artisan config:clear
"${COMPOSE[@]}" exec -T app php artisan view:clear

# ---------------------------------------------------------------- تست سلامت

log "تست سلامت"
if command -v curl >/dev/null 2>&1; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:${WEB_PORT}/" || true)
    printf '   HTTP %s از http://127.0.0.1:%s/\n' "${code:-000}" "$WEB_PORT"
    case "${code:-000}" in
        2*|3*) ;;
        *) warn "پاسخ غیرمنتظره. لاگ‌ها: ${COMPOSE[*]} logs --tail=50 web app" ;;
    esac
else
    printf '   curl نصب نیست؛ از تست سلامت صرف‌نظر شد.\n'
fi

log "وضعیت نهایی"
"${COMPOSE[@]}" ps

[ "${COMPOSE_FILE_V1:-}" = "" ] || rm -f "$COMPOSE_FILE_V1"

cat <<EOF

انجام شد.

گام بعدی: اگر nginx خود سرور را برای پروکسی به 127.0.0.1:${WEB_PORT} تنظیم نکرده‌ای،
نمونه vhost در deploy/host-nginx-meraat.conf است.

  لاگ‌ها:        docker compose -f docker-compose.prod.yml logs -f app web
  بکاپ دستی:     docker compose -f docker-compose.prod.yml exec app php artisan db:backup
  کنسول دیتابیس: docker compose -f docker-compose.prod.yml exec db mysql -uroot -p"\$MYSQL_ROOT_PASSWORD" inbox
EOF
