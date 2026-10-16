#!/usr/bin/env bash
#
# اجرای بررسیِ منطقِ کدِ QR تأییدِ حضور، داخلِ کانتینرِ اپ روی سرور.
#
# چرا روی سرور و نه اینجا: پروژه PHPUnit ندارد و روی ماشینِ توسعه هم PHP نصب
# نیست؛ ولی همان کانتینری که کد در آن اجرا می‌شود PHP دارد. پس فایل‌ها آنجا
# کپی می‌شوند و همان‌جا هم اجرا می‌شوند — بدونِ دست‌زدن به کدِ مستقرشده (فقط
# /tmp داخلِ کانتینر) و بدونِ نیاز به دیتابیس.
#
# اجرا:
#   SERVER=root@1.2.3.4 ./scripts/check-presence-qr.sh
#   SERVER=root@1.2.3.4 CONTAINER=meraat-prod-app-1 ./scripts/check-presence-qr.sh
#
# خروجی صفر یعنی همهٔ بررسی‌ها گذشت.

set -euo pipefail

SERVER="${SERVER:-}"
CONTAINER="${CONTAINER:-meraat-prod-app-1}"
SSH_OPTS="${SSH_OPTS:-}"
REMOTE_DIR="${REMOTE_DIR:-/tmp/presence-check}"

if [ -z "$SERVER" ]; then
    echo "SERVER لازم است، مثلاً:" >&2
    echo "   SERVER=root@1.2.3.4 ./scripts/check-presence-qr.sh" >&2
    exit 2
fi

cd "$(dirname "$0")/.."

echo "==> کپی فایل‌ها به $SERVER"
ssh $SSH_OPTS "$SERVER" "mkdir -p '$REMOTE_DIR'"
scp $SSH_OPTS -q app/MobilePresence.php scripts/tests/mobile-presence.check.php "$SERVER:$REMOTE_DIR/"

echo "==> اجرا داخلِ کانتینرِ $CONTAINER"
ssh $SSH_OPTS "$SERVER" "CONTAINER='$CONTAINER' REMOTE_DIR='$REMOTE_DIR' bash -s" <<'REMOTE'
set -e

# داخلِ کانتینر یک پوشهٔ کاری می‌سازیم و همان دو فایل را می‌بریم.
docker exec "$CONTAINER" sh -c 'mkdir -p /tmp/presence-check; rm -f /tmp/presence-check/*'
docker cp "$REMOTE_DIR/MobilePresence.php" "$CONTAINER:/tmp/presence-check/MobilePresence.php"
docker cp "$REMOTE_DIR/mobile-presence.check.php" "$CONTAINER:/tmp/presence-check/check.php"

# مسیرِ require در فایلِ بررسی به پوشهٔ داخلِ کانتینر اشاره کند.
docker exec "$CONTAINER" sh -c \
    "sed -i \"s#__DIR__ . '/../../app/MobilePresence.php'#'/tmp/presence-check/MobilePresence.php'#\" /tmp/presence-check/check.php"

docker exec "$CONTAINER" php -l /tmp/presence-check/MobilePresence.php
docker exec "$CONTAINER" php -l /tmp/presence-check/check.php
docker exec "$CONTAINER" php /tmp/presence-check/check.php
REMOTE

echo "==> تمام (کد خروج ۰ یعنی همهٔ بررسی‌ها گذشت)"
