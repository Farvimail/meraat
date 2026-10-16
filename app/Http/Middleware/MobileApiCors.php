<?php

namespace App\Http\Middleware;

use Closure;

/**
 * CORS فقط برای مسیرهای `/api/`.
 *
 * اپ موبایل روی گوشی با CORS کاری ندارد، ولی وقتی همان اپ در مرورگر (نسخهٔ
 * وب Expo یا تست دستی) باز شود، مرورگر برای درخواست‌های `POST` با
 * `Content-Type: application/json` اول یک درخواست `OPTIONS` می‌فرستد. اگر آن
 * جواب نگیرد، درخواست اصلی هرگز فرستاده نمی‌شود.
 *
 * عمداً سراسری ثبت شده: لاراول درخواست `OPTIONS` را هنگام مسیریابی رد می‌کند
 * (۴۰۵) و middleware چسبیده به مسیر اصلاً اجرا نمی‌شود؛ پس باید پیش از
 * مسیریابی و فقط برای مسیرهای API پاسخ بگیرد.
 *
 * پنل وب دست‌نخورده می‌ماند: هیچ هدری به مسیرهای غیرِ `/api/` اضافه نمی‌شود.
 * CORS اینجا مرزِ امنیتی نیست — احراز هویت با توکن bearer در هدر انجام
 * می‌شود، نه با کوکی.
 */
class MobileApiCors
{
    public function handle($request, Closure $next)
    {
        if (!$this->isApiRequest($request)) {
            return $next($request);
        }

        $headers = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type, Accept, X-Agent-Key',
            // `DELETE` برای حذفِ عکس پروفایل لازم است: نسخهٔ وبِ اپ در
            // مرورگر اجرا می‌شود و مرورگر پیش از `DELETE` یک `OPTIONS`
            // می‌فرستد؛ اگر متد در این فهرست نباشد، خودِ درخواست هرگز نمی‌رود.
            'Access-Control-Allow-Methods' => 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Max-Age' => '86400',
        ];

        if ($request->getMethod() === 'OPTIONS') {
            return response('', 204, $headers);
        }

        $response = $next($request);

        foreach ($headers as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }

    private function isApiRequest($request)
    {
        return strpos(ltrim($request->path(), '/'), 'api/') === 0;
    }
}
