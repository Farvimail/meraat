<?php

namespace App;

use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| تأیید حضور با کدِ QRِ ثابتِ هر کارمند
|--------------------------------------------------------------------------
|
| مسئله‌ای که این کلاس حل می‌کند: ثبتِ ورود از گوشی می‌تواند از هر جایی انجام
| شود؛ نه مدرکی هست که کارمند واقعاً در محل کار بوده. ایده: صفحهٔ حضور روی
| کارتِ هر کارمند یک QR نشان می‌دهد و کارمند با دوربینِ اپ اسکنش می‌کند. پس دو
| چیز هم‌زمان لازم است: گوشیِ خودِ کارمند (توکن) و کدِ همان کارمند.
|
| **استراتژیِ فعلی: کدِ ثابت، نه چرخان.** قبلاً کد هر ۳۰ ثانیه عوض می‌شد تا
| عکسِ QR بی‌فایده باشد؛ ولی این کار یک وابستگیِ عملی ساخت: صفحهٔ کد باید
| باز می‌ماند و کسی باید در برابرِ آن می‌ایستاد. تصمیمِ تازه: هر کارمند
| **یک** کدِ ثابتِ مخصوصِ خودش دارد که روی کارتِ او در صفحهٔ اصلیِ حضور (بدونِ
| نیاز به ورودِ مدیر) دیده می‌شود. آنچه عوض نشده: کد هر کارمند جداست و
| امضاشده است (کدِ دست‌کاری‌شده یا کدِ همکار پذیرفته نمی‌شود)، و ثبت هنوز
| گوشیِ بسته‌شده به همان حساب را می‌خواهد.
|
| ترتیب: **اول تأییدِ حضور، بعد ثبت — هم ورود، هم خروج.** یعنی تا کارمند QR
| کارتِ خودش را اسکن نکند (یا مدیر دستی تأییدش نکند) هیچ ثبتی برایش انجام
| نمی‌شود؛ قفل در خودِ API است (`MobileApiController::punch`) نه فقط در دکمهٔ
| اپ — وگرنه با یک درخواستِ دستی می‌شد از قاعده رد شد. جزئیات در `blocksPunch()`.
|
| هر تأیید **یک** ثبت را باز می‌کند: تأییدِ مصرف‌نشده در ردیفی با
| `consumed_at = NULL` می‌نشیند و همان لحظه‌ای که ثبت انجام شد، `consume()`
| مهرش می‌زند. پس تأییدِ صبح، ورودِ عصر را باز نمی‌کند؛ اگر کارمند خروج زد و
| بعد از چند ساعت برگشت، باید دوباره اسکن کند. **خروج هم یک ثبت است** پس
| بستنِ شیفت هم قبلش تأییدِ تازه می‌خواهد — کارمند پشتِ گوشی است و باید در
| برابرِ کارتِ خودش اسکن کند، همان‌طور که برای ورود می‌کند.
|
| تأیید **مدت‌دار** است: پیش‌فرض ۳۰ ثانیه (`punchWindow`). اگر کارمند تا آن
| لحظه اثرِ انگشت را نزند، تأیید خودش منقضی می‌شود و باید دوباره اسکن کند؛
| وگرنه یک اسکنِ صبح تا شب درِ ثبت را باز می‌گذاشت. «منقضی» ردیف را پاک
| نمی‌کند، فقط از جست‌وجوی «آماده» بیرون می‌رود تا سابقهٔ تأییدها بمانَد.
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

    /**
     * «پنجره»ی کدِ ثابت — همیشه صفر.
     *
     * چرا قالب عوض نشد: اپِ نصب‌شده روی گوشی‌ها کدِ خوانده‌شده را پیش از
     * فرستادن با `^v1\.(\d+)\.(\d+)\.(امضا)$` می‌سنجد. اگر به `v2` می‌رفتیم،
     * هر گوشیِ نصب‌شده باید اپ را دوباره می‌گرفت تا اولین اسکنش کار کند. با
     * نگه‌داشتنِ همان قالب و گذاشتنِ صفر در جای «پنجره»، کدِ ثابت بی‌هیچ
     * buildی در همان اپ کار می‌کند.
     */
    const STATIC_WINDOW = 0;

    /** چند کاراکتر از MAC در کد می‌آید (۱۶ کاراکتر = ۶۴ بیت). */
    const MAC_LENGTH = 16;

    /**
     * چند ثانیه تأییدِ تازه معتبر می‌ماند (پیش‌فرض؛ با
     * `MOBILE_QR_PUNCH_WINDOW` عوض می‌شود).
     *
     * چرا مدت‌دار: تأیید فقط می‌گوید «همین حالا در برابرِ کارت بودم». اگر
     * بی‌مدت بماند، یک اسکنِ صبح تا شب درٍ ثبت را باز می‌گذارد و همان چیزی
     * می‌شود که این مکانیسم می‌خواست جلویش را بگیرد. سی ثانیه کافی است تا
     * کارمند دوربین را ببندد و اثرِ انگشت بزند، و کوتاه‌تر از آن دوباره
     * اسکن می‌خواهد.
     */
    const PUNCH_WINDOW_SECONDS = 30;

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

    /**
     * چند ثانیه یک تأیید معتبر است؟ (۰ = بدونِ انقضا)
     *
     * این عدد هم قفلِ سرور را می‌سازد و هم در `state()` به اپ می‌رود تا
     * کارمند بشمارد که چقدر وقت دارد.
     */
    public static function punchWindow()
    {
        $seconds = (int) config('services.mobile.qr.punch_window', self::PUNCH_WINDOW_SECONDS);

        return $seconds > 0 ? $seconds : 0;
    }

    /** لحظهٔ آخرین ثانیه‌ای که تأییدی که در `$at` نوشته شده هنوز معتبر است. */
    private static function windowStart($now = null)
    {
        $window = self::punchWindow();

        if ($window === 0) {
            return null;
        }

        return date('Y-m-d H:i:s', ($now === null ? time() : (int) $now) - $window);
    }

    /**
     * چند ثانیه از عمرِ یک ردیفِ تأیید باقی مانده؟ (۰ = گذشته یا بدونِ انقضا)
     *
     * @param object $row
     */
    public static function remaining($row, $now = null)
    {
        $window = self::punchWindow();

        if ($window === 0 || empty($row) || empty($row->confirmed_at)) {
            return 0;
        }

        $written = strtotime((string) $row->confirmed_at);

        if ($written === false) {
            return 0;
        }

        $left = $written + $window - ($now === null ? time() : (int) $now);

        return $left > 0 ? $left : 0;
    }

    /** روکشِ امضا؛ تنها جای محاسبهٔ MAC. */
    private static function mac($customerId, $window)
    {
        $payload = self::PREFIX . '|' . (int) $customerId . '|' . (int) $window;

        return substr(hash_hmac('sha256', $payload, self::key()), 0, self::MAC_LENGTH);
    }

    /**
     * کدِ ثابتِ یک کارمند — همان رشته‌ای که داخلِ QR می‌رود.
     *
     * ورودیِ زمان ندارد: این کد تا وقتی کلیدِ امضا عوض نشود همان می‌ماند.
     * برای هر کارمند یکتاست و امضاشده؛ پس کدِ همکار یا کدِ دست‌کاری‌شده پذیرفته
     * نمی‌شود.
     */
    public static function codeFor($customerId)
    {
        return self::PREFIX . '.' . (int) $customerId . '.' . self::STATIC_WINDOW . '.'
            . self::mac($customerId, self::STATIC_WINDOW);
    }

    /**
     * کدهای چند کارمند در **یک** پاسخ.
     *
     * چرا دسته‌ای: صفحهٔ «همکاران» مثلاً ۳۰ کارت دارد؛ اگر هر کارت خودش کد
     * بگیرد، بارگذاری صفحه ۳۰ درخواست می‌زند. اینجا صفحه یک درخواست می‌زند.
     *
     * `mode` صریحاً `static` است تا کلاینت بداند کد عوض نمی‌شود و برای
     * تازه‌سازیِ بی‌مورد درخواست نزند (`public/js/panel-qr.js`).
     *
     * @return array{mode:string, codes:array<string,string>}
     */
    public static function codesFor(array $customerIds)
    {
        $codes = [];

        foreach ($customerIds as $id) {
            $id = (int) $id;

            if ($id > 0) {
                $codes[(string) $id] = self::codeFor($id);
            }
        }

        return [
            'mode' => 'static',
            'codes' => $codes,
        ];
    }

    /**
     * بررسیِ کدی که از اپ رسیده.
     *
     * خروجی یکی از این‌هاست:
     *   ok        → معتبر و مالِ همین کارمند
     *   foreign   → کدِ کارمندِ دیگری است (اسکنِ QR همکار)
     *   bad       → قالب/MAC غلط (دستِ کاری روی رشته، یا کدِ چرخانِ قدیمی)
     *   disabled  → کلید گذاشته نشده
     *
     * `expired` دیگر وجود ندارد: کد ثابت است و تاریخ انقضا ندارد. کدهای
     * چرخانِ پیشین (پنجرهٔ بزرگ‌تر از صفر) عمداً رد می‌شوند تا یک اسکرین‌شاتِ
     * کهنه دوباره زنده نشود؛ بعد از تغییرِ قاعده دیگر جایی چنین کدی نمی‌سازد.
     *
     * `$now` فقط برای سازگاریِ امضای قبلی نگه داشته شده و اثری ندارد.
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

        if ($codeCustomer <= 0 || $window !== self::STATIC_WINDOW || $mac === '') {
            return $result;
        }

        // امضا اول سنجیده می‌شود؛ تا وقتی معلوم نشده کدِ خودِ سرور است، حرفی
        // دربارهٔ اینکه «مالِ کدام کارمند است» زده نمی‌شود.
        $expected = strtolower(self::mac($codeCustomer, self::STATIC_WINDOW));

        if (!hash_equals($expected, $mac)) {
            return $result;
        }

        if ($codeCustomer !== (int) $customerId) {
            $result['status'] = 'foreign';

            return $result;
        }

        $result['status'] = 'ok';

        return $result;
    }

    /**
     * آخرین ردیفِ تأییدِ امروزِ چند کارمند، در **یک** کوئری.
     *
     * چرا: صفحهٔ «همکاران» یک‌جا وضعیتِ تأییدِ همهٔ کارت‌ها را می‌خواهد؛ اگر
     * برای هر کارمند یک کوئری بزنیم، صفحه‌ای با ۳۰ کارمند ۳۰ کوئری اضافه
     * می‌کند. خروجی: نگاشتِ `customer_id` → ردیف.
     *
     * از وقتی هر ثبت تأییدِ خودش را دارد، یک کارمند ممکن است در یک روز چند
     * ردیف داشته باشد؛ اینجا **آخرین** ردیف می‌ماند (آخرین تأییدِ آن روز)، نه
     * ردیفِ اول — وگرنه پنل بعد از تأییدِ دوم همان زمانِ صبح را نشان می‌داد.
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
                ->orderBy('id', 'asc')
                ->get();
        } catch (\Throwable $e) {
            return [];
        }

        $map = [];

        // آخرین ردیف برنده است؛ ترتیبِ صعودی یعنی ردیف‌های تازه‌تر روی قبلی
        // می‌نشینند و در پایان هر کارمند یک ورودی دارد.
        foreach ($rows as $row) {
            $map[(int) $row->customer_id] = $row;
        }

        return $map;
    }

    /**
     * آخرین ردیفِ تأییدِ امروزِ یک کارمند، یا `null`.
     *
     * اینجا «ردیفی نیست» و «جدول نیست» هر دو `null` می‌گیرند، چون برای نمایشِ
     * وضعیت تفاوتی ندارند. آن‌جا که به همین جواب، **قفلِ ثبت** بند است
     * (`blocksPunch`) این تفاوت مهم می‌شود، پس آن یکی از `pendingRow()` می‌خواند.
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

    /** آخرین ردیفِ تأیید (مصرف‌شده یا نشده) — برای نمایشِ «آخرین تأیید». */
    private static function row($customerId, $dmy)
    {
        return DB::table('tbl_mobile_presence_confirm')
            ->where('customer_id', (int) $customerId)
            ->where('dmy', $dmy)
            ->orderBy('id', 'desc')
            ->first();
    }

    /**
     * آخرین تأییدِ **مصرف‌نشده** — همان چیزی که یک ثبتِ ورود را باز می‌کند.
     *
     * `NULL` در `consumed_at` یعنی «تأیید گرفته شد ولی هنوز برای ثبتی خرج
     * نشده». خطای دیتابیس عمداً اینجا خفه نمی‌شود: `pending()` باید بتواند
     * «ردیفی نیست» را از «جدول نیست/migration اجرا نشده» جدا کند، وگرنه با
     * اجرا نشدنِ migration همه پشتِ در می‌ماندند.
     *
     * `confirmed_at` هم شرط دارد: تأییدی که از پنجرهٔ ۳۰ ثانیه‌ای گذشته دیگر
     * «آماده» نیست، حتی اگر مصرف نشده باشد. در خودِ کوئری است و نه در PHP تا
     * هم `pending()` و هم `consume()` همان قاعده را ببینند (تأییدِ منقضی
     * مصرف هم نمی‌شود).
     */
    private static function pendingRow($customerId, $dmy, $now = null)
    {
        $query = DB::table('tbl_mobile_presence_confirm')
            ->where('customer_id', (int) $customerId)
            ->where('dmy', $dmy)
            ->whereNull('consumed_at');

        $cutoff = self::windowStart($now);

        if ($cutoff !== null) {
            $query = $query->where('confirmed_at', '>=', $cutoff);
        }

        return $query->orderBy('id', 'desc')->first();
    }

    /**
     * تأییدِ مصرف‌نشده‌ای برای این کارمند در این روز هست؟
     *
     * سه خروجی: `true` (هست)، `false` (نیست)، `null` (نشد پرسید — جدول نیست
     * یا کوئری افتاد). `null` عمداً از `false` جدا است: «نشد» نباید به «قفل
     * کن» ترجمه شود و کارمند را پشتِ در بگذارد.
     *
     * @return bool|null
     */
    public static function pending($customerId, $dmy, $now = null)
    {
        try {
            return ! empty(self::pendingRow($customerId, $dmy, $now));
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * ثبتِ بعدیِ (ورود یا خروج) این کارمند قفل است؟
     *
     * قاعده: هر **ثبتِ تازه** — چه ورود، چه خروج — یک تأییدِ تازه لازم دارد.
     * تأییدِ قبلی با ثبتِ قبلی «خرج» شده است (`consume()`). این برای خروج هم
     * هست: بستنِ شیفت از داخلِ گوشی هم مثل ورود می‌تواند از هر جایی زده شود و
     * همان دلیل (بودن در برابرِ کارت) سر جایش است. کارمندی که داخل است باید
     * پیش از زدنِ خروج، QR کارتِ خودش را اسکن کند؛ فقط بعد از آن اثرِ انگشت
     * برای ثبتِ خروج پذیرفته می‌شود.
     *
     * `$intent` در خودِ این تصمیم دخالتی ندارد (ورود و خروج هر دو یکسان‌اند)
     * و فقط برای سازگاریِ امضا و پیام‌رسانی نگه داشته شده است.
     *
     * تأییدِ **دستیِ مدیر** هم همین قفل را باز می‌کند، چون هر دو یک ردیفِ
     * `tbl_mobile_presence_confirm` را می‌نویسند.
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
     * @param string $intent کاری که در نوبت است: `start` یا `pause`
     * @return bool
     */
    public static function blocksPunch($customerId, $dmy, $intent = 'start')
    {
        if (! self::required()) {
            return false;
        }

        $pending = self::pending($customerId, $dmy);

        // «نشد پرسید» یعنی نه. قفلِ بی‌دلیل (migration اجرا نشده، جدولِ خراب)
        // بدتر از نگرفتنِ تأیید است.
        if ($pending === null) {
            return false;
        }

        return ! $pending;
    }

    /**
     * «این تأیید برای این ثبت خرج شد.»
     *
     * باید **همراه با** نوشتنِ رکوردِ ورود صدا زده شود (نه قبلش)، وگرنه اگر
     * ثبت شکست بخورد، کارمند تأییدش را از دست می‌دهد و باید دوباره اسکن کند.
     *
     * @return bool تأییدی بود که مصرف شد؟
     */
    public static function consume($customerId, $dmy)
    {
        try {
            $pending = self::pendingRow($customerId, $dmy);

            if (empty($pending)) {
                return false;
            }

            DB::table('tbl_mobile_presence_confirm')
                ->where('id', $pending->id)
                ->whereNull('consumed_at')
                ->update(['consumed_at' => date('Y-m-d H:i:s')]);

            return true;
        } catch (\Throwable $e) {
            // مصرف‌نشدن نباید ثبتِ انجام‌شده را خراب کند (حداکثر یک اسکنِ اضافه).
            return false;
        }
    }

    /**
     * ثبتِ یک تأییدِ تازه (ردیفِ نو، نه به‌روزرسانیِ ردیفِ قبلی).
     *
     * چرا `insert` و نه `updateOrInsert`: هر تأیید فقط **یک** ثبت را باز
     * می‌کند، پس تأییدِ دومِ همان روز باید ردیفِ دوم باشد؛ با `updateOrInsert`
     * ردیفِ قبلی بازنویسی می‌شد و سابقهٔ «چه کسی کِی تأیید کرد» گم می‌شد.
     *
     * `insertOrIgnore` عمداً نیست: نسخهٔ لاراولِ این پروژه ۵٫۶ است و آن متد از
     * ۵٫۸ اضافه شد (نسخهٔ قبلی همین تابع با آن روی سرور ۵۰۰ می‌داد).
     */
    public static function confirm($customerId, $dmy, $method, $window = null, $ip = null)
    {
        DB::table('tbl_mobile_presence_confirm')->insert([
            'customer_id' => (int) $customerId,
            'dmy' => $dmy,
            'method' => $method,
            'window' => $window,
            'confirmed_at' => date('Y-m-d H:i:s'),
            'confirmed_ip' => $ip,
            'consumed_at' => null,
        ]);

        return self::today($customerId, $dmy);
    }

    /**
     * وضعیتِ تأیید برای اپ و پنل.
     *
     * سه معنیِ نزدیک که قاطی‌کردنشان کارمند را سردرگم می‌کند:
     *   confirmed  → امروز اصلاً تأییدی گرفته شده؟ (نشانِ «تأیید شده»)
     *   pending    → تأییدی هست که هنوز برای ثبتی خرج نشده **و منقضی نشده**؟
     *                (همان که در را باز می‌کند)
     *   lock       → همین حالا این ثبت قفل است؟ (بدونِ تأییدِ تازه و معتبر قفل
     *                است، چه نوبت ورود باشد چه خروج — تنها معیارِ UI)
     *   seconds_left → چند ثانیه از عمرِ همان تأیید باقی است. صفر یعنی تأییدی
     *                برای استفاده نیست (یا گذشت)؛ اپ با همین می‌شمارد و بعد
     *                دوباره قفل را از سرور می‌خواند.
     *
     * @param string $intent کاری که در نوبت است: `start` یا `pause`
     * @return array{required:bool, enabled:bool, confirmed:bool, pending:bool, lock:bool, intent:string, method:string|null, confirmed_at:string|null, seconds_left:int}
     */
    public static function state($customerId, $dmy, $now = null, $intent = 'start')
    {
        $row = self::today($customerId, $dmy);
        $pending = self::pending($customerId, $dmy, $now) === true;
        $secondsLeft = 0;

        if ($pending) {
            try {
                $secondsLeft = self::remaining(self::pendingRow($customerId, $dmy, $now), $now);
            } catch (\Throwable $e) {
                // نمایشِ بدونِ شمارنده بهتر از شکستنِ کلِ وضعیت است.
                $secondsLeft = 0;
            }
        }

        return [
            'required' => self::required(),
            'enabled' => self::enabled(),
            'confirmed' => !empty($row),
            'pending' => $pending,
            // ورود و خروج هر دو پشتِ همین قفل‌اند؛ `intent` فقط برای نمایشِ
            // نوبت به اپ می‌رود و در قفل دخالتی ندارد.
            'lock' => self::required() && ! $pending,
            'intent' => $intent === 'pause' ? 'pause' : 'start',
            'method' => empty($row) ? null : (string) $row->method,
            'confirmed_at' => empty($row) ? null : (string) $row->confirmed_at,
            // عمرِ باقی‌ماندهٔ تأییدِ آماده (نه کد؛ کد ثابت است). صفر یعنی
            // تأییدی برای خرج‌شدن نیست. اپ با همین می‌شمارد و در پایانش
            // وضعیت را تازه می‌کند تا دکمه دوباره قفل شود.
            'seconds_left' => $secondsLeft,
        ];
    }
}
