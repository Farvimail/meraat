<?php

namespace App\Http\Controllers;

use App\MobilePresence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * کدهای QR تأییدِ حضور — سمتِ **صفحهٔ حضور** (و پنل).
 *
 * چرا اینجا و نه در `MobileApiController`: آن کلاس با توکنِ گوشی کار می‌کند،
 * ولی این مسیر را مرورگر صدا می‌زند.
 *
 * **دسترسیِ بدونِ نشست:** کد دیگر چرخان نیست؛ هر کارمند یک کدِ ثابتِ مخصوصِ
 * خودش دارد و کارتِ او در صفحهٔ اصلیِ حضور برای همه (بدونِ ورودِ مدیر) دیده
 * می‌شود. پس `codes` عمداً نشست نمی‌خواهد — وگرنه کارمندی که مدیر پشتِ
 * سیستم نیست نمی‌توانست QR خودش را ببیند. چیزی که **نمی‌شود** بدونِ نشست
 * گرفت، وضعیتِ تأییدِ امروزِ کارمندهاست؛ آن بخش فقط برای کاربرِ پنل در پاسخ
 * می‌آید. ثبتِ تأییدِ دستی هم مثل قبل پشتِ نشست است.
 */
class PresenceQrController extends Controller
{
    /** سقفِ تعداد شناسه در یک درخواست — صفحهٔ همکاران بیش از این کارت ندارد. */
    const MAX_IDS = 200;

    /**
     * کدِ ثابتِ هر کارمند (+ وضعیتِ تأییدِ امروز فقط برای کاربرِ پنل).
     *
     * خروجی برای مرورگرِ بدونِ نشست:
     *   {
     *     "mode": "static", "enabled": true, "required": true,
     *     "codes": {"12": "v1.12.0.abcdef0123456789"}
     *   }
     *
     * و برای کاربرِ پنل، علاوه بر آن:
     *     "confirmed": {"12": {"method": "qr", "at": "2026-10-16 10:30:00"}}
     *
     * `confirmed` یعنی «امروز تأییدی گرفته شد»، با زمانِ **آخرین** تأیید —
     * از وقتی هر ثبت تأییدِ خودش را دارد، ممکن است در یک روز چند ردیف باشد.
     * این بخش عمداً برای مرورگرِ بی‌نشست فرستاده نمی‌شود: کدِ ثابت عمومی است
     * (روی کارتِ همان صفحه نوشته شده) ولی اینکه چه کسی امروز تأیید کرده، نه.
     */
    public function codes(Request $request)
    {
        $ids = $this->ids($request);
        $payload = MobilePresence::codesFor($ids);

        $response = [
            'mode' => $payload['mode'],
            'enabled' => MobilePresence::enabled(),
            'required' => MobilePresence::required(),
            'codes' => $payload['codes'],
        ];

        // وضعیتِ تأیید فقط برای چشمِ مدیر.
        if ($this->panelUser()) {
            $confirmed = [];

            foreach (MobilePresence::rowsFor($ids, $this->todayDmy()) as $id => $row) {
                $confirmed[(string) $id] = [
                    'method' => (string) $row->method,
                    'at' => (string) $row->confirmed_at,
                ];
            }

            $response['confirmed'] = $confirmed;
        }

        return response()->json($response);
    }

    /**
     * ثبتِ تأییدِ دستیِ مدیر برای امروزِ یک کارمند.
     *
     * این همان ردیفی را می‌نویسد که تأییدِ QR می‌نویسد، فقط با
     * `method = manual` تا در گزارش‌ها معلوم باشد کدام تأیید با اسکن بوده و
     * کدام با دستِ مدیر (شفافیت برای بازبینی بعدی).
     *
     * هر کلیک **یک** تأییدِ مصرف‌نشده می‌سازد و همان یک ورود را باز می‌کند؛
     * مثلِ QR، نه «تأیید برای بقیهٔ امروز».
     */
    public function manual(Request $request)
    {
        if (! $this->panelUser()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $id = (int) $request->input('id');

        if ($id <= 0) {
            return response()->json(['error' => 'bad_request', 'message' => 'کارمند انتخاب نشده است.'], 422);
        }

        $dmy = $this->todayDmy();

        try {
            $row = MobilePresence::confirm($id, $dmy, MobilePresence::METHOD_MANUAL, null, $request->ip());
        } catch (\Throwable $error) {
            return response()->json([
                'error' => 'confirm_failed',
                'message' => 'ثبت تأیید انجام نشد؛ دوباره تلاش کنید.',
            ], 500);
        }

        return response()->json([
            'confirmed' => [
                'method' => (string) ($row->method ?? MobilePresence::METHOD_MANUAL),
                'at' => (string) ($row->confirmed_at ?? date('Y-m-d H:i:s')),
            ],
        ]);
    }

    /** شناسه‌های درخواست: هم آرایه و هم رشتهٔ جداشده با کاما پذیرفته می‌شود. */
    private function ids(Request $request)
    {
        $raw = $request->input('ids', []);

        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }

        if (! is_array($raw)) {
            return [];
        }

        $ids = [];

        foreach ($raw as $value) {
            $value = (int) $value;

            if ($value > 0 && ! in_array($value, $ids, true)) {
                $ids[] = $value;
            }

            if (count($ids) >= self::MAX_IDS) {
                break;
            }
        }

        return $ids;
    }

    /**
     * امروزِ واقعی به شکلِ `dmY` — همان قالبی که `MobileApiController` برای
     * `tbl_calendar.dmy` استفاده می‌کند، تا تأییدِ پنل و تأییدِ اپ روی یک
     * ردیف بیفتند.
     */
    private function todayDmy()
    {
        return date('dmY', strtotime(FunctionsController::realDate()));
    }

    /** کاربرِ پنل (میزکار یا مدیر ارشد) — یا `null`. */
    private function panelUser()
    {
        return Auth::guard('manager')->user() ?: Auth::guard('admin')->user();
    }
}
