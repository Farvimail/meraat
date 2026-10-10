<?php

namespace App\Http\Middleware;

use App\Http\Controllers\FunctionsController;
use Closure;

/**
 * «کارهای حساس در ماه فعال‌شده».
 *
 * وقتی مدیر از نوار بالا یک تاریخ غیر از امروز واقعی را فعال کرده باشد، سامانه
 * آن روز را «امروز» می‌بیند. کارهایی مثل بکاپ‌گیری دستی به هیچ ماهی وابسته
 * نیستند و اگر همین‌طوری اجرا شوند، اشتباهی روی ماه فعال انجام می‌شوند و
 * مدیر فکر می‌کند روی ماه جاری کار کرده است.
 *
 * این میدل‌ور همان کارها را با یک پیام روشن متوقف می‌کند و مدیر را به
 * «بازگشت به امروز» راهنمایی می‌کند. عمداً فقط روی مسیرهای حساس می‌نشیند تا
 * ویرایش‌های همان ماه فعال (که هدف اصلی این قابلیت است) باز بمانند.
 */
class BlockOnPastMonth
{
    /**
     * @param  \Illuminate\Http\Request $request
     * @param  \Closure $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        if (!FunctionsController::isOffRealToday()) {
            return $next($request);
        }

        $message = 'تاریخ فعال سامانه «' . FunctionsController::systemDateJalali() . '» است و با امروز واقعی ('
            . FunctionsController::e2p(substr(FunctionsController::jdate(time()), 0, 10))
            . ') فرق می‌کند؛ این کار کلی است و روی ماه فعال انجام نمی‌شود. '
            . 'برای انجامش از نوار بالا «بازگشت به امروز» را بزنید و بعد تکرار کنید.';

        if ($request->expectsJson()) {
            return response()->json(['error' => $message], 409);
        }

        return redirect()->back()->with('error', $message);
    }
}
