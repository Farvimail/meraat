<?php

namespace App\Http\Controllers;

use App\MobilePresence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * کدهای QR تأییدِ حضور — سمتِ **پنل** (نشستِ مدیر/مدیر ارشد).
 *
 * چرا اینجا و نه در `MobileApiController`: آن کلاس با توکنِ گوشی کار می‌کند،
 * ولی این مسیرها را مرورگرِ پنل صدا می‌زند؛ پس همان احراز هویتِ نشستِ پنل
 * لازم است. اگر اینها در API باز بودند، هر کسی می‌توانست کدِ چرخانِ یک
 * کارمند را از راه دور بگیرد و تأییدِ حضور را بی‌آنکه در محل کار باشد
 * جعل کند — یعنی کل خاصیتِ «در برابرِ صفحه بودن».
 *
 * دو کار: دادنِ کدِ لحظه‌ایِ همهٔ کارمندهای یک صفحه در یک پاسخ، و ثبتِ
 * تأییدِ دستیِ مدیر (راهِ فراری که تصمیم گرفته شد: دوربینِ خراب نباید کارمند
 * را پشتِ در نگه دارد).
 */
class PresenceQrController extends Controller
{
    /** سقفِ تعداد شناسه در یک درخواست — صفحهٔ همکاران بیش از این کارت ندارد. */
    const MAX_IDS = 200;

    /**
     * کدهای لحظه‌ای + وضعیتِ تأییدِ امروز.
     *
     * خروجی:
     *   {
     *     "window": 1234567, "expires_in": 17,
     *     "enabled": true, "required": true,
     *     "codes":     {"12": "v1.12.1234567.abcdef0123456789"},
     *     "confirmed": {"12": {"method": "qr", "at": "2026-10-16 10:30:00"}}
     *   }
     */
    public function codes(Request $request)
    {
        if (! $this->panelUser()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $ids = $this->ids($request);
        $dmy = $this->todayDmy();

        $payload = MobilePresence::codesFor($ids);
        $rows = MobilePresence::rowsFor($ids, $dmy);

        $confirmed = [];

        foreach ($rows as $id => $row) {
            $confirmed[(string) $id] = [
                'method' => (string) $row->method,
                'at' => (string) $row->confirmed_at,
            ];
        }

        return response()->json([
            'window' => $payload['window'],
            'expires_in' => $payload['expires_in'],
            'enabled' => MobilePresence::enabled(),
            'required' => MobilePresence::required(),
            'codes' => $payload['codes'],
            'confirmed' => $confirmed,
        ]);
    }

    /**
     * ثبتِ تأییدِ دستیِ مدیر برای امروزِ یک کارمند.
     *
     * این همان ردیفی را می‌نویسد که تأییدِ QR می‌نویسد، فقط با
     * `method = manual` تا در گزارش‌ها معلوم باشد کدام تأیید با اسکن بوده و
     * کدام با دستِ مدیر (شفافیت برای بازبینی بعدی).
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
