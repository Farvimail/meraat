<?php

/*
 * بررسیِ منطقِ کدِ QR تأییدِ حضور (`app/MobilePresence.php`).
 *
 * چرا این فایل وجود دارد: تمامِ امنیتِ این مسیر به سه چیز بند است — قالبِ کد،
 * امضای HMAC و ثابت‌بودنِ کد برای هر کارمند (چرخش کنار گذاشته شد). هر سه از
 * بیرون «کار می‌کنند» و اگر یکی خراب شود (مثلاً کدِ کارمندِ دیگر پذیرفته شود
 * یا کد به ساعت گره بخورد) هیچ خطایی دیده نمی‌شود؛ فقط تأییدِ حضور بی‌سروصدا
 * می‌شکند یا بی‌اعتبار می‌شود. پس اینها را مستقیم تست می‌کنیم.
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
 * بدونِ دیتابیسِ واقعی اجرا می‌شود: جداول ساخته یا خوانده نمی‌شوند. ولی از
 * وقتی `blocksPunch` آمد، «ردیفِ تأیید هست یا نه» خودش یک تصمیمِ مهم شد؛ پس
 * facade دیتابیس با یک جعلیِ کمینه عوض می‌شود تا هر دو حالت — و مهم‌تر از
 * آن‌ها حالتِ خطا (جدولِ تأیید ساخته نشده) — سنجیده شوند.
 *
 * از وقتی هر ثبت تأییدِ خودش را دارد، جعلیِ دیتابیس باید `whereNull('consumed_at')`
 * را هم بفهمد: ردیفی که مصرف شده («تأیید با ثبتِ قبلی خرج شد») نباید در
 * جست‌وجوی «تأییدِ آماده» پیدا شود. همان اشتباهی که این migration و این تست
 * جلویش را می‌گیرند: یک تأییدِ صبح که تا شب درها را باز بگذارد.
 */

// --- ایستگاهِ وابستگی‌ها ------------------------------------------------------
// کلاسِ واقعی به `config()` و facade دیتابیس لاراول وابسته است؛ اینجا همان‌ها
// را با کمترین چیزِ ممکن جعل می‌کنیم تا فایل بدون اجرای لاراول تست شود.
namespace Illuminate\Support\Facades {
    /**
     * جعلیِ کمینهٔ facade دیتابیس.
     *
     * سه حالت را می‌تواند بسازد: «ردیفِ تأیید هست»، «ردیف نیست»، و «کوئری
     * می‌افتد». حالتِ سوم عمداً هست: اگر جدولِ تأیید ساخته نشده باشد،
     * `blocksPunch` باید `false` بدهد (کارمند پشتِ در نماند) و این تنها جایی
     * است که می‌شود همین را سنجید.
     */
    class DB
    {
        /** ردیفی که کوئری باید برگرداند (یا `null`). */
        public static $presenceRow = null;

        /** اگر true باشد، هر کوئری مثلِ «جدول نیست» می‌افتد. */
        public static $fail = false;

        /** ردیف‌هایی که با insert نوشته شده‌اند (برای سنجشِ `confirm`). */
        public static $inserted = array();

        /** ردیف‌هایی که با update عوض شده‌اند (برای سنجشِ `consume`). */
        public static $updated = array();

        public static function reset()
        {
            self::$presenceRow = null;
            self::$fail = false;
            self::$inserted = array();
            self::$updated = array();
        }

        public static function table($name)
        {
            if (self::$fail) {
                throw new \RuntimeException('شبیه‌سازیِ خطای دیتابیس: ' . $name);
            }

            return new FakeQuery($name);
        }
    }

    /** فقط همان چند متدی که `MobilePresence` صدا می‌زند. */
    class FakeQuery
    {
        private $table;

        /** آیا `whereNull('consumed_at')` صدا زده شده؟ */
        private $pendingOnly = false;

        /**
         * مهلتِ تأیید: `where('confirmed_at', '>=', …)`.
         *
         * جعلیِ کمینه باید همین شرط را بفهمد، وگرنه تستِ «تأییدِ ۳۰ ثانیه‌ای»
         * همیشه سبز می‌ماند حتی وقتی کد انقضا را کامل حذف کرده باشد.
         */
        private $confirmedSince = null;

        public function __construct($table)
        {
            $this->table = $table;
        }

        public function where($column, $value = null, $operator = null)
        {
            if ($column === 'confirmed_at' && $value === '>=' && $operator !== null) {
                $this->confirmedSince = (string) $operator;
            }

            return $this;
        }

        public function whereNull($column)
        {
            if ($column === 'consumed_at') {
                $this->pendingOnly = true;
            }

            return $this;
        }

        public function orderBy($column, $direction = 'asc')
        {
            return $this;
        }

        public function first()
        {
            if ($this->pendingOnly && DB::$presenceRow && ! empty(DB::$presenceRow->consumed_at)) {
                // ردیفِ مصرف‌شده «تأییدِ آماده» نیست؛ همان اشتباهی که یک تأیید
                // را به کلِ روز گره می‌زد.
                return null;
            }

            // مقایسهٔ رشته‌ای کافی است: هر دو طرف `Y-m-d H:i:s` هستند.
            if (
                $this->confirmedSince !== null
                && DB::$presenceRow
                && strcmp((string) DB::$presenceRow->confirmed_at, $this->confirmedSince) < 0
            ) {
                // تأییدِ کهنه‌تر از مهلت، «آماده» نیست.
                return null;
            }

            return DB::$presenceRow;
        }

        public function insert($values)
        {
            DB::$inserted[] = $values;

            return true;
        }

        public function update($values)
        {
            DB::$updated[] = $values;

            return 1;
        }
    }
}

namespace {

    // جعلیِ دیتابیس در namespaceِ facade تعریف شده و خودِ `MobilePresence` هم
    // آن را از همین‌جا می‌خواند؛ این `use` فقط برای همین فایلِ تست است تا
    // `DB::reset()` در کدِ پایین به همان کلاس برسد (بدونش، تست وسطِ کار با
    // «Class 'DB' not found» می‌مرد و بخشِ قفلِ ثبت هیچ‌وقت سنجیده نمی‌شد).
    use Illuminate\Support\Facades\DB;

    $GLOBALS['presence_config'] = [
        'services.mobile.qr.key' => 'test-key-0123456789abcdef',
        'services.mobile.qr.required' => true,
        'services.mobile.qr.punch_window' => 30,
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
    $code = MobilePresence::codeFor(12);
    check(
        'قالبِ کد v1.<کارمند>.0.<۱۶ کاراکترِ امضا> است (جایِ «پنجره» صفر است)',
        (bool) preg_match('/^v1\.12\.0\.[0-9a-f]{16}$/', $code),
        $code
    );

    // ------------------------------------------------------------ حالتِ فعال
    check('با کلیدِ پر، مسیر روشن است', MobilePresence::enabled() === true);
    check('required با کلیدِ پر و required=true یعنی بله', MobilePresence::required() === true);

    // --------------------------------------------------------------- امضا
    $other = MobilePresence::codeFor(13);
    check('کدِ دو کارمندِ مختلف یکی نیست', $code !== $other);

    // استراتژیِ تازه: کد **ثابت** است. اگر فردا کسی دوباره چرخش را برگرداند،
    // همین دو بررسی می‌شکند و جلوی برگشتِ بی‌صدای آن را می‌گیرد.
    check(
        'کدِ یک کارمند در دو بار خواندن یکی است (ثابت، نه چرخان)',
        MobilePresence::codeFor(12) === $code
    );
    check(
        'کد به زمان وابسته نیست (هیچ ورودیِ زمانی ندارد)',
        (new ReflectionMethod(MobilePresence::class, 'codeFor'))->getNumberOfParameters() === 1
    );

    $forged = 'v1.12.0.0123456789abcdef';
    check(
        'کدِ دست‌ساز رد می‌شود',
        MobilePresence::verify($forged, 12)['status'] === 'bad'
    );

    $tampered = substr($code, 0, -1) . ($code[strlen($code) - 1] === 'a' ? 'b' : 'a');
    check(
        'کدِ یک کاراکتر دست‌کاری‌شده رد می‌شود',
        MobilePresence::verify($tampered, 12)['status'] === 'bad'
    );

    check(
        'کدِ ثابتِ خودِ کارمند پذیرفته می‌شود',
        MobilePresence::verify($code, 12)['status'] === 'ok'
    );

    // کدِ چرخانِ قاعدهٔ قبلی (`v1.<id>.<window>.<mac>`) دیگر ساخته نمی‌شود و
    // نباید پذیرفته شود؛ وگرنه یک اسکرین‌شاتِ کهنه دوباره زنده می‌شد.
    $rotating = 'v1.12.' . intdiv($now, 30) . '.' . substr(hash_hmac('sha256', 'v1|12|' . intdiv($now, 30), 'test-key-0123456789abcdef'), 0, 16);
    check(
        'کدِ چرخانِ قاعدهٔ قبلی پذیرفته نمی‌شود',
        MobilePresence::verify($rotating, 12)['status'] === 'bad'
    );

    // ------------------------------------------------------- کارمندِ دیگری
    check(
        'کدِ کارمندِ دیگر «foreign» است، نه معتبر',
        MobilePresence::verify($other, 12)['status'] === 'foreign'
    );

    // ------------------------------------------------------------ خروجیِ دسته‌ای
    $payload = MobilePresence::codesFor([12, 13, 0, 12]);

    // کلیدهای آرایه در PHP عددی می‌شوند (‎'12'‎ → ‎12‎)، پس برای سنجش با متن
    // ابتدا رشته می‌شوند؛ همان چیزی که در JSON به کلیدِ رشته‌ای تبدیل می‌شود.
    check(
        'کدها برای همهٔ شناسه‌های سالم ساخته می‌شوند',
        array_map('strval', array_keys($payload['codes'])) === ['12', '13'],
        implode(',', array_keys($payload['codes']))
    );
    check('شناسهٔ صفر ساخته نمی‌شود', ! isset($payload['codes']['0']));
    check(
        'پاسخ حالت را `static` اعلام می‌کند',
        $payload['mode'] === 'static',
        (string) $payload['mode']
    );
    check('کدِ هر کارمند همان کدِ ثابتِ خودش است', $payload['codes']['12'] === $code);
    check('کدِ ثابت تاریخ انقضا ندارد (expires_in حذف شده)', ! array_key_exists('expires_in', $payload));

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

    // ------------------------------------- قفلِ ثبت تا تأییدِ همین ثبت
    // قاعدهٔ تصمیم‌گرفته‌شده: **اول تأیید، بعد ثبت؛ هر ثبت یک تأیید.**
    // یک تأییدِ صبح نباید ورودِ عصر را باز کند. همین می‌شود همان باگی که
    // کاربر گزارش داد: یک اسکن، تمامِ روز ثبت را آزاد می‌گذاشت.
    $dmy = '17102026';

    // زمانِ ردیف‌ها **پویا** است: از وقتی تأیید ۳۰ ثانیه اعتبار دارد، یک
    // تاریخِ ثابت در گذشته خودش «منقضی» است و تست‌های «تأیید آماده است» را
    // به اشتباه قرمز می‌کرد. حالتِ منقضی جداگانه و عمداً با تاریخِ کهنه ساخته
    // می‌شود (پایین‌تر).
    $freshAt = date('Y-m-d H:i:s');
    $pendingRow = (object) ['id' => 7, 'method' => 'qr', 'confirmed_at' => $freshAt, 'consumed_at' => null];
    $usedRow = (object) ['id' => 7, 'method' => 'qr', 'confirmed_at' => $freshAt, 'consumed_at' => $freshAt];

    $GLOBALS['presence_config']['services.mobile.qr.required'] = true;
    DB::reset();
    check(
        'بدونِ تأیید، ورودِ تازه قفل است',
        MobilePresence::blocksPunch(12, $dmy, 'start') === true
    );

    DB::$presenceRow = $pendingRow;
    check(
        'با تأییدِ مصرف‌نشده، ورود باز است',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );
    check(
        'و خروج هم با همان تأییدِ آماده باز است',
        MobilePresence::blocksPunch(12, $dmy, 'pause') === false
    );

    // 🔴 قلبِ این تغییر: تأییدی که با ثبتِ قبلی «خرج» شده، نه ورودِ بعدی را
    // باز می‌کند نه خروجِ بعدی؛ وگرنه دو ثبت در یک روز فقط یک اسکن می‌خواست.
    DB::$presenceRow = $usedRow;
    check(
        'تأییدِ مصرف‌شده، ورودِ بعدی را باز نمی‌کند',
        MobilePresence::blocksPunch(12, $dmy, 'start') === true
    );
    check(
        'و خروجِ همان شیفت هم قفل است (خروج هم تأییدِ تازه می‌خواهد)',
        MobilePresence::blocksPunch(12, $dmy, 'pause') === true
    );
    check(
        'و ردیفِ تأیید برای نمایش باقی می‌ماند',
        MobilePresence::today(12, $dmy) !== null
    );

    // تأییدِ دستیِ مدیر هم همان ردیف را می‌نویسد، پس همان قفل را باز می‌کند.
    // تاریخِ پویا: تأییدِ دستی هم مثل تأییدِ QR عمر دارد و ردیفِ ثابتِ کهنه
    // با قاعدهٔ ۳۰ ثانیه «منقضی» حساب می‌شد.
    DB::$presenceRow = (object) ['id' => 8, 'method' => 'manual', 'confirmed_at' => date('Y-m-d H:i:s'), 'consumed_at' => null];
    check(
        'تأییدِ دستیِ مدیر هم قفل را باز می‌کند',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );
    check(
        'و قفلِ خروج را هم باز می‌کند',
        MobilePresence::blocksPunch(12, $dmy, 'pause') === false
    );

    // --------------------------------------- مصرف و ثبتِ دوبارهٔ تأیید
    DB::reset();
    DB::$presenceRow = $pendingRow;
    check(
        'consume تأییدِ آماده را مصرف می‌کند',
        MobilePresence::consume(12, $dmy) === true && ! empty(DB::$updated) && ! empty(DB::$updated[0]['consumed_at'])
    );

    DB::reset();
    DB::$presenceRow = $usedRow;
    check(
        'اگر تأییدِ آمده‌ای نباشد، consume کاری نمی‌کند',
        MobilePresence::consume(12, $dmy) === false && empty(DB::$updated)
    );

    DB::reset();
    MobilePresence::confirm(12, $dmy, MobilePresence::METHOD_QR, 42, '10.0.0.1');
    check(
        'هر confirm یک ردیفِ تازه می‌نویسد، نه بازنویسیِ ردیفِ قبلی',
        count(DB::$inserted) === 1
            && array_key_exists('consumed_at', DB::$inserted[0])
            && DB::$inserted[0]['consumed_at'] === null
    );

    // ------------------------------------- وضعیتِ ارسالی به اپ/پنل (`state`)
    DB::reset();
    DB::$presenceRow = $usedRow;
    $forStart = MobilePresence::state(12, $dmy, $now, 'start');
    $forPause = MobilePresence::state(12, $dmy, $now, 'pause');
    check(
        'پس از مصرف، state برای ورودِ تازه lock می‌دهد',
        $forStart['lock'] === true && $forStart['confirmed'] === true && $forStart['pending'] === false
    );
    check(
        'همان state برای خروج هم lock می‌دهد (خروج هم تأییدِ تازه می‌خواهد)',
        $forPause['lock'] === true
            && $forPause['intent'] === 'pause'
    );

    DB::$presenceRow = $pendingRow;
    $ready = MobilePresence::state(12, $dmy, $now, 'start');
    check(
        'تأییدِ آماده lock را برمی‌دارد',
        $ready['pending'] === true && $ready['lock'] === false
    );

    // ------------------------------------------------- مهلتِ تأیید (۳۰ ثانیه)
    // قاعده: تأیید فقط می‌گوید «همین حالا در برابرِ کارت بودم». بعد از مهلت
    // دوباره اسکن می‌خواهد — وگرنه یک اسکنِ صبح تا شب درِ ثبت را باز می‌گذاشت.
    check(
        'پیش‌فرضِ مهلت ۳۰ ثانیه است',
        MobilePresence::punchWindow() === 30,
        (string) MobilePresence::punchWindow()
    );

    DB::reset();
    DB::$presenceRow = $pendingRow;
    $fresh = MobilePresence::state(12, $dmy);
    check(
        'تأییدِ همین لحظه مهلتِ مثبت به اپ می‌دهد',
        $fresh['pending'] === true && $fresh['lock'] === false && $fresh['seconds_left'] > 0
            && $fresh['seconds_left'] <= 30,
        'seconds_left=' . $fresh['seconds_left']
    );
    check(
        'تأییدِ تازه در پنجره ثبت را باز می‌کند',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );

    // ۳۱ ثانیه قبل: از مهلت گذشته است.
    $oldRow = (object) [
        'id' => 9,
        'method' => 'qr',
        'confirmed_at' => date('Y-m-d H:i:s', time() - 31),
        'consumed_at' => null,
    ];

    DB::reset();
    DB::$presenceRow = $oldRow;
    $stale = MobilePresence::state(12, $dmy);
    check(
        'تأییدِ کهنه‌تر از ۳۰ ثانیه دیگر آماده نیست',
        $stale['pending'] === false && $stale['seconds_left'] === 0
    );
    check(
        'و ثبت را دوباره قفل می‌کند',
        $stale['lock'] === true
            && MobilePresence::blocksPunch(12, $dmy, 'start') === true
            && MobilePresence::blocksPunch(12, $dmy, 'pause') === true
    );
    check(
        'تأییدِ منقضی مصرف هم نمی‌شود (سابقه می‌ماند، در باز نمی‌شود)',
        MobilePresence::consume(12, $dmy) === false && empty(DB::$updated)
    );

    // ۲۹ ثانیه قبل: هنوز داخلِ پنجره است (مرز با یک ثانیه فاصله سنجیده می‌شود).
    DB::reset();
    DB::$presenceRow = (object) [
        'id' => 10,
        'method' => 'qr',
        'confirmed_at' => date('Y-m-d H:i:s', time() - 29),
        'consumed_at' => null,
    ];
    check(
        'تأییدِ ۲۹ ثانیه‌ای هنوز معتبر است',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );

    // راهِ فرار: مهلتِ صفر یعنی بدونِ انقضا.
    $GLOBALS['presence_config']['services.mobile.qr.punch_window'] = 0;
    DB::reset();
    DB::$presenceRow = $oldRow;
    check(
        'با مهلتِ صفر، ردیفِ کهنه هم باز می‌کند (بدونِ انقضا)',
        MobilePresence::punchWindow() === 0 && MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );
    $GLOBALS['presence_config']['services.mobile.qr.punch_window'] = 30;

    // ---------------------------------------------- خاموش‌کردنِ اجبار
    $GLOBALS['presence_config']['services.mobile.qr.required'] = false;
    DB::reset();
    check(
        'با required=false قفل بی‌اثر است',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );

    $GLOBALS['presence_config']['services.mobile.qr.key'] = '';
    check(
        'بدونِ کلید (مسیرِ خاموش) هیچ قفلی نیست',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );

    // نبودِ جدولِ تأیید (migration اجرا نشده) نباید کارمند را پشتِ در بگذارد:
    // «قفل نکردن» خطای کوچک است، «قفلِ بی‌دلیل» خطای بزرگ.
    $GLOBALS['presence_config']['services.mobile.qr.key'] = 'test-key-0123456789abcdef';
    $GLOBALS['presence_config']['services.mobile.qr.required'] = true;
    DB::reset();
    DB::$fail = true;
    check(
        'اگر جدولِ تأیید خوانده نشود، ثبت قفل نمی‌شود',
        MobilePresence::blocksPunch(12, $dmy, 'start') === false
    );
    DB::$fail = false;

    DB::reset();
    check(
        'ردیفِ تأیید هم با همان قاعده خوانده می‌شود (بدونِ استثناء)',
        MobilePresence::today(12, $dmy) === null && MobilePresence::blocksPunch(12, $dmy, 'start') === true
    );

    echo $failures === 0
        ? "\nهمهٔ {$checks} بررسیِ کدِ QR گذشت.\n"
        : "\n{$failures} بررسیِ ناموفق از {$checks}.\n";

    exit($failures === 0 ? 0 : 1);
}
