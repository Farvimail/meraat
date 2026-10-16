<?php

use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| API Routes (اپ موبایل حضور)
|--------------------------------------------------------------------------
|
| این فایل با پیشوند `/api` بارگذاری می‌شود، پس همهٔ مسیرهای زیر در عمل
| `/api/v1/...` هستند. قرارداد کامل در `mobile/docs/API.md`.
|
| مسیرهای وب فعلی (`/present/start`، `/present/pause`) دست‌نخورده مانده‌اند:
| پنل به آن‌ها وابسته است. اما اپ هرگز از آن‌ها استفاده نمی‌کند، چون نه
| احراز هویت دارند، نه قید دستگاه، و با `GET` کار می‌کنند.
|
| نکتهٔ امنیتی: هیچ‌کدام از این مسیرها نشست/کوکی ندارند. توکن bearer در هدر
| می‌آید و `mobile.auth` آن را با `sha256` در `tbl_mobile_token` پیدا می‌کند.
*/

Route::prefix('v1')->group(function () {
    // ورود: با ایمیل و رمز پنل انجام می‌شود و گوشی را به کارمند می‌بندد.
    Route::post('login', 'MobileApiController@login');

    // ایجنتِ داخل شبکهٔ محل کار، آی‌پی خروجی را گزارش می‌کند (هدر X-Agent-Key).
    Route::post('office-ip', 'MobileApiController@officeIp');

    Route::middleware('mobile.auth')->group(function () {
        Route::post('logout', 'MobileApiController@logout');
        Route::get('me', 'MobileApiController@me');
        Route::get('today', 'MobileApiController@today');

        // «انگشتِ تغییرِ» امروزِ همین کارمند. همان کاری را می‌کند که
        // `/read/timer-revision` برای پنل می‌کند: پرسشِ پشتیبانِ سوکتِ زنده،
        // تا شروع/توقفِ زده‌شده از پنل همان لحظه روی گوشی هم دیده شود.
        Route::get('revision', 'MobileApiController@revision');
        Route::post('punch', 'MobileApiController@punch');
        Route::get('history', 'MobileApiController@history');

        // عکس پروفایل: از گالری یا دوربینِ گوشی، برش‌خورده و مربع.
        // همان جدولی را می‌نویسد که پنل وب می‌خواند، پس عکس هم در اپ و هم
        // در سایت دیده می‌شود؛ حذفش هم کارمند را به عکسِ پیش‌فرض برمی‌گرداند.
        Route::post('profile/photo', 'MobileApiController@uploadPhoto');
        Route::delete('profile/photo', 'MobileApiController@deletePhoto');

        // تأییدِ حضور با کدِ چرخانِ QR که پنل نشان می‌دهد. «اول ثبت، بعد
        // تأیید»: اپ پس از ورودِ موفق، اگر لازم بود، اسکنر را باز می‌کند.
        Route::post('qr/confirm', 'MobileApiController@qrConfirm');
    });
});

/*
| مسیر نمونهٔ خود لاراول که از قبل بود؛ دست‌نخورده ماند.
*/
Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});
