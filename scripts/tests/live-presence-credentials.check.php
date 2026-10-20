<?php

/**
 * بررسیِ زندهٔ دو تغییر، داخلِ همان کانتینری که سایت در آن اجرا می‌شود:
 *
 *  1) تبِ «ویرایش»: تغییرِ ایمیل/پسورد واقعاً در `users` می‌نشیند و رمز هش می‌شود.
 *  2) قاعدهٔ «هر ثبتِ ورود یک تأییدِ تازه»: تأییدِ مصرف‌شده دیگر در را باز نمی‌کند.
 *
 * هر دو داخلِ تراکنش اجرا می‌شوند و در پایان rollback می‌شوند؛ هیچ داده‌ای
 * تغییر نمی‌کند. خروجی: PASS/FAIL خط‌به‌خط و کدِ خروج ۱ اگر چیزی رد شود.
 *
 * اجرا (سرور PHPUnit و PHP محلی ندارد؛ تست داخلِ همان کانتینرِ سایت می‌رود):
 *
 *   scp scripts/tests/live-presence-credentials.check.php root@سرور:/tmp/
 *   ssh root@سرور "docker cp /tmp/live-presence-credentials.check.php meraat-prod-app-1:/tmp/ \
 *       && docker exec meraat-prod-app-1 php /tmp/live-presence-credentials.check.php"
 *
 * این تست مخصوصِ استقرار است، نه `node --test`؛ پس در فهرستِ تست‌های بی‌وابستگی
 * (مثل `scripts/tests/manager-edit-tab.test.mjs`) نیست — آن‌ها کد را بدونِ
 * لاراول می‌سنجند و روی هر ماشینی با Node اجرا می‌شوند.
 */

require '/var/www/html/vendor/autoload.php';

$app = require '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\CustomerController;
use App\MobilePresence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$failures = 0;

function check($label, $ok, $detail = '')
{
    global $failures;

    if (! $ok) {
        $failures++;
    }

    echo ($ok ? 'PASS  ' : 'FAIL  ') . $label . ($detail === '' ? '' : '  [' . $detail . ']') . "\n";
}

/* ------------------------------------------------------------------ */
/* ۱) تغییرِ ایمیل و پسورد از تبِ ویرایش                                */
/* ------------------------------------------------------------------ */

echo "== credentials ==\n";

$user = DB::table('users')->whereNotNull('email')->orderBy('id')->first();

if (empty($user)) {
    check('کارمندی برای تست پیدا شد', false);
} else {
    $original = DB::table('users')->where('id', $user->id)->first();
    $newEmail = 'live-check-' . time() . '@example.com';
    $newPassword = 'LiveCheck-' . time();

    DB::beginTransaction();

    try {
        $request = Request::create('/customer/credentials', 'POST', [
            'customer_id' => $user->id,
            'email' => $newEmail,
            'password' => $newPassword,
        ]);
        $request->setLaravelSession($app['session']->driver());

        (new CustomerController())->credentials($request);

        $after = DB::table('users')->where('id', $user->id)->first();

        check('ایمیل در دیتابیس عوض شد', $after->email === $newEmail, 'db=' . $after->email);
        check('رمز با پسوردِ تازه می‌خواند', Hash::check($newPassword, $after->password));
        check('هشِ رمز عوض شد (خام ذخیره نشد)', $after->password !== $original->password && strpos($after->password, $newPassword) === false);
    } catch (\Throwable $error) {
        check('فراخوانیِ کنترلر بدونِ استثنا', false, get_class($error) . ': ' . $error->getMessage());
    }

    DB::rollBack();

    $restored = DB::table('users')->where('id', $user->id)->first();
    check('rollback: دادهٔ واقعی دست‌نخورده ماند', $restored->email === $original->email && $restored->password === $original->password);
}

/* ------------------------------------------------------------------ */
/* ۲) قاعدهٔ هر ثبت، یک تأیید                                          */
/* ------------------------------------------------------------------ */

echo "\n== presence per punch ==\n";

$customerId = DB::table('users')->orderBy('id')->value('id');
$dmy = '9999/99/99'; // روزِ ساختگی؛ ردیفِ واقعی ندارد.

DB::beginTransaction();

try {
    DB::table('tbl_mobile_presence_confirm')->where('customer_id', $customerId)->where('dmy', $dmy)->delete();

    // پیش از هر تأیید: ورود و خروج هر دو قفل‌اند.
    check('بدونِ تأیید: ورود قفل است', MobilePresence::blocksPunch($customerId, $dmy, 'start') === true);
    check('بدونِ تأیید: خروج هم قفل است', MobilePresence::blocksPunch($customerId, $dmy, 'pause') === true);

    MobilePresence::confirm($customerId, $dmy, MobilePresence::METHOD_QR, 123, '127.0.0.1');

    check('بعد از تأیید: ورود باز است', MobilePresence::blocksPunch($customerId, $dmy, 'start') === false);
    check('بعد از تأیید: خروج هم باز است', MobilePresence::blocksPunch($customerId, $dmy, 'pause') === false);
    check('state: pending=true و lock=false', MobilePresence::state($customerId, $dmy)['pending'] === true
        && MobilePresence::state($customerId, $dmy)['lock'] === false);

    // ثبت: تأیید مصرف می‌شود.
    check('مصرفِ تأیید موفق بود', MobilePresence::consume($customerId, $dmy) === true);

    check('بعد از مصرف: ورودِ بعدی دوباره قفل است', MobilePresence::blocksPunch($customerId, $dmy, 'start') === true);
    check('بعد از مصرف: خروج هم دوباره قفل است', MobilePresence::blocksPunch($customerId, $dmy, 'pause') === true);
    check('state بعد از مصرف: confirmed=true ولی pending=false', MobilePresence::state($customerId, $dmy)['confirmed'] === true
        && MobilePresence::state($customerId, $dmy)['pending'] === false
        && MobilePresence::state($customerId, $dmy, null, 'pause')['lock'] === true);

    // تأییدِ دوم = ردیفِ دوم، نه بازنویسی.
    MobilePresence::confirm($customerId, $dmy, MobilePresence::METHOD_MANUAL);

    $rows = DB::table('tbl_mobile_presence_confirm')->where('customer_id', $customerId)->where('dmy', $dmy)->count();

    check('تأییدِ دوم ردیفِ تازه ساخت', (int) $rows === 2, 'rows=' . $rows);
    check('آخرین تأیید روشِ manual است', MobilePresence::today($customerId, $dmy)->method === MobilePresence::METHOD_MANUAL);
} catch (\Throwable $error) {
    check('اجرای سناریوی حضور بدونِ استثنا', false, get_class($error) . ': ' . $error->getMessage());
}

DB::rollBack();

/* ------------------------------------------------------------------ */
/* ۳) همان قاعده از راهِ خودِ API (تستِ مرزِ نهایی)                      */
/* ------------------------------------------------------------------ */
/*
 * تستِ بالا `MobilePresence` را مستقیم صدا می‌زند؛ ولی قاعده می‌تواند درست
 * باشد و در `punch()` بی‌اثر باشد (یا جایِ اشتباه صدا زده شود). اینجا همان
 * مسیری می‌رود که گوشی می‌رود و دو چیز مهم را می‌سنجد:
 *   - بدونِ تأییدِ آماده، هم درخواستِ ورود و هم درخواستِ خروج با ۴۰۳ رد
 *     می‌شوند و **هیچ رکوردی** در `tbl_saved_time` نوشته نمی‌شود؛
 *   - پس از تأیید، ورود می‌گذرد و تأیید همان‌جا مصرف می‌شود؛ خروج بدونِ
 *     تأییدِ تازه ۴۰۳ می‌گیرد، بعد از اسکنِ دوم می‌گذرد، و بعد از آن ورودِ
 *     بعدی دوباره ۴۰۳ می‌گیرد.
 *
 * همه داخلِ یک تراکنش و با rollback، پس هیچ رکوردِ واقعی‌ای نمی‌ماند.
 */

echo "\n== api punch ==\n";

$dmy = date('dmY', strtotime(App\Http\Controllers\FunctionsController::realDate()));

/*
 * کارمندی را می‌خواهیم که نوبتش **«ورود»** باشد: روزِ خالی داشته باشد یا
 * آخرین ثبتِ امروزش بسته شده باشد (`start = 0`). نوبتِ «خروج» هم حالا تأیید
 * می‌خواهد، ولی سناریوی اصلی (۴۰۳ بدونِ تأیید، سپس اسکن و گذرِ ورود) با
 * نوبتِ ورود جلو می‌رود و خروج هم در ادامه همان سناریو سنجیده می‌شود.
 *
 * محدود به صاحبانِ گوشی نیست: در این تست middleware کنار گذاشته شده و جفتِ
 * (کارمند، گوشی) همین‌جا ساخته می‌شود؛ همهٔ سناریو داخلِ تراکنش است و با
 * rollback پایان می‌یابد.
 */
$latestStart = array();

$punchedToday = DB::table('tbl_saved_time')
    ->join('tbl_timer', 'tbl_saved_time.id', '=', 'tbl_timer.saved_time_id')
    ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
    ->where('tbl_calendar.dmy', $dmy)
    ->orderBy('tbl_saved_time.id', 'desc')
    ->select('tbl_timer.customer_id', 'tbl_saved_time.start')
    ->get();

foreach ($punchedToday as $row) {
    // آخرین ردیفِ هر کارمند برنده است — همان چیزی که `nextIntent()` می‌خواند.
    if (! isset($latestStart[(int) $row->customer_id])) {
        $latestStart[(int) $row->customer_id] = (int) $row->start;
    }
}

$user = App\User::orderBy('id')->get()->first(function ($candidate) use ($latestStart) {
    return ! isset($latestStart[(int) $candidate->id]) || $latestStart[(int) $candidate->id] === 0;
});

$device = null;

if (! empty($user)) {
    // اگر گوشیِ خودِ همان کارمند بود بهتر است؛ وگرنه هر گوشیِ فعال.
    $device = DB::table('tbl_mobile_device')
        ->where('customer_id', $user->id)
        ->whereNull('released_at')
        ->orderBy('id', 'desc')
        ->first();

    if (empty($device)) {
        $device = DB::table('tbl_mobile_device')->whereNull('released_at')->orderBy('id', 'desc')->first();
    }
}

if (empty($user) || empty($device)) {
    check('کارمندِ با نوبتِ «ورود» و گوشیِ فعال پیدا شد', false,
        'کارمند=' . (empty($user) ? 'ندارد' : $user->id)
        . '، گوشی=' . (empty($device) ? 'ندارد' : $device->device_id)
        . '، رکوردهای امروز=' . count($latestStart));
} else {
    $ip = DB::table('tbl_office_ip')->value('ip');
    $ip = $ip === null ? '127.0.0.1' : $ip;
    $controller = new App\Http\Controllers\MobileApiController();

    $call = function ($method, $payload) use ($controller, $user, $device, $ip) {
        $request = Request::create('/api/v1/' . $method, 'POST', [], [], [], ['REMOTE_ADDR' => $ip], json_encode($payload));
        $request->headers->set('Content-Type', 'application/json');
        $request->attributes->set('mobile_user', $user);
        $request->attributes->set('mobile_device', $device);

        $response = $method === 'punch' ? $controller->punch($request) : $controller->today($request);

        return [$response->getStatusCode(), json_decode($response->getContent(), true)];
    };

    DB::beginTransaction();

    try {
        // هر تأییدِ بازِ امروزِ این کارمند «مصرف‌شده» علامت می‌خورد تا نوبتِ
        // «ورود» و قفلِ سرور همان چیزی باشد که برایش تست می‌کنیم — بدونِ حذفِ
        // سابقه (و با rollback در پایان).
        DB::table('tbl_mobile_presence_confirm')
            ->where('customer_id', $user->id)
            ->where('dmy', $dmy)
            ->update(['consumed_at' => date('Y-m-d H:i:s')]);

        $punchesBefore = DB::table('tbl_saved_time')->count();

        // وضعیتی که اپ می‌بیند: باید قفل باشد و نوبت «ورود» باشد.
        list($todayStatus, $today) = $call('today', []);

        $qr = $today['qr'] ?? [];
        check('today: کدهای وضعیت را می‌دهد', $todayStatus === 200);
        check('today: qr.pending/lock/intent هست', array_key_exists('pending', $qr)
            && array_key_exists('lock', $qr) && array_key_exists('intent', $qr));
        check('today: نوبتِ ورود و قفلِ سرور', ($qr['intent'] ?? null) === 'start' && ($qr['lock'] ?? null) === true
            && ($qr['pending'] ?? null) === false);

        $punch = ['intent' => 'start', 'device_id' => $device->device_id, 'biometric_verified_at' => (int) round(microtime(true) * 1000)];

        list($status, $body) = $call('punch', $punch);

        check('بدونِ تأیید: ورود با ۴۰۳ رد می‌شود', $status === 403, 'status=' . $status);
        check('بدونِ تأیید: کدِ خطا presence_required است', ($body['error'] ?? null) === 'presence_required', json_encode($body, JSON_UNESCAPED_UNICODE));
        check('بدونِ تأیید: هیچ رکوردی نوشته نشد', DB::table('tbl_saved_time')->count() === $punchesBefore);

        // اسکن: تأییدِ تازه.
        MobilePresence::confirm($user->id, $dmy, MobilePresence::METHOD_QR, null, $ip);

        list($status, $body) = $call('punch', $punch);

        if ($status === 409 && ($body['error'] ?? null) === 'server') {
            check('با تأیید: ورود ثبت می‌شود', false, 'تقویمِ امروز پیدا نشد: ' . ($body['message'] ?? ''));
        } else {
            check('با تأیید: ورود ثبت می‌شود', $status === 200, 'status=' . $status . ' ' . json_encode($body, JSON_UNESCAPED_UNICODE));
            check('با ثبتِ ورود: تأیید مصرف شد', MobilePresence::pending($user->id, $dmy) === false);

            list($status, $body) = $call('punch', ['intent' => 'pause', 'device_id' => $device->device_id, 'biometric_verified_at' => (int) round(microtime(true) * 1000)]);
            check('خروج بدونِ تأییدِ تازه ۴۰۳ می‌گیرد (خروج هم تأیید می‌خواهد)', $status === 403 && ($body['error'] ?? null) === 'presence_required', 'status=' . $status . ' ' . json_encode($body, JSON_UNESCAPED_UNICODE));
            check('خروجِ ردشده هیچ رکوردی ننوشت', DB::table('tbl_saved_time')->count() === $punchesBefore + 1, 'count=' . DB::table('tbl_saved_time')->count());

            // اسکنِ دوم برای خروج.
            MobilePresence::confirm($user->id, $dmy, MobilePresence::METHOD_QR, null, $ip);

            list($status, $body) = $call('punch', ['intent' => 'pause', 'device_id' => $device->device_id, 'biometric_verified_at' => (int) round(microtime(true) * 1000)]);
            check('خروج با تأییدِ تازه ثبت می‌شود', $status === 200, 'status=' . $status . ' ' . json_encode($body, JSON_UNESCAPED_UNICODE));

            list($status, $body) = $call('punch', $punch);
            check('ورودِ بعدی دوباره ۴۰۳ می‌گیرد', $status === 403 && ($body['error'] ?? null) === 'presence_required', 'status=' . $status);
        }
    } catch (\Throwable $error) {
        check('اجرای سناریوی API بدونِ استثنا', false, get_class($error) . ': ' . $error->getMessage());
    }

    DB::rollBack();
}

/* ------------------------------------------------------------------ */
/* ۴) وضعیتِ migration                                                 */
/* ------------------------------------------------------------------ */

echo "\n== schema ==\n";

$columns = DB::select("SHOW COLUMNS FROM `tbl_mobile_presence_confirm` LIKE 'consumed_at'");
check('ستونِ consumed_at هست', ! empty($columns));

$unique = DB::select("SHOW INDEX FROM `tbl_mobile_presence_confirm` WHERE Key_name = 'uniq_presence_day'");
check('کلیدِ یکتای روزانه برداشته شد', empty($unique));

$pendingIndex = DB::select("SHOW INDEX FROM `tbl_mobile_presence_confirm` WHERE Key_name = 'idx_presence_pending'");
check('ایندکسِ جست‌وجویِ تأییدِ آماده هست', ! empty($pendingIndex));

$routes = collect(app('router')->getRoutes()->getRoutes())
    ->map(function ($route) {
        return $route->uri() . ' ' . implode(',', $route->methods());
    })
    ->filter(function ($line) {
        return strpos($line, 'customer/credentials') !== false || strpos($line, 'customer/device/release') !== false;
    })
    ->values()
    ->all();

check('روتِ تغییرِ اطلاعات ورود ثبت شده', count($routes) === 2, implode(' | ', $routes));

echo "\n" . ($failures === 0 ? "همهٔ بررسی‌ها گذشت.\n" : $failures . " بررسی رد شد.\n");

exit($failures === 0 ? 0 : 1);
