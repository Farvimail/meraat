#!/usr/bin/env bash
#
# فرستادن کد از این ماشین به سرور و (اختیاری) اجرای استقرار.
#
# از ریشه پروژه، روی همین ماشین اجرا کن:
#
#   SERVER=root@1.2.3.4 ./deploy/push.sh                # فقط انتقال کد
#   SERVER=root@1.2.3.4 ./deploy/push.sh --deploy        # انتقال + deploy.sh روی سرور
#
# چرا rsync نیست: Git Bash روی ویندوز rsync ندارد، ولی tar و ssh و scp را دارد.
#
# چرا آرشیو تکه‌تکه فرستاده می‌شود: ارتباط با سرور گاهی در میانهٔ یک آپلود
# طولانی ریست می‌شود (`Connection reset by peer`) و کل آرشیو باطل می‌شود. با
# تکه‌های کوچک، یک ریست فقط همان تکه را نابود می‌کند و همان تک‌تکه دوباره
# فرستاده می‌شود. در آخر جمعِ تکه‌ها با sha256 با فایل محلی مقایسه می‌شود تا
# مطمئن شویم چیزی نصفه‌نیمه باز نشده است.
#
# چه چیزی فرستاده نمی‌شود: .git، vendor (داخل ایمیج نصب می‌شود)، node_modules
# (هم ریشه و هم اپ موبایل)، .env (روی سرور می‌ماند)، inbox.sql، storage/
# (حالت اجرا) و public/images/users (آپلودهای زنده سرور باید جایگزین تصاویر
# موجود در مخزن نشوند؛ انتقالشان گام جداگانه‌ای است، در DEPLOY.md توضیح داده
# شده).
set -euo pipefail

# ---------------------------------------------------------------- تنظیمات

# user@host سرور. می‌توانی با متغیر محیطی هم بدهی.
SERVER="${SERVER:-}"
# مسیر پوشه پروژه روی سرور
REMOTE_DIR="${REMOTE_DIR:-/var/www/meraat}"
# پورت ssh و کلید، در صورت نیاز
SSH_OPTS="${SSH_OPTS:-}"
# اندازهٔ هر تکه (بایت). کوچک‌تر = مقاوم‌تر به ریست، ولی کندتر.
PART_BYTES="${PART_BYTES:-524288}"
# تعداد تلاش برای هر تکه
PART_TRIES="${PART_TRIES:-5}"

RUN_DEPLOY=0
for arg in "$@"; do
    case "$arg" in
        --deploy) RUN_DEPLOY=1 ;;
        -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
        *) echo "آرگومان ناشناخته: $arg" >&2; exit 1 ;;
    esac
done

cd "$(dirname "$0")/.."

[ -n "$SERVER" ] || {
    echo "خطا: آدرس سرور را بده. مثال:" >&2
    echo "   SERVER=root@1.2.3.4 ./deploy/push.sh --deploy" >&2
    exit 1
}

# -------------------------------------------------------------- ساخت آرشیو

TMP_DIR=$(mktemp -d)
PARTS_DIR="$TMP_DIR/parts"
ARCHIVE="$TMP_DIR/meraat-src.tar.gz"
mkdir -p "$PARTS_DIR"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

printf '\n\033[1m==> ساخت آرشیو\033[0m\n'

tar czf "$ARCHIVE" \
    --exclude=./.git \
    --exclude=./vendor \
    --exclude=./node_modules \
    --exclude=./mobile/node_modules \
    --exclude=./mobile/.expo \
    --exclude=./mobile/keys \
    --exclude=./mobile/release \
    --exclude=./mobile/dist \
    --exclude=./mobile/web-build \
    --exclude=./mobile/ios \
    --exclude=./mobile/android \
    --exclude=./.env \
    --exclude=./.env.docker \
    --exclude=./.env.production \
    --exclude=./inbox.sql \
    --exclude=./composer.phar \
    --exclude=./.orig_manager3_hash.txt \
    --exclude=./storage \
    --exclude=./public/images/users \
    --exclude=./*.log \
    .

ARCHIVE_SIZE=$(wc -c < "$ARCHIVE")
ARCHIVE_SHA=$(sha256sum "$ARCHIVE" | cut -d' ' -f1)

printf '   %s بایت (%.1f مگابایت)\n' "$ARCHIVE_SIZE" "$(awk "BEGIN{print $ARCHIVE_SIZE/1048576}")"

# ------------------------------------------------------------ تکه‌تکه کردن

split -b "$PART_BYTES" -d -a 3 "$ARCHIVE" "$PARTS_DIR/part."
PART_COUNT=$(ls -1 "$PARTS_DIR"/part.* | wc -l | tr -d ' ')

printf '\n\033[1m==> فرستادن %s تکه به %s:%s\033[0m\n' "$PART_COUNT" "$SERVER" "$REMOTE_DIR"

REMOTE_PARTS="/tmp/meraat-parts-$$"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$SERVER" "rm -rf '$REMOTE_PARTS' && mkdir -p '$REMOTE_PARTS'"

SENT=0
for part in "$PARTS_DIR"/part.*; do
    name=$(basename "$part")
    done_upload=0

    for attempt in $(seq 1 "$PART_TRIES"); do
        # shellcheck disable=SC2086
        if scp $SSH_OPTS -q "$part" "$SERVER:$REMOTE_PARTS/$name" 2>/dev/null; then
            done_upload=1
            break
        fi
        printf '   تلاش %s/%s برای %s شکست خورد؛ دوباره می‌فرستم…\n' "$attempt" "$PART_TRIES" "$name"
        sleep 2
    done

    if [ "$done_upload" != "1" ]; then
        echo "خطا: تکهٔ $name فرستاده نشد." >&2
        exit 1
    fi

    SENT=$((SENT + 1))
    printf '\r   %s/%s تکه فرستاده شد' "$SENT" "$PART_COUNT"
done
printf '\n'

# --------------------------------------------------- باز کردن روی سرور

printf '\n\033[1m==> سرهم‌کردن و باز کردن روی سرور\033[0m\n'

# shellcheck disable=SC2086
ssh $SSH_OPTS "$SERVER" 'bash -s' -- "$REMOTE_PARTS" "$REMOTE_DIR" "$ARCHIVE_SHA" <<'REMOTE_SCRIPT'
set -euo pipefail

PARTS="$1"
DIR="$2"
EXPECTED_SHA="$3"
TS=$(date +%Y%m%d-%H%M%S)
TMP="/tmp/meraat-src-$TS.tar.gz"

cat "$PARTS"/part.* > "$TMP"

ACTUAL_SHA=$(sha256sum "$TMP" | cut -d' ' -f1)
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
    echo "خطا: آرشیو روی سرور سالم نیست (sha256 نمی‌خواند)." >&2
    echo "   انتظار: $EXPECTED_SHA" >&2
    echo "   واقعی:  $ACTUAL_SHA" >&2
    rm -f "$TMP"
    exit 1
fi
printf '   sha256 درست است.\n'

# .env سرور مقدس است: قبل از هر کاری کنارش می‌گذاریم و بعد برمی‌گردانیم.
KEEP=""
if [ -f "$DIR/.env" ]; then
    KEEP="$TMP.env.keep"
    cp -a "$DIR/.env" "$KEEP"
    printf '   .env سرور کنار گذاشته شد و برمی‌گردد.\n'
fi

# درخت قبلی کنار گذاشته می‌شود تا فایل‌های حذف‌شده هم واقعا بروند (وگرنه داخل
# ایمیج پخته می‌شوند). آپلودها و دیتابیس داخل volume داکر هستند، نه این پوشه.
# درخت قبلی کپی می‌شود (نه rename): پوشه‌ی پروژه زیر /var/www است که مال
# root و drwx--x--x است، پس کاربر عادی اجازه‌ی ساختن یا تغییرنام ورودی
# داخلش را ندارد. ضمناً با rename نشدن، فایل .env که به کانتینر bind شده
# سر جایش می‌ماند و mount داکر باطل نمی‌شود.
if [ -d "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
    SNAP="$HOME/$(basename "$DIR").prev-$TS"
    cp -a "$DIR" "$SNAP"
    printf '   کپی درخت قبلی: %s\n' "$SNAP"
fi

mkdir -p "$DIR"

# پوشه از داخل خالی می‌شود تا فایل‌هایی که در مخزن حذف شده‌اند هم واقعا بروند
# (وگرنه داخل ایمیج پخته می‌شوند). آپلودها و دیتابیس در volume داکر هستند،
# نه این پوشه، پس این حذف به آن‌ها کاری ندارد.
find "$DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar xzf "$TMP" -C "$DIR"
rm -f "$TMP"

if [ -n "$KEEP" ]; then
    mv "$KEEP" "$DIR/.env"
fi

# ویندوز فایل‌ها را با CRLF ذخیره می‌کند و shebang با \r اجرا نمی‌شود.
find "$DIR/deploy" "$DIR/docker" -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
chmod +x "$DIR"/deploy/*.sh "$DIR"/docker/*.sh 2>/dev/null || true

# فقط سه درخت قبلی نگه داشته می‌شود تا دیسک پر نشود.
if ls -1d "$HOME/$(basename "$DIR").prev-"* >/dev/null 2>&1; then
    ls -1d "$HOME/$(basename "$DIR").prev-"* | sort | head -n -3 | xargs -r rm -rf
fi

rm -rf "$PARTS"

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
