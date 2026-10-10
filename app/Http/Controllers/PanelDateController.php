<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * «تاریخ فعال سامانه».
 *
 * روی سرور نمی‌توان ساعت سیستم را عوض کرد تا مثل لوکال‌هاست داخل ماه‌های قبل
 * کار کرد. پس مدیر از نوار بالای پنل یک روز یا یک ماه را فعال می‌کند و همان
 * در نشست خودش ذخیره می‌شود. هرجایی که «امروز» خوانده می‌شد حالا از
 * FunctionsController::systemDmy() رد می‌شود، پس کل سامانه همان روز را
 * امروز می‌بیند.
 */
class PanelDateController extends Controller
{
    const SYSTEM_DATE_KEY = FunctionsController::SYSTEM_DATE_KEY;

    /**
     * فعال کردن یک تاریخ یا یک ماه از تقویم سامانه.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\RedirectResponse
     */
    public function set(Request $request)
    {
        $date    = $request->input('date');
        $package = $request->input('package');

        if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = null;
        }

        // اگر روز دقیقی انتخاب نشده باشد، اولین روز ماه انتخاب‌شده فعال می‌شود.
        if ($date === null && $package !== null && $package !== '') {
            $date = CalendarController::firstDayOfPackage($package);
        }

        if ($date === null) {
            return back()->with('error', 'تاریخ یا ماه انتخاب‌شده معتبر نبود.');
        }

        // فقط تاریخی فعال می‌شود که در تقویم سامانه ردیف داشته باشد؛ وگرنه
        // جای دیگر سامانه که «بستهٔ امروز» را می‌خواند به ردیف خالی می‌خورد.
        if (CalendarController::packageOfDate($date) === null) {
            return back()->with('error', 'برای این تاریخ در تقویم سامانه ردیفی ثبت نشده؛ یک ماه از فهرست یا روزی دیگر را انتخاب کنید.');
        }

        $request->session()->put(self::SYSTEM_DATE_KEY, $date);

        return back()->with('status', 'تاریخ فعال سامانه روی '
            . FunctionsController::e2p(FunctionsController::jdate(strtotime($date)))
            . ' تنظیم شد؛ تا وقتی این تاریخ فعال است، ویرایش‌ها روی همان ماه ثبت می‌شود.');
    }

    /**
     * برگشتن به امروز واقعی.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\RedirectResponse
     */
    public function reset(Request $request)
    {
        $request->session()->forget(self::SYSTEM_DATE_KEY);

        return back()->with('status', 'تاریخ سامانه به امروز واقعی ('
            . FunctionsController::e2p(FunctionsController::jdate(time()))
            . ') برگشت.');
    }
}
