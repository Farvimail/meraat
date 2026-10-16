<?php

namespace App;

use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| تأیید حضور با کدِ چرخانِ QR
|--------------------------------------------------------------------------
|
| مسئله‌ای که این کلاس حل می‌کند: ثبتِ ورود از گوشی می‌تواند از هر جایی انجام
| شود؛ نه مدرکی هست که کارمند واقعاً در محل کار بوده. ایده: پنل روی کارتِ هر
| کارمند یک QR نشان می‌دهد که هر ۳۰ ثانیه عوض می‌شود، و کارمند همان لحظه با
| دوربینِ اپ اسکنش می‌کند. پس دو چیز هم‌زمان لازم است: گوشیِ خودِ کارمند (توکن)
| و بودن در برابرِ صفحه‌ای که فقط داخلِ محل کار است.
|
| ترتیب: **اول تأییدِ حضور، بعد ثبتِ ورود و خروج.** یعنی تا کارمند QR کارتِ
| خودش را اسکن نکند (یا مدیر دستی تأییدش نکند) هیچ ثبتی برایش انجام نمی‌شود؛
| قفل در خودِ API است (`MobileApiController::punch`) نه فقط در دکمهٔ اپ —
| وگرنه با یک درخواستِ دستی می‌شد از قاعده رد شد. جزئیات در `blocksPunch()`.
|
| چرا عکسِ QR بی‌فایده است: کد به «پنجرهٔ زمانی» گره خورده و با هر پنجره عوض
| می‌شود؛ عکسِ گرفته‌شده و واتساپ‌شده در پنجرهٔ بعد اعتبار ندارد. سرور فقط
| پنجرهٔ جاری و پنجرهٔ قبلی را می‌پذیرد (پنجرهٔ قبلی برای این است که اگر کد
| نیم‌ثانیه پیش از عوض شدن خوانده شد، کارمند پشتِ در نماند).
|
| چرا جدولِ جدا و نه دست‌زدن به جدول‌های حضور: رکوردِ حضور همان `tbl_saved_time`
| و `tbl_timer` می‌ماند (تا همهٔ گزارش‌ها و حقوق دستمزد همان‌طور ببینند)؛ اینجا
| فقط یک نشانهٔ «تأیید شد، به این روش، در این لحظه» کنارش نگه داشته می‌شود.
|
| خاموش کردن: اگر `MOBILE_QR_KEY` خالی باشد این کلاس کامل بی‌اثر است؛
| `MOBILE_QR_REQUIRED=false` هم شرطِ تأیید را برمی‌دارد ولی نمایشِ QR و ثبتِ
| تأییدِ دستیِ مدیر کار می‌کند. پس استقرارِ کد هیچ‌وقت کارمندی را پشتِ در نگه
| نمی‌دارد.
*/

class MobilePresence
{
    /** پیش‌شمارهٔ قالبِ کد؛ اگر روزی قالب عوض شد، کدهای کهنه رد می‌شوند. */
    const PREFIX = 'v1';

    /** اندازهٔ پنجرهٔ زمانی (ثانیه) — پیش‌فرضِ قرارداد با اپ. */
    const WINDOW_SECONDS = 30;

    /** چند کاراکتر از MAC در کد می‌آید (۱۶ کاراکتر = ۶۴ بیت؛ برای ۳۰ ثانیه بیش از اندازه کافی). */
    const MAC_LENGTH = 16;

    /** روش‌های ثبتِ تأیید. */
    const METHOD_QR = 'qr';
    const METHOD_MANUAL = 'manual';

    /** کلیدِ امضای کدها. */
    public static function key()
    {
        return (string) config('services.mobile.qr.key', '');
    }

    /** کلید گذاشته شده؟ (اگر نه، نه کدی ساخته می‌شود نه تأییدی) */
    public static function enabled()
    {
        return self::key() !== '';
    }

    /**
     * تأییدِ QR برای ثبتِ حضور **لازم است**؟
     *
     * دو شرط: کلید موجود باشد و کلیدِ خاموش‌کننده در `.env` خاموش نشده باشد.
     * اگر لازم باشد، ثبتِ ورود/خروج تا تأییدِ روز قفل است (نه فقط اسکنرِ
     * اجباری در اپ)؛ اگر نباشد، QR نمایش داده می‌شود و تأیید هم ثبت می‌شود ولی
     * هیچ ثبتی منتظرِ آن نمی‌ماند — راهِ فرارِ مدیر برای روزی که دوربینِ گوشی
     * کار نمی‌کند.
     */
    public static function required()
    {
        if (!self::enabled()) {
            return false;
        }

        return filter_var(config('services.mobile.qr.required', true), FILTER_VALIDATE_BOOLEAN);
    }

    /** اندازهٔ پنجره. */
    public static function windowSize()
    {
        $size = (int) config('services.mobile.qr.window', self::WINDOW_SECONDS);

        return $size > 0 ? $size : self::WINDOW_SECONDS;
    }

    /** شمارهٔ پنجرهٔ زمانیِ یک لحظه. */
    public static function windowAt($timestamp)
    {
        return intdiv((int) $timestamp, self::windowSize());
    }

    /** ثانیه‌های باقی‌مانده تا پنجرهٔ بعد — اپ/پنل با آن می‌فهمد کد چقدر زنده است. */
    public static function secondsLeft($timestamp)
    {
        return self::windowSize() - ((int) $timestamp % self::windowSize());
    }

    /** روکشِ امضا؛ تنها جای محاسبهٔ MAC. */
    private static function mac($customerId, $window)
    {
        $payload = self::PREFIX . '|' . (int) $customerId . '|' . (int) $window;

        return substr(hash_hmac('sha256', $payload, self::key()), 0, self::MAC_LENGTH);
    }

    /** کدِ یک کارمند در یک پنجره — همان رشته‌ای که داخلِ QR می‌رود. */
    public static function codeFor($customerId, $window)
    {
        return self::PREFIX . '.' . (int) $customerId . '.' . (int) $window . '.' . self::mac($customerId, $window);
    }

    /**
     * کدهای چند کارمند در این لحظه، در **یک** پاسخ.
     *
     * چرا دسته‌ای: صفحهٔ «همکاران» مثلاً ۳۰ کارت دارد؛ اگر هر کارت خودش کد
     * بگیرد، هر ۳۰ ثانیه ۳۰ درخواست می‌رود. اینجا پنل یک درخواست می‌زند.
     *
     * @return array{window:int, expires_in:int, codes:array<string,string>}
     */
    public static function codesFor(array $customerIds, $now = null)
    {
        $now = $now === null ? time() : (int) $now;
        $window = self::windowAt($now);

        $codes = [];

        foreach ($customerIds as $id) {
            $id = (int) $id;

            if ($id > 0) {
                $codes[(string) $id] = self::codeFor($id, $window);
            }
        }

        return [
            'window' => $window,
            'expires_in' => self::secondsLeft($now),
            'codes' => $codes,
        ];
    }

    /**
     * بررسیِ کدی که از اپ رسیده.
     *
     * خروجی یکی از این‌هاست:
     *   ok        → معتبر و مالِ همین کارمند
     *   foreign   → کدِ کارمندِ دیگری است (اسکنِ QR همکار)
     *   expired   → پنجره‌اش گذشته (عکسِ کهنه، یا گوشی ساعتش را نداشت؟ نه — پنجره سمت سرور است)
     *   bad       → قالب/MAC غلط (دستِ کاری روی رشته)
     *   disabled  → کلید گذاشته نشده
     *
     * نکته: **پنجره از کدِ خودش خوانده می‌شود**، نه از ساعتِ گوشی؛ پس دست‌کاریِ
     * ساعتِ گوشی هیچ اثری ندارد و پنجرهٔ کهنه هم همان‌جا رد می‌شود.
     *
     * @return array{status:string, window:int|null, customer_id:int|null}
     */
    public static function verify($code, $customerId, $now = null)
    {
        $result = ['status' => 'bad', 'window' => null, 'customer_id' => null];

        if (!self::enabled()) {
            $result['status'] = 'disabled';

            return $result;
        }

        $parts = explode('.', trim((string) $code));

        if (count($parts) !== 4 || $parts[0] !== self::PREFIX) {
            return $result;
        }

        $codeCustomer = (int) $parts[1];
        $window = (int) $parts[2];
        $mac = strtolower($parts[3]);

        $result['window'] = $window;
        $result['customer_id'] = $codeCustomer;

        if ($codeCustomer <= 0 || $window <= 0 || $mac === '') {
            return $result;
        }

        // امضا اول سنجیده می‌شود؛ تا وقتی معلوم نشده کدِ خودِ سرور است، حرفی
        // دربارهٔ اینکه «مالِ کدام کارمند است» زده نمی‌شود.
        $expected = strtolower(self::mac($codeCustomer, $window));

        if (!hash_equals($expected, $mac)) {
            return $result;
        }

        if ($codeCustomer !== (int) $customerId) {
            $result['status'] = 'foreign';

            return $result;
        }

        $current = self::windowAt($now === null ? time() : (int) $now);

        // فقط پنجرهٔ جاری و پنجرهٔ قبلی.
        if ($window !== $current && $window !== $current - 1) {
            $result['status'] = 'expired';

            return $result;
        }

        $result['status'] = 'ok';

        return $result;
    }

    /**
     * ردیف‌های تأییدِ امروزِ چند کارمند، در **یک** کوئری.
     *
     * چرا: صفحهٔ «همکاران» یک‌جا وضعیتِ تأییدِ همهٔ کارت‌ها را می‌خواهد؛ اگر
     * برای هر کارمند یک کوئری بزنیم، صفحه‌ای با ۳۰ کارمند ۳۰ کوئری اضافه
     * می‌کند. خروجی: نگاشتِ `customer_id` → ردیف.
     *
     * @return array<int, object>
     */
    public static function rowsFor(array $customerIds, $dmy)
    {
        $ids = array_values(array_filter(array_map('intval', $customerIds)));

        if (! $ids) {
            return [];
        }

        try {
            $rows = DB::table('tbl_mobile_presence_confirm')
                ->where('dmy', $dmy)
                ->whereIn('customer_id', $ids)
                ->get();
        } catch (\Throwable $e) {
            return [];
        }

        $map = [];

        foreach ($rows as $row) {
            $map[(int) $row->customer_id] = $row;
        }

        return $map;
    }

    /**
     * ردیفِ تأیید امروزِ یک کارمند، یا `null`.
     *
     * اینجا «ردیفی نیست» و «جدول نیست» هر دو `null` می‌گیرند، چون برای نمایشِ
     * وضعیت تفاوتی ندارند. آن‌جا که به همین جواب، **قفلِ ثبت** بند است
     * (`blocksPunch`) این تفاوت مهم می‌شود، پس آن یکی از `row()` می‌خواند.
     */
    public static function today($customerId, $dmy)
    {
        try {
            return self::row($customerId, $dmy);
        } catch (\Throwable $e) {
            // نبودِ جدول (پیش از اجرای migration) نباید نمایشِ وضعیت را بشکند.
            return null;
        }
    }

    /** کوئریِ خامِ ردیفِ تأیید — بدونِ خفه‌کردنِ خطا (تا `blocksPunch` بتواند «نیست» را از «نشد» جدا کند). */
    private static function row($customerId, $dmy)
    {
        return DB::table('tbl_mobile_presence_confirm')
            ->where('customer_id', (int) $customerId)
            ->where('dmy', $dmy)
            ->first();
    }

    /**
     * ثبتِ ورود/خروجِ امروزِ این کارمند قفل است؟
     *
     * قاعده: اگر تأییدِ QR اجباری باشد (`required()`)، کارمندی که حضورِ امروزش را
     * تأیید نکرده نه ورود می‌زند و نه خروج. تأییدِ **دستیِ مدیر** هم همین قفل را
     * باز می‌کند، چون هر دو یک ردیفِ `tbl_mobile_presence_confirm` را می‌نویسند.
     *
     * چرا این تصمیم در سرور است و نه فقط در اپ: دکمهٔ قفل‌شدهٔ اپ یک «تجربهٔ
     * کاربری» است و مرزِ امنیتی نیست؛ هر کسی می‌تواند همان درخواست را دستی
     * بفرستد. اگر قفل فقط آنجا بود، خاصیتِ «در برابرِ صفحه بودن» از بین می‌رفت.
     * اپ همان قاعده را از فیلدِ `today.qr` می‌خواند و **پیش از** ضربهٔ دکمه
     * نشان می‌دهد؛ اینجا مرجعِ نهایی است.
     *
     * اگر جدولِ تأیید موجود نباشد (migration اجرا نشده) یا کوئری به هر دلیلی
     * بیفتد، جواب `false` است: درِ بسته‌شده بدتر از نگرفتنِ تأیید است و کارمند
     * نباید پشتِ در بماند.
     *
     * @param int|string $customerId
     * @param string $dmy
     * @return bool
     */
    public static function blocksPunch($customerId, $dmy)
    {
        if (! self::required()) {
            return false;
        }

        try {
            $row = self::row($customerId, $dmy);
        } catch (\Throwable $e) {
            return false;
        }

        return empty($row);
    }

    /**
     * ثبتِ تأییدِ امروز (بار اول می‌سازد، بارهای بعد همان ردیف را تازه می‌کند).
     *
     * `updateOrInsert` عمدی است و نه `insertOrIgnore`: نسخهٔ لاراولِ این پروژه
     * ۵٫۶ است و `insertOrIgnore` در آن وجود ندارد (لاراول ۵٫۸ اضافه شد). اولین
     * نسخهٔ این تابع همان را صدا می‌زد و روی سرور، تأییدِ دستیِ مدیر با
     * ۵۰۰ می‌افتاد؛ همین را آزمونِ روی سرور گرفت. `updateOrInsert` هم در همین
     * نسخه هست (مسیر `office-ip` از قبل از آن استفاده می‌کند) و همان کار را
     * می‌کند: اگر ردیفِ (customer_id, dmy) بود به‌روزش می‌کند، وگرنه می‌سازد.
     */
    public static function confirm($customerId, $dmy, $method, $window = null, $ip = null)
    {
        DB::table('tbl_mobile_presence_confirm')->updateOrInsert(
            [
                'customer_id' => (int) $customerId,
                'dmy' => $dmy,
            ],
            [
                'method' => $method,
                'window' => $window,
                'confirmed_at' => date('Y-m-d H:i:s'),
                'confirmed_ip' => $ip,
            ]
        );

        return self::today($customerId, $dmy);
    }

    /**
     * وضعیتِ تأیید برای اپ و پنل.
     *
     * @return array{required:bool, enabled:bool, confirmed:bool, method:string|null, confirmed_at:string|null, seconds_left:int}
     */
    public static function state($customerId, $dmy, $now = null)
    {
        $now = $now === null ? time() : (int) $now;
        $row = self::today($customerId, $dmy);

        return [
            'required' => self::required(),
            'enabled' => self::enabled(),
            'confirmed' => !empty($row),
            'method' => empty($row) ? null : (string) $row->method,
            'confirmed_at' => empty($row) ? null : (string) $row->confirmed_at,
            'seconds_left' => self::secondsLeft($now),
        ];
    }
}
