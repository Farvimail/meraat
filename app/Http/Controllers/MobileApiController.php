<?php

namespace App\Http\Controllers;

use App\MobilePresence;
use App\SavedTime;
use App\TimerHub;
use App\User;
use DateTime;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * API اپ موبایل حضور — `/api/v1/*`.
 *
 * قرارداد کاملش در `mobile/docs/API.md` است. سه اصل که همه‌جای این کلاس رعایت
 * می‌شود:
 *
 * ۱. **زمان فقط از سرور.** اپ هیچ ساعتی نمی‌فرستد؛ `time` هر ردیف را همین‌جا
 *    با offset ثابت `+03:30` می‌سازیم (همان کاری که `SavedTimeController`
 *    برای پنل می‌کند).
 * ۲. **امروزِ واقعی، نه «تاریخ فعال سامانه».** مسیرهای وب عمداً
 *    `FunctionsController::systemDmy()` را می‌خوانند تا مدیر بتواند در ماه‌های
 *    قبل کار کند؛ اگر اپ هم همان را بخواند، حضور امروز کارمند در ماهی که مدیر
 *    باز کرده ثبت می‌شود. پس اینجا `realDate()` مبناست.
 * ۳. **رکورد مثل پنل ساخته می‌شود.** همان `tbl_saved_time` + `tbl_timer`؛
 *    هیچ جدول موازی‌ای ساخته نشد تا حضور ثبت‌شده با اپ در همهٔ گزارش‌های
 *    حقوق و دستمزد همان‌طور دیده شود که با پنل دیده می‌شود.
 */
class MobileApiController extends Controller
{
    /** پنجرهٔ پذیرشِ ادعای اثر انگشت (ثانیه). */
    const BIOMETRIC_WINDOW = 60;

    /** حداکثر عمر گزارش آی‌پی محل کار (دقیقه). */
    const OFFICE_IP_TTL = 30;

    /** تعداد روز در هر صفحهٔ سابقه. */
    const HISTORY_PER_PAGE = 30;

    /**
     * سقفِ حجم عکس پروفایل (بایت).
     *
     * ۸ مگابایت عمداً دست‌ودل‌باز است: اپ پیش از فرستادن، عکس را مربع می‌بُرد
     * و با کیفیت ۰٫۷ فشرده می‌کند (معمولاً چند صد کیلوبایت)؛ پس این سقف فقط
     * جلوی فایل‌های عجیب را می‌گیرد، نه عکسِ معمولیِ گوشی.
     */
    const PHOTO_MAX_BYTES = 8388608;

    /** پسوندهای مجازِ عکس پروفایل → نوعِ MIME. */
    const PHOTO_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    // ------------------------------------------------------------- ورود/خروج

    public function login(Request $request)
    {
        $data = $request->json()->all();

        $email = trim((string) ($data['email'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $deviceId = trim((string) ($data['device_id'] ?? ''));
        $deviceName = mb_substr(trim((string) ($data['device_name'] ?? 'گوشی کارمند')), 0, 100);
        $platform = mb_substr(trim((string) ($data['platform'] ?? '')), 0, 20);

        if ($email === '' || $password === '' || $deviceId === '') {
            return $this->fail(422, 'bad_request', 'ایمیل، رمز و شناسهٔ دستگاه لازم است.');
        }

        $user = User::query()
            ->where('email', $email)
            ->whereNull('archived_at')
            ->first();

        if (empty($user) || !Hash::check($password, $user->password)) {
            return $this->fail(401, 'invalid_credentials', 'ایمیل یا رمز عبور درست نیست.');
        }

        $ip = $request->ip();
        $now = date('Y-m-d H:i:s');

        DB::beginTransaction();

        try {
            $device = DB::table('tbl_mobile_device')
                ->where('device_id', $deviceId)
                ->whereNull('released_at')
                ->first();

            if (!empty($device) && (int) $device->customer_id !== (int) $user->id) {
                DB::rollBack();

                return $this->fail(
                    409,
                    'device_already_bound',
                    'این گوشی به کارمند دیگری بسته شده است. مدیر باید اول آزادش کند.'
                );
            }

            if (empty($device)) {
                // یک کارمند، یک گوشی. اگر روی گوشی دیگری فعال است، مدیر باید
                // اول آزادش کند؛ جایگزینی خودکار یعنی هر کسی با رمز لو رفته
                // می‌تواند گوشی جدید ببندد و گوشی اصلی را بی‌صدا کنار بگذارد.
                $other = DB::table('tbl_mobile_device')
                    ->where('customer_id', $user->id)
                    ->whereNull('released_at')
                    ->first();

                if (!empty($other)) {
                    DB::rollBack();

                    return $this->fail(
                        409,
                        'device_already_bound',
                        'حساب شما روی گوشی دیگری فعال است. برای عوض کردن گوشی با مدیر تماس بگیرید.'
                    );
                }

                DB::table('tbl_mobile_device')->insert([
                    'customer_id' => $user->id,
                    'device_id' => $deviceId,
                    'device_secret_hash' => hash('sha256', bin2hex(random_bytes(32))),
                    'device_name' => $deviceName,
                    'platform' => $platform,
                    'bound_at' => $now,
                    'last_seen_at' => $now,
                    'last_ip' => $ip,
                ]);

                $device = DB::table('tbl_mobile_device')->where('device_id', $deviceId)->first();
            } else {
                DB::table('tbl_mobile_device')->where('id', $device->id)->update([
                    'last_seen_at' => $now,
                    'last_ip' => $ip,
                ]);
            }

            // یک گوشی، یک نشست فعال: توکن‌های قبلی همان دستگاه باطل می‌شوند.
            DB::table('tbl_mobile_token')
                ->where('device_id', $deviceId)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => $now]);

            $token = bin2hex(random_bytes(32));

            DB::table('tbl_mobile_token')->insert([
                'customer_id' => $user->id,
                'device_id' => $deviceId,
                'token_hash' => hash('sha256', $token),
                'created_at' => $now,
            ]);

            DB::commit();
        } catch (\Throwable $error) {
            DB::rollBack();

            return $this->fail(500, 'server', 'ورود انجام نشد. کمی بعد دوباره تلاش کنید.');
        }

        return response()->json([
            'token' => $token,
            'employee' => $this->employee($user),
            'device' => $this->device($device),
            'today' => $this->todayPayload($user->id),
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->attributes->get('mobile_token');

        DB::table('tbl_mobile_token')
            ->where('id', $token->id)
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        return response('', 204, ['Content-Type' => 'application/json']);
    }

    // ------------------------------------------------------- خواندن وضعیت

    public function me(Request $request)
    {
        $user = $request->attributes->get('mobile_user');
        $device = $request->attributes->get('mobile_device');

        return response()->json([
            'employee' => $this->employee($user),
            'device' => $this->device($device),
            'server_time' => $this->serverTime(),
        ]);
    }

    public function today(Request $request)
    {
        $user = $request->attributes->get('mobile_user');

        return response()->json($this->todayPayload($user->id));
    }

    /**
     * «انگشتِ تغییرِ» امروزِ همین کارمند — سبک‌ترین راهِ فهمیدنِ اینکه رکوردی
     * عوض شده یا نه.
     *
     * چرا لازم است: مدیر از داخلِ سایت (یا خودِ پنل) شروع/توقف را می‌زند و
     * باید همان لحظه روی گوشی هم دیده شود. اپ دو مسیر دارد: سوکتِ زندهٔ هاب
     * که کارِ اصلی را می‌کند، و همین پرسشِ پشتیبان برای وقتی که سوکت وصل
     * نمی‌شود (هاب خاموش، اینترنتِ سختگیر، …). خواندنِ کاملِ `today` هر چند
     * ثانیه یعنی یک کوئریِ سنگین‌تر و یک پاسخِ بزرگ برای هر گوشی؛ اینجا دو
     * عدد و یک مُهرِ زمانی برمی‌گردد.
     *
     * سه جزء دارد و هر سه لازم است: تعدادِ رکورد، آخرین شناسه (تا حذف/ویرایشِ
     * یک رکورد هم گرفته شود) و زمانِ تأییدِ حضور (تأییدِ دستیِ مدیر از سمتِ
     * پنل هم باید روی گوشی دیده شود).
     */
    public function revision(Request $request)
    {
        $user = $request->attributes->get('mobile_user');
        $dmy = $this->realDmy();

        $punches = DB::table('tbl_saved_time')
            ->join('tbl_timer', 'tbl_saved_time.id', '=', 'tbl_timer.saved_time_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where('tbl_calendar.dmy', $dmy)
            ->where('tbl_timer.customer_id', $user->id)
            ->where(function ($query) {
                $query->where('tbl_saved_time.deleted', 0)
                    ->orWhereNull('tbl_saved_time.deleted');
            })
            ->select(DB::raw('count(*) as rows_count'), DB::raw('max(tbl_saved_time.id) as last_id'))
            ->first();

        $presence = MobilePresence::today($user->id, $dmy);

        return response()->json([
            'revision' => ($punches->rows_count ?? 0) . ':' . ($punches->last_id ?? 0)
                . ':' . (empty($presence) ? '-' : (string) $presence->confirmed_at),
            'dmy' => (int) $dmy,
            'server_time' => $this->serverTime(),
        ]);
    }

    // ---------------------------------------------------------------- ثبت

    public function punch(Request $request)
    {
        $data = $request->json()->all();

        $user = $request->attributes->get('mobile_user');
        $device = $request->attributes->get('mobile_device');

        $intent = (string) ($data['intent'] ?? '');
        $deviceId = trim((string) ($data['device_id'] ?? ''));

        if ($intent !== 'start' && $intent !== 'pause') {
            return $this->fail(422, 'bad_request', 'نوع ثبت مشخص نشده است.');
        }

        if ($deviceId === '' || $deviceId !== $device->device_id) {
            return $this->fail(403, 'device_mismatch', 'این درخواست از گوشیِ بسته‌شده به حساب شما نیامده است.');
        }

        if (!$this->officeNetworkAllows($request->ip())) {
            return $this->fail(403, 'outside_office_network', 'ثبت فقط از شبکهٔ محل کار انجام می‌شود.');
        }

        if (!$this->biometricFresh($data['biometric_verified_at'] ?? null)) {
            return $this->fail(422, 'biometric_required', 'تأیید اثر انگشت انجام نشده است.');
        }

        $dmy = $this->realDmy();

        // ترتیبِ تصمیم‌گرفته‌شده: **اول تأییدِ حضور، بعد ثبتِ ورود و خروج.**
        // کارمندی که حضورِ امروزش را با اسکنِ QR (یا دستِ مدیر) تأیید نکرده،
        // نه ورود می‌زند و نه خروج. عمداً اینجا و نه فقط در دکمهٔ اپ: اپ می‌تواند
        // دکمه‌اش را قفل کند، ولی مرجعِ قاعده باید سرور باشد — وگرنه یک درخواستِ
        // دستی از آن رد می‌شود و «در برابرِ صفحه بودن» بی‌معنی می‌شود.
        // پیام عمداً می‌گوید «چه کار کنم»، نه فقط «نشد».
        if (MobilePresence::blocksPunch($user->id, $dmy)) {
            return $this->fail(
                403,
                'presence_required',
                'اول با اسکنِ QR روی کارتِ خودتان حضورِ امروز را تأیید کنید؛ بعد از آن ثبتِ ورود و خروج کار می‌کند.'
            );
        }

        $expected = $this->nextIntent($user->id);

        if ($intent !== $expected) {
            // همان قاعدهٔ `SavedTimeController::noDuplicate()`: دو ورود پشت‌سرهم
            // یا دو خروج پشت‌سرهم ثبت نمی‌شود.
            return response()->json([
                'error' => 'duplicate_punch',
                'expected' => $expected,
                'message' => 'این ثبت قبلاً انجام شده است.',
            ], 409);
        }

        $calendarId = $this->calendarIdForDmy($dmy);

        if ($calendarId === null) {
            return $this->fail(409, 'server', 'روز کاری امروز در تقویم سامانه پیدا نشد.');
        }

        $time = $this->clock();
        $isStart = $expected === 'start';

        DB::beginTransaction();

        try {
            $savedTime = SavedTime::create([
                'time' => $time,
                'start' => $isStart ? 1 : 0,
                'pause' => $isStart ? 0 : 1,
            ]);

            TimerController::create($user, $calendarId, $savedTime->id);

            DB::commit();
        } catch (\Throwable $error) {
            DB::rollBack();

            return $this->fail(500, 'server', 'ثبت انجام نشد. دوباره تلاش کنید.');
        }

        // پنل‌های باز همان لحظه خبردار می‌شوند. عمداً **بعد از** commit:
        // اگر خبر پیش از نوشتن برود، پنل ممکن است رکورد را نبیند و برای همیشه
        // روی همان عدد بماند. در عوض تأخیرِ چند صدم‌ثانیه‌ایِ این خبر بعد از
        // ثبت اهمیتی ندارد.
        TimerHub::announce($user->id, $dmy);

        return response()->json([
            'action' => $expected,
            'punch' => [
                'time' => $time,
                'start' => $isStart ? 1 : 0,
                'pause' => $isStart ? 0 : 1,
            ],
            'today' => $this->todayPayload($user->id),
        ]);
    }

    // -------------------------------------------------------------- سابقه

    public function history(Request $request)
    {
        $user = $request->attributes->get('mobile_user');
        $page = max(1, (int) $request->query('page', 1));

        $todayId = $this->calendarIdForDmy($this->realDmy());

        if ($todayId === null) {
            return response()->json(['days' => [], 'server_time' => $this->serverTime()]);
        }

        // روزها از روی تقویم می‌آیند نه از روی رشتهٔ `dmy`: این رشته صفر
        // پیشوند ندارد (`1102026` یعنی ۱ مهر) پس مقایسهٔ متنی‌اش غلط است.
        // `tbl_calendar.id` به ترتیب تاریخ ساخته شده، پس همین معیار است.
        $dayRows = DB::table('tbl_calendar')
            ->join('tbl_timer', 'tbl_calendar.id', '=', 'tbl_timer.calendar_id')
            ->where('tbl_timer.customer_id', $user->id)
            ->where('tbl_calendar.status', '<>', '3')
            ->where('tbl_calendar.id', '<=', $todayId)
            ->groupBy('tbl_calendar.dmy')
            ->select('tbl_calendar.dmy', DB::raw('MAX(tbl_calendar.id) AS day_id'))
            ->orderBy('day_id', 'desc')
            ->skip(($page - 1) * self::HISTORY_PER_PAGE)
            ->take(self::HISTORY_PER_PAGE)
            ->get();

        $dmys = [];
        foreach ($dayRows as $row) {
            $dmys[] = $row->dmy;
        }

        $punches = empty($dmys) ? [] : DB::table('tbl_saved_time')
            ->join('tbl_timer', 'tbl_saved_time.id', '=', 'tbl_timer.saved_time_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where('tbl_timer.customer_id', $user->id)
            ->whereIn('tbl_calendar.dmy', $dmys)
            ->where(function ($query) {
                $query->where('tbl_saved_time.deleted', 0)
                    ->orWhereNull('tbl_saved_time.deleted');
            })
            ->orderBy('tbl_saved_time.id', 'asc')
            ->select('tbl_calendar.dmy', 'tbl_saved_time.time', 'tbl_saved_time.start', 'tbl_saved_time.pause')
            ->get();

        $byDay = [];
        foreach ($punches as $punch) {
            $byDay[$punch->dmy][] = $punch;
        }

        $days = [];

        foreach ($dayRows as $row) {
            $rows = $byDay[$row->dmy] ?? [];

            $entry = null;
            $exit = null;
            $minutes = null;
            $openAt = null;
            // همهٔ تیک‌های آن روز، به ترتیب. کارمند با باز کردن یک روز باید
            // ببیند کجا آمد و کجا رفت — نه فقط اولین ورود و آخرین خروج.
            $events = [];

            foreach ($rows as $punch) {
                $isStart = (int) $punch->start === 1;

                $events[] = [
                    'time' => $punch->time,
                    'start' => $isStart ? 1 : 0,
                    'pause' => $isStart ? 0 : 1,
                ];

                if ($isStart) {
                    if ($entry === null) {
                        $entry = $punch->time;
                    }
                    $openAt = $punch->time;
                } else {
                    $exit = $punch->time;

                    if ($openAt !== null) {
                        $minutes = (int) $minutes + $this->minutesBetween($openAt, $punch->time);
                        $openAt = null;
                    }
                }
            }

            // شیفت بازی که هنوز بسته نشده: تا همین لحظه حساب می‌شود، ولی فقط
            // برای امروز؛ وگرنه یک شبانه‌روز فراموش‌شده کل ماه را باد می‌کرد.
            if ($openAt !== null && $row->dmy === $this->realDmy()) {
                $minutes = (int) $minutes + $this->minutesBetween($openAt, $this->clock());
            }

            $days[] = [
                'dmy' => (int) $row->dmy,
                'entry' => $entry,
                'exit' => $exit,
                'minutes' => $minutes,
                'punches' => $events,
            ];
        }

        return response()->json([
            'days' => $days,
            'server_time' => $this->serverTime(),
        ]);
    }

    // -------------------------------------------------------- آی‌پی محل کار

    /**
     * ثبت آی‌پی خروجی محل کار. ایجنتِ داخل شبکه هر یکی‌دو دقیقه صدا می‌زند.
     *
     * با هدر `X-Agent-Key` محافظت می‌شود؛ کلیدش در `.env` سرور است.
     */
    public function officeIp(Request $request)
    {
        $expected = (string) config('services.mobile.office_agent_key', '');

        if ($expected === '') {
            return $this->fail(503, 'server', 'کلید ایجنت شبکهٔ محل کار روی سرور تنظیم نشده است.');
        }

        if (!hash_equals($expected, (string) $request->header('X-Agent-Key', ''))) {
            return $this->fail(403, 'unauthorized', 'کلید ایجنت درست نیست.');
        }

        $ip = trim((string) $request->input('ip', ''));

        if ($ip === '' || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return $this->fail(422, 'bad_request', 'آی‌پی درست نیست.');
        }

        DB::table('tbl_office_ip')->updateOrInsert(
            ['ip' => $ip],
            ['seen_at' => date('Y-m-d H:i:s')]
        );

        return response()->json(['ip' => $ip, 'server_time' => $this->serverTime()]);
    }

    // --------------------------------------------------------------- کمکی‌ها

    /**
     * آیا درخواست از «شبکهٔ محل کار» آمده است؟
     *
     * قید عمداً نرم است: تا وقتی هیچ آی‌پی‌ای در `tbl_office_ip` گزارش نشده،
     * قید خاموش است. اگر سخت‌گیرانه باشد و جدول خالی بماند (ایجنت نصب نشده)،
     * هیچ‌کس نمی‌تواند از گوشی حضور بزند و رفعش هم فقط از داخل سرور ممکن است.
     * به‌محض اینکه ایجنت اولین آی‌پی را ثبت کند، قید خودش روشن می‌شود.
     */
    private function officeNetworkAllows($ip)
    {
        if (DB::table('tbl_office_ip')->count() === 0) {
            return true;
        }

        $fresh = date('Y-m-d H:i:s', time() - self::OFFICE_IP_TTL * 60);

        return DB::table('tbl_office_ip')
            ->where('ip', $ip)
            ->where('seen_at', '>=', $fresh)
            ->exists();
    }

    /**
     * ادعای اثر انگشت تازه است؟
     *
     * این یک **ادعای کلاینت** است، نه مدرک: API سیستم‌عامل نمی‌گوید کدام انگشت
     * تطبیق خورد. کارش فقط بستن راهِ درخواست‌های تمام‌خودکار است. امنیت واقعی
     * از «گوشیِ بسته‌شده به کارمند» و توکن می‌آید.
     */
    private function biometricFresh($value)
    {
        if ($value === null || !is_numeric($value)) {
            return false;
        }

        $verifiedAt = (int) $value;
        $now = (int) round(microtime(true) * 1000);

        // مقدار ثانیه‌ای هم پذیرفته می‌شود (بعضی دستگاه‌ها میلی‌ثانیه نمی‌دهند).
        if ($verifiedAt < $now / 1000) {
            $verifiedAt = $verifiedAt * 1000;
        }

        if ($verifiedAt > $now + 5000) {
            return false;
        }

        return ($now - $verifiedAt) <= self::BIOMETRIC_WINDOW * 1000;
    }

    /**
     * ثبتِ بعدی چیست؟ (همان منطق `noDuplicate` در پنل)
     */
    private function nextIntent($customerId)
    {
        $last = DB::table('tbl_saved_time')
            ->join('tbl_timer', 'tbl_saved_time.id', '=', 'tbl_timer.saved_time_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where('tbl_calendar.dmy', $this->realDmy())
            ->where('tbl_timer.customer_id', $customerId)
            ->orderBy('tbl_saved_time.id', 'desc')
            ->select('tbl_saved_time.start', 'tbl_saved_time.pause')
            ->first();

        if (empty($last)) {
            return 'start';
        }

        return (int) $last->start === 1 ? 'pause' : 'start';
    }

    private function todayPayload($customerId)
    {
        $dmy = $this->realDmy();

        $punches = DB::table('tbl_saved_time')
            ->join('tbl_timer', 'tbl_saved_time.id', '=', 'tbl_timer.saved_time_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where('tbl_calendar.dmy', $dmy)
            ->where('tbl_timer.customer_id', $customerId)
            ->where(function ($query) {
                $query->where('tbl_saved_time.deleted', 0)
                    ->orWhereNull('tbl_saved_time.deleted');
            })
            ->orderBy('tbl_saved_time.id', 'asc')
            ->select('tbl_saved_time.time', 'tbl_saved_time.start', 'tbl_saved_time.pause')
            ->get();

        $rows = [];

        foreach ($punches as $punch) {
            $rows[] = [
                'time' => $punch->time,
                'start' => (int) $punch->start,
                'pause' => (int) $punch->pause,
            ];
        }

        return [
            'dmy' => (int) $dmy,
            'punches' => $rows,
            'server_time' => $this->serverTime(),
            // وضعیتِ تأییدِ حضورِ امروز: اپ با همین می‌فهمد بعد از ثبتِ ورود
            // باید دوربین را باز کند یا نه (`required && !confirmed`).
            'qr' => MobilePresence::state($customerId, $dmy),
        ];
    }

    /**
     * روزِ کاریِ امروزِ واقعی در تقویم.
     *
     * دو تله اینجا هست: تاریخ از `realDate()` می‌آید (نه از تاریخ فعالِ مدیر)
     * و برای روزهایی که چند ردیف دارند (تقویم بعضی روزها دو بار ثبت شده)
     * جدیدترین ردیفِ باز (`status <> 3`) انتخاب می‌شود؛ همان کاری که
     * `SavedTimeController::findToday()` می‌کند.
     */
    private function calendarIdForDmy($dmy)
    {
        $row = DB::table('tbl_calendar')
            ->where('dmy', $dmy)
            ->where('status', '<>', '3')
            ->orderBy('id', 'desc')
            ->first();

        if (empty($row)) {
            $row = DB::table('tbl_calendar')->where('dmy', $dmy)->orderBy('id', 'desc')->first();
        }

        return empty($row) ? null : $row->id;
    }

    private function realDmy()
    {
        // `realDate()` امروزِ واقعی است، مستقل از «تاریخ فعال سامانه».
        return date('dmY', strtotime(FunctionsController::realDate()));
    }

    private function clock()
    {
        return (new DateTime('now', new DateTimeZone('+03:30')))->format('H:i:s');
    }

    private function serverTime()
    {
        $now = new DateTime('now', new DateTimeZone('+03:30'));

        return [
            'iso' => $now->format('Y-m-d\TH:i:sP'),
            'dmy' => (int) date('dmY', strtotime(FunctionsController::realDate())),
            'clock' => $now->format('H:i:s'),
        ];
    }

    private function minutesBetween($from, $to)
    {
        $diff = strtotime($to) - strtotime($from);

        return $diff > 0 ? (int) floor($diff / 60) : 0;
    }

    private function employee(User $user)
    {
        return [
            'id' => (int) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'national_code' => (string) $user->national_code,
            'role' => $this->roleOf($user->id),
            'avatar' => $this->avatarOf($user->id),
        ];
    }

    /**
     * نام فایل عکس پروفایل در `public/images/users/` — همان ستون `name` که
     * پنل وب نشان می‌دهد (آخرین آپلود).
     *
     * اگر عکسی ثبت نشده یا جدول در دسترس نبود `null` برمی‌گردد تا اپ خودش
     * حالت جایگزین (حروف اول نام) را بکشد؛ نبودِ عکس نباید ورود یا `/me` را
     * بشکند.
     */
    private function avatarOf($customerId)
    {
        try {
            $photo = PhotoController::show($customerId)
                ->orderBy('tbl_users_profile.id', 'desc')
                ->first();

            return $photo->name ?? null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * عنوان شغلی از `tbl_customer_roles` + `tbl_roles`.
     *
     * اگر جدول‌ها خالی باشند یا ستون نامشان فرق کند، اپ خودش ایمیل را نشان
     * می‌دهد؛ پس این تابع هرگز نباید ورود را بشکند.
     */
    private function roleOf($customerId)
    {
        try {
            $row = DB::table('tbl_customer_roles')
                ->join('tbl_roles', 'tbl_roles.id', '=', 'tbl_customer_roles.role_id')
                ->where('tbl_customer_roles.customer_id', $customerId)
                ->orderBy('tbl_customer_roles.role_id', 'desc')
                ->select('tbl_roles.*')
                ->first();
        } catch (\Throwable $error) {
            return null;
        }

        if (empty($row)) {
            return null;
        }

        foreach (['name', 'title', 'role', 'role_name'] as $column) {
            if (!empty($row->$column)) {
                return (string) $row->$column;
            }
        }

        return null;
    }

    private function device($device)
    {
        return [
            'id' => $device->device_id,
            'bound_at' => $device->bound_at,
        ];
    }

    // ----------------------------------------------------------- عکس پروفایل

    /**
     * گذاشتن/عوض کردنِ عکس پروفایل کارمند — `POST /api/v1/profile/photo`.
     *
     * چرا روی سرور و در همان جدولِ پنل (`tbl_users_profile`): عکس یک جا ذخیره
     * می‌شود و هم اپ و هم پنل وب و هم گزارش‌های ماهانه از همان یک منبع
     * می‌خوانند؛ وگرنه دو چهرهٔ متفاوت برای یک کارمند دیده می‌شود.
     *
     * ورودی: `multipart/form-data` با فیلدِ `photo`. برش و چرخش در خود گوشی
     * انجام می‌شود (پیکرِ سیستم)، پس اینجا فقط اعتبارسنجی و ذخیره است.
     */
    public function uploadPhoto(Request $request)
    {
        $user = $request->attributes->get('mobile_user');

        $file = $request->file('photo');

        if (empty($file)) {
            return $this->fail(422, 'photo_required', 'عکسی فرستاده نشد.');
        }

        if (!$file->isValid()) {
            return $this->fail(422, 'photo_upload_failed', 'فایل عکس نیمه‌کاره رسید؛ دوباره تلاش کنید.');
        }

        $size = (int) $file->getSize();

        if ($size <= 0) {
            return $this->fail(422, 'photo_empty', 'فایل عکس خالی است.');
        }

        if ($size > self::PHOTO_MAX_BYTES) {
            return $this->fail(413, 'photo_too_large', 'حجم عکس بیش از حد مجاز است.');
        }

        /*
         * نوعِ فایل را از خودِ محتوا می‌خوانیم، نه از پسوند یا هدرِ کلاینت:
         * پسوند را هر کسی می‌تواند بگوید `jpg`. `getimagesize` بدون GD هم
         * کار می‌کند و روی فایلِ غیرتصویری `false` می‌دهد.
         */
        $info = @getimagesize($file->getPathname());
        $mime = is_array($info) ? ($info['mime'] ?? '') : '';

        if (!isset(self::PHOTO_TYPES[$mime])) {
            return $this->fail(422, 'photo_not_image', 'فقط عکس (jpeg، png، gif یا webp) پذیرفته می‌شود.');
        }

        // نامِ تازه برای هر آپلود: `images/users/PRP.jpg` دست‌نخورده می‌ماند و
        // کشِ مرورگر/گوشی هم خودش با عوض شدنِ نشانی تازه می‌شود.
        $previous = $this->avatarOf($user->id);
        $name = 'u' . (int) $user->id . '-' . date('Ymd-His') . '-'
            . substr(sha1(uniqid('', true)), 0, 6) . '.' . self::PHOTO_TYPES[$mime];

        try {
            $file->move(public_path('images/users'), $name);
        } catch (\Throwable $e) {
            return $this->fail(500, 'photo_save_failed', 'ذخیرهٔ عکس روی سرور انجام نشد.');
        }

        PhotoController::store($name, 'images/users/' . $name, $user->id);

        // عکسِ قبلی بعد از موفقیتِ ذخیره پاک می‌شود؛ اگر پاک نشد، فقط یک فایلِ
        // بی‌استفاده می‌ماند و چیزی خراب نمی‌شود.
        $this->forgetPhotoFile($previous);

        return response()->json([
            'avatar' => $name,
            'employee' => $this->employee($user),
        ]);
    }

    /**
     * حذفِ عکس پروفایل — `DELETE /api/v1/profile/photo`.
     *
     * بعد از این، هم اپ و هم پنل وب به همان عکسِ پیش‌فرضِ سرور برمی‌گردند
     * (`images/users/PRP.jpg`)؛ ردیفِ `tbl_users_profile` پاک می‌شود، پس
     * هیچ جای دیگری لازم نیست عوض شود.
     */
    public function deletePhoto(Request $request)
    {
        $user = $request->attributes->get('mobile_user');

        $previous = $this->avatarOf($user->id);

        try {
            DB::table('tbl_users_profile')->where('customer_id', $user->id)->delete();
        } catch (\Throwable $e) {
            return $this->fail(500, 'photo_delete_failed', 'حذف عکس انجام نشد؛ دوباره تلاش کنید.');
        }

        $this->forgetPhotoFile($previous);

        return response()->json([
            'avatar' => null,
            'employee' => $this->employee($user),
        ]);
    }

    /**
     * پاک کردنِ فایلِ عکسی که دیگر به آن اشاره‌ای نیست.
     *
     * دو نگهبان دارد: فقط نامِ فایل (نه مسیر) پذیرفته می‌شود تا با `..` کسی
     * نتواند بیرونِ پوشهٔ عکس‌ها را پاک کند، و عکسِ پیش‌فرض هرگز پاک نمی‌شود.
     */
    private function forgetPhotoFile($name)
    {
        $name = basename(trim((string) $name));

        if ($name === '' || strcasecmp($name, 'PRP.jpg') === 0) {
            return;
        }

        try {
            $path = public_path('images/users/' . $name);

            if (is_file($path)) {
                @unlink($path);
            }
        } catch (\Throwable $e) {
            // پاک‌نشدنِ فایلِ قدیمی نباید کارِ کاربر را خراب کند.
        }
    }

    // ------------------------------------------------------- تأییدِ حضور با QR

    /**
     * تأییدِ حضور با کدِ چرخانِ QR — `POST /api/v1/qr/confirm`.
     *
     * جریانِ تصمیم‌گرفته‌شده: **اول تأیید، بعد ثبت**. تا این مسیر موفق نشود،
     * `punch` برای امروز با `presence_required` رد می‌شود؛ اپ پس از ورود اگر
     * `qr.required && !qr.confirmed` بود، اسکنر را باز می‌کند و همین مسیر را
     * صدا می‌زند و دکمهٔ ثبتش تا همان لحظه کار نمی‌کند.
     *
     * چرا اعتبارِ کد اینجا و نه در گوشی سنجیده می‌شود: `MobilePresence::verify`
     * پنجره را از خودِ کد می‌خواند (نه از ساعتِ گوشی) و MAC را با کلیدی که
     * فقط سرور دارد می‌سنجد؛ پس دست‌کاریِ ساعتِ گوشی یا کدِ دست‌ساز بی‌اثر است.
     */
    public function qrConfirm(Request $request)
    {
        $user = $request->attributes->get('mobile_user');
        $data = $request->json()->all();
        $code = trim((string) ($data['code'] ?? ''));

        $dmy = $this->realDmy();

        if (! MobilePresence::enabled()) {
            return $this->fail(503, 'qr_disabled', 'تأیید با QR روی این سرور فعال نیست.');
        }

        if ($code === '') {
            return $this->fail(422, 'qr_required', 'کدی خوانده نشد؛ دوباره QR را در قاب بگیرید.');
        }

        $result = MobilePresence::verify($code, $user->id, time());

        if ($result['status'] === 'foreign') {
            return $this->fail(422, 'qr_foreign', 'این کد مالِ کارمند دیگری است؛ QR خودت را اسکن کن.');
        }

        if ($result['status'] === 'expired') {
            return $this->fail(422, 'qr_expired', 'این کد منقضی شده است؛ صفحهٔ پنل را نگاه کن و دوباره اسکن کن.');
        }

        if ($result['status'] !== 'ok') {
            return $this->fail(422, 'qr_invalid', 'این کد معتبر نیست؛ دوباره از روی صفحهٔ پنل اسکن کن.');
        }

        try {
            MobilePresence::confirm(
                $user->id,
                $dmy,
                MobilePresence::METHOD_QR,
                $result['window'],
                $request->ip()
            );
        } catch (\Throwable $error) {
            return $this->fail(500, 'qr_confirm_failed', 'ثبت تأیید انجام نشد؛ دوباره تلاش کنید.');
        }

        return response()->json([
            'confirmed' => true,
            'qr' => MobilePresence::state($user->id, $dmy),
            'employee' => $this->employee($user),
        ]);
    }

    /**
     * «کارتِ من را روی صفحهٔ پنل بزرگ نشان بده» — `POST /api/v1/qr/spotlight`.
     *
     * کارمند که «اسکن QR کارتِ من» را می‌زند، اسکنر باز می‌شود و حالا باید
     * کارتِ خودش را روی صفحهٔ دفتر پیدا کند؛ روی صفحه‌ای با سی کارت و کدِ
     * چرخانِ ۳۰ ثانیه‌ای، همین پیدا کردن وقت‌گیر است. اپ اینجا خبر می‌دهد و
     * سرور به هابِ پنل می‌گوید همان کارت را بزرگ و روشن کند.
     *
     * چرا این مسیر بی‌خطر است: هیچ کدی برنمی‌گرداند و هیچ دادهٔ شخصی نمی‌فرستد؛
     * فقط «کارتِ این شناسه» را می‌گوید و شناسه هم از توکنِ خودِ کارمند می‌آید
     * (نه از بدنهٔ درخواست)، پس کسی نمی‌تواند کارتِ دیگری را روی صفحه‌ها بالا
     * بیاورد. این مسیر کاملاً «بهترین تلاش» است: اگر هاب نباشد یا خاموش باشد،
     * جواب `sent: false` می‌آید و کارمند همان‌طور معمول QR را اسکن می‌کند.
     *
     * همین مسیر وقتی اسکنر **بسته** می‌شود هم می‌خورد: با `state: close`
     * پیامِ «جمع کن» می‌رود تا پنل کارت را همان لحظه به حالتِ عادی برگرداند،
     * نه ۴۵ ثانیه بعد. نیامدنِ `state` یا هر مقدارِ دیگر یعنی «باز کردن».
     */
    public function qrSpotlight(Request $request)
    {
        $user = $request->attributes->get('mobile_user');

        $close = $request->input('state') === 'close';

        return response()->json([
            'sent' => $close ? TimerHub::blur($user->id) : TimerHub::spotlight($user->id),
        ]);
    }

    private function fail($status, $code, $message)
    {
        return response()->json(['error' => $code, 'message' => $message], $status);
    }
}
