<?php

/*
 * بررسیِ منطقِ کدِ QR تأییدِ حضور (`app/MobilePresence.php`).
 *
 * چرا این فایل وجود دارد: تمامِ امنیتِ این مسیر به سه چیز بند است — قالبِ کد،
 * امضای HMAC و پنجرهٔ زمانی. هر سه از بیرون «کار می‌کنند» و اگر یکی خراب شود
 * (مثلاً پنجرهٔ قبلی پذیرفته نشود یا امضا با کدِ کارمندِ دیگر عوض نشود) هیچ
 * خطایی دیده نمی‌شود؛ فقط تأییدِ حضور بی‌سروصدا می‌شکند یا بی‌اعتبار می‌شود.
 * پس اینها را مستقیم تست می‌کنیم.
 *
 * اجرا روی سرور (این پروژه PHPUnit ندارد و سرورِ محلی هم PHP ندارد، پس داخل
 * همان کانتینری اجرا می‌شود که کد در آن می‌دود):
 *
 *   scp scripts/tests/mobile-presence.check.php root@سرور:/tmp/
 *   ssh root@سرور "docker cp /tmp/mobile-presence.check.php meraat-prod-app-1:/tmp/ \
 *       && docker exec meraat-prod-app-1 php /tmp/mobile-presence.check.php"
 *
 * یا ساده‌تر، اسکریپت `scripts/check-presence-qr.sh` همین کار را می‌کند.
 *
 * بدونِ دیتابیس اجرا می‌شود: توابعِ ذخیره‌سازی (`confirm`/`state`) اینجا تست
 * نمی‌شوند، چون آن‌ها فقط یک in/update ساده‌اند و مسیرشان با درخواستِ واقعیِ
 * اپ سنجیده می‌شود.
 */

// --- ایستگاهِ وابستگی‌ها ------------------------------------------------------
// کلاسِ واقعی به `config()` و facade دیتابیس لاراول وابسته است؛ اینجا همان‌ها
// را با کمترین چیزِ ممکن جعل می‌کنیم تا فایل بدون اجرای لاراول تست شود.
namespace Illuminate\Support\Facades {
    class DB
    {
        public static function table($name)
        {
            throw new \RuntimeException('این بررسی نباید به دیتابیس دست بزند: ' . $name);
        }
    }
}

namespace {

    $GLOBALS['presence_config'] = [
        'services.mobile.qr.key' => 'test-key-0123456789abcdef',
        'services.mobile.qr.required' => true,
        'services.mobile.qr.window' => 30,
    ];

    function config($key, $default = null)
    {
        return $GLOBALS['presence_config'][$key] ?? $default;
    }

    require __DIR__ . '/../../app/MobilePresence.php';

    $failures = 0;
    $checks = 0;

    function check($label, $condition, $detail = '')
    {
        global $failures, $checks;
        $checks++;

        if ($condition) {
            echo "  ✔ {$label}\n";

            return;
        }

        $failures++;
        echo "  ✖ {$label}" . ($detail === '' ? '' : " — {$detail}") . "\n";
    }

    use App\MobilePresence;

    $now = 1750000000; // لحظهٔ ثابت: تست نباید به ساعتِ ماشین وابسته باشد.

    echo "منطقِ کدِ QR تأییدِ حضور\n";

    // ---------------------------------------------------------------- قالبِ کد
    $code = MobilePresence::codeFor(12, MobilePresence::windowAt($now));
    check(
        'قالبِ کد v1.<کارمند>.<پنجره>.<۱۶ کاراکترِ امضا> است',
        (bool) preg_match('/^v1\.12\.\d+\.[0-9a-f]{16}$/', $code),
        $code
    );

    // ------------------------------------------------------------ حالتِ فعال
    check('با کلیدِ پر، مسیر روشن است', MobilePresence::enabled() === true);
    check('required با کلیدِ پر و required=true یعنی بله', MobilePresence::required() === true);

    // --------------------------------------------------------------- امضا
    $other = MobilePresence::codeFor(13, MobilePresence::windowAt($now));
    check('کدِ دو کارمندِ مختلف یکی نیست', $code !== $other);

    $forged = 'v1.12.' . MobilePresence::windowAt($now) . '.0123456789abcdef';
    check(
        'کدِ دست‌ساز رد می‌شود',
        MobilePresence::verify($forged, 12, $now)['status'] === 'bad'
    );

    $tampered = substr($code, 0, -1) . ($code[strlen($code) - 1] === 'a' ? 'b' : 'a');
    check(
        'کدِ یک کاراکتر دست‌کاری‌شده رد می‌شود',
        MobilePresence::verify($tampered, 12, $now)['status'] === 'bad'
    );

    // ------------------------------------------------------------ پنجرهٔ زمانی
    $currentWindow = MobilePresence::windowAt($now);

    check(
        'کدِ پنجرهٔ جاری پذیرفته می‌شود',
        MobilePresence::verify(MobilePresence::codeFor(12, $currentWindow), 12, $now)['status'] === 'ok'
    );

    // دلیلِ پذیرشِ پنجرهٔ قبلی: کارمند می‌تواند نیم‌ثانیه پیش از عوض شدنِ کد
    // آن را خوانده باشد؛ رد کردنش یعنی پشتِ در ماندن.
    check(
        'کدِ پنجرهٔ قبلی هم پذیرفته می‌شود (برای مرزِ عوض شدنِ کد)',
        MobilePresence::verify(MobilePresence::codeFor(12, $currentWindow - 1), 12, $now)['status'] === 'ok'
    );

    check(
        'کدِ دو پنجره قبل منقضی است',
        MobilePresence::verify(MobilePresence::codeFor(12, $currentWindow - 2), 12, $now)['status'] === 'expired'
    );

    check(
        'کدِ پنجرهٔ آینده پذیرفته نمی‌شود (ساعتِ گوشی کاری نمی‌کند)',
        MobilePresence::verify(MobilePresence::codeFor(12, $currentWindow + 5), 12, $now)['status'] === 'expired'
    );

    // ------------------------------------------------------- کارمندِ دیگری
    check(
        'کدِ کارمندِ دیگر «foreign» است، نه معتبر',
        MobilePresence::verify($other, 12, $now)['status'] === 'foreign'
    );

    // ------------------------------------------------------------ خروجیِ دسته‌ای
    $payload = MobilePresence::codesFor([12, 13, 0, 12], $now);

    // کلیدهای آرایه در PHP عددی می‌شوند (‎'12'‎ → ‎12‎)، پس برای سنجش با متن
    // ابتدا رشته می‌شوند؛ همان چیزی که در JSON به کلیدِ رشته‌ای تبدیل می‌شود.
    check(
        'کدها برای همهٔ شناسه‌های سالم ساخته می‌شوند',
        array_map('strval', array_keys($payload['codes'])) === ['12', '13'],
        implode(',', array_keys($payload['codes']))
    );
    check('شناسهٔ صفر ساخته نمی‌شود', ! isset($payload['codes']['0']));
    check(
        'expires_in داخل بازهٔ پنجره است',
        $payload['expires_in'] >= 1 && $payload['expires_in'] <= MobilePresence::windowSize(),
        (string) $payload['expires_in']
    );
    check(
        'همهٔ کدهای یک پاسخ در یک پنجره‌اند',
        $payload['window'] === $currentWindow,
        (string) $payload['window']
    );

    // ------------------------------------------------------- خاموش کردنِ کلید
    $GLOBALS['presence_config']['services.mobile.qr.key'] = '';
    check('بدونِ کلید، مسیر خاموش است', MobilePresence::enabled() === false);
    check('بدونِ کلید، تأیید اجباری نیست', MobilePresence::required() === false);
    check(
        'بدونِ کلید، بررسی «disabled» می‌دهد',
        MobilePresence::verify($code, 12, $now)['status'] === 'disabled'
    );

    // ------------------------------------------- کلیدِ خاموش‌کنندهٔ اجبار
    $GLOBALS['presence_config']['services.mobile.qr.key'] = 'test-key-0123456789abcdef';
    $GLOBALS['presence_config']['services.mobile.qr.required'] = false;
    check('با required=false تأیید اجباری نیست ولی کد ساخته می‌شود', MobilePresence::required() === false && MobilePresence::enabled() === true);

    echo $failures === 0
        ? "\nهمهٔ {$checks} بررسیِ کدِ QR گذشت.\n"
        : "\n{$failures} بررسیِ ناموفق از {$checks}.\n";

    exit($failures === 0 ? 0 : 1);
}
