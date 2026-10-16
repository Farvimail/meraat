<?php

namespace App\Http\Middleware;

use App\User;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * احراز هویت اپ موبایل با توکن bearer.
 *
 * چرا middleware جدا: گاردِ `auth:api` لاراول ۵.۶ برای این کار مناسب نیست،
 * چون توکن‌ها در جدول `users.api_token` نگه داشته می‌شوند و «قید دستگاه» را
 * نمی‌فهمد. اینجا توکن با `sha256` در `tbl_mobile_token` جست‌وجو می‌شود،
 * پس اگر دیتابیس لو برود، توکنِ قابل استفاده‌ای بیرون نمی‌آید.
 *
 * بعد از موفقیت، این‌ها روی request می‌نشینند:
 *   attributes: mobile_user  → ردیف users
 *   attributes: mobile_token → ردیف tbl_mobile_token
 *   attributes: mobile_device→ ردیف tbl_mobile_device
 */
class MobileTokenAuth
{
    public function handle($request, Closure $next)
    {
        $token = $this->bearerToken($request);

        if ($token === null) {
            return $this->unauthorized('توکن ارسال نشده است.');
        }

        $row = DB::table('tbl_mobile_token')
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('revoked_at')
            ->first();

        if (empty($row)) {
            return $this->unauthorized('نشست منقضی شده است. دوباره وارد شوید.');
        }

        $device = DB::table('tbl_mobile_device')
            ->where('device_id', $row->device_id)
            ->whereNull('released_at')
            ->first();

        if (empty($device) || (int) $device->customer_id !== (int) $row->customer_id) {
            return $this->unauthorized('این گوشی دیگر به حساب شما بسته نیست.');
        }

        $user = User::query()
            ->where('id', $row->customer_id)
            ->whereNull('archived_at')
            ->first();

        if (empty($user)) {
            return $this->unauthorized('حساب کاربری در دسترس نیست.');
        }

        $ip = $request->ip();
        $now = date('Y-m-d H:i:s');

        // آخرین بازدیدها؛ سبک نگه داشته شده چون روی هر درخواست اجرا می‌شود.
        DB::table('tbl_mobile_token')->where('id', $row->id)->update(['last_used_at' => $now]);
        DB::table('tbl_mobile_device')->where('id', $device->id)->update([
            'last_seen_at' => $now,
            'last_ip' => $ip,
        ]);

        $request->attributes->set('mobile_user', $user);
        $request->attributes->set('mobile_token', $row);
        $request->attributes->set('mobile_device', $device);

        return $next($request);
    }

    /**
     * توکن را از هدر `Authorization: Bearer …` می‌خواند.
     *
     * بعضی سرورها/پروکسی‌ها هدر Authorization را عوض می‌کنند (مثلاً
     * `HTTP_AUTHORIZATION` یا `REDIRECT_HTTP_AUTHORIZATION`)، پس هر سه حالت
     * بررسی می‌شود.
     *
     * @return string|null
     */
    private function bearerToken($request)
    {
        $header = $request->header('Authorization');

        if (empty($header)) {
            foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $key) {
                if (!empty($_SERVER[$key])) {
                    $header = $_SERVER[$key];
                    break;
                }
            }
        }

        if (!is_string($header) || stripos($header, 'Bearer ') !== 0) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }

    private function unauthorized($message)
    {
        return response()->json([
            'error' => 'unauthenticated',
            'message' => $message,
        ], 401);
    }
}
