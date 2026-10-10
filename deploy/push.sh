#!/usr/bin/env bash
#
# فرستادن کد از این ماشین به سرور و (اختیاری) اجرای استقرار.
#
# از ریشه پروژه، روی همین ماشین اجرا کن:
#
#   SERVER=root@1.2.3.4 ./deploy/push.sh                # فقط انتقال کد
#   SERVER=root@1.2.3.4 ./deploy/push.sh --deploy        # انتقال + deploy.sh روی سرور
#
# چرا rsync نیست: Git Bash روی ویندوز rsync ندارد، ولی tar و ssh را دارد، پس
# آرشیو از طریق ssh stream می‌شود. روی سرور هم tar معمولا نصب است.
#
# چه چیزی فرستاده نمی‌شود: .git، vendor (داخل ایمیج نصب می‌شود)، node_modules،
# .env (روی سرور می‌ماند)، inbox.sql، storage/ (حالت اجرا) و
# public/images/users (آپلودهای زنده سرور باید جایگزین تصاویر موجود در مخزن
# نشوند؛ انتقالشان گام جداگانه‌ای است، در DEPLOY.md توضیح داده شده).
set -euo pipefail

# ---------------------------------------------------------------- تنظیمات

# user@host سرور. می‌توانی با متغیر محیطی هم بدهی.
SERVER="${SERVER:-}"
# مسیر پوشه پروژه روی سرور
REMOTE_DIR="${REMOTE_DIR:-/srv/meraat}"
# پورت ssh و کلید، در صورت نیاز
SSH_OPTS="${SSH_OPTS:-}"

RUN_DEPLOY=0
for arg in "$@"; do
    case "$arg" in
        --deploy) RUN_DEPLOY=1 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) echo "آرگومان ناشناخته: $arg" >&2; exit 1 ;;
    esac
done

cd "$(dirname "$0")/.."

[ -n "$SERVER" ] || {
    echo "خطا: آدرس سرور را بده. مثال:" >&2
    echo "   SERVER=root@1.2.3.4 ./deploy/push.sh --deploy" >&2
    exit 1
}

# ------------------------------------------------------------ فرستادن آرشیو

TMP_REMOTE="/tmp/meraat-src-$$.tar.gz"

printf '\n\033[1m==> فرستادن کد به %s:%s\033[0m\n' "$SERVER" "$REMOTE_DIR"
# shellcheck disable=SC2086
tar czf - \
    --exclude=./.git \
    --exclude=./vendor \
    --exclude=./node_modules \
    --exclude=./.env \
    --exclude=./.env.docker \
    --exclude=./.env.production \
    --exclude=./inbox.sql \
    --exclude=./composer.phar \
    --exclude=./.orig_manager3_hash.txt \
    --exclude=./storage \
    --exclude=./public/images/users \
    --exclude=./*.log \
    . | ssh $SSH_OPTS "$SERVER" "cat > '$TMP_REMOTE'"

# --------------------------------------------------- آماده‌سازی روی سرور

printf '\n\033[1m==> باز کردن روی سرور\033[0m\n'

# shellcheck disable=SC2086
ssh $SSH_OPTS "$SERVER" 'bash -s' -- "$TMP_REMOTE" "$REMOTE_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail

TMP="$1"
DIR="$2"
TS=$(date +%Y%m%d-%H%M%S)

# .env سرور مقدس است: قبل از هر کاری کنارش می‌گذاریم و بعد برمی‌گردانیم.
KEEP=""
if [ -f "$DIR/.env" ]; then
    KEEP="$TMP.env.keep"
    cp -a "$DIR/.env" "$KEEP"
    printf '   .env سرور کنار گذاشته شد و برمی‌گردد.\n'
fi

# درخت قبلی کنار گذاشته می‌شود تا فایل‌های حذف‌شده هم واقعا بروند (وگرنه داخل
# ایمیج پخته می‌شوند). آپلودها و دیتابیس داخل volume داکر هستند، نه این پوشه.
if [ -d "$DIR" ]; then
    mv "$DIR" "$DIR.prev-$TS"
fi
mkdir -p "$DIR"

tar xzf "$TMP" -C "$DIR"
rm -f "$TMP"

if [ -n "$KEEP" ]; then
    mv "$KEEP" "$DIR/.env"
fi

# ویندوز فایل‌ها را با CRLF ذخیره می‌کند و shebang با \r اجرا نمی‌شود.
find "$DIR/deploy" "$DIR/docker" -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
chmod +x "$DIR"/deploy/*.sh "$DIR"/docker/*.sh 2>/dev/null || true

# فقط سه درخت قبلی نگه داشته می‌شود تا دیسک پر نشود.
if ls -1d "$DIR".prev-* >/dev/null 2>&1; then
    ls -1d "$DIR".prev-* | sort | head -n -3 | xargs -r rm -rf
fi

printf '   کد در %s باز شد.\n' "$DIR"
REMOTE_SCRIPT

# ------------------------------------------------------------ اجرای استقرار

if [ "$RUN_DEPLOY" = "1" ]; then
    printf '\n\033[1m==> اجرای deploy.sh روی سرور\033[0m\n'
    # shellcheck disable=SC2086
    ssh $SSH_OPTS "$SERVER" "cd '$REMOTE_DIR' && ./deploy/deploy.sh"
else
    cat <<EOF

کد روی سرور است. برای استقرار:

   ssh $SERVER
   cd $REMOTE_DIR
   ./deploy/deploy.sh

EOF
fi
