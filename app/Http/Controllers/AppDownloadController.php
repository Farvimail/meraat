<?php

namespace App\Http\Controllers;

/**
 * صفحهٔ دانلودِ اپلیکیشن و تحویلِ فایلِ نصبی.
 *
 * دو مسیر دارد:
 *   GET /app          → صفحهٔ راهنما + QRِ لینکِ دانلود + مراحلِ نصب و استفاده
 *   GET /app/download → خودِ فایلِ APK
 *
 * چرا فایل از مسیرِ استاتیک (`public/apk/…`) تحویل می‌شود و نه از PHP: فایل
 * حدود ۵۰ مگابایت است و رد کردنش از FPM یعنی خواندن و بافرکردنِ ۵۰ مگابایت
 * در هر دانلود، روی سروری که حافظه‌اش کم است. nginx همان فایل را مستقیم
 * می‌فرستد؛ این کنترلر فقط مسیرِ درست را پیدا می‌کند و اگر فایل نبود، به
 * صفحهٔ راهنما برمی‌گردد تا کاربر صفحهٔ ۴۰۴ِ خالی نبیند.
 *
 * صفحه عمداً بدونِ نشست است: کارمندی که برای اولین بار می‌خواهد اپ را نصب
 * کند هنوز هیچ حسابی روی گوشی‌اش ندارد و باید از همین‌جا شروع کند.
 */
class AppDownloadController extends Controller
{
    /**
     * کمتر از این حجم یعنی فایلِ نیمه‌کاره یا اشتباهی — نه یک APK.
     *
     * چرا لازم است: یک بار فایلِ در حالِ آپلود با همان نامِ نهایی روی سرور
     * بود و صفحه آن را «آماده» حساب کرد؛ دانلودِ نصفهٔ APK بدتر از پیامِ
     * «هنوز آماده نیست» است.
     */
    const MIN_BYTES = 1048576;

    /** اثرِ انگشتِ یک ZIP/APK سالم در انتهای فایل (End of Central Directory). */
    const ZIP_END = "PK\x05\x06";

    /** صفحهٔ راهنمای نصب و QRِ لینک. */
    public function page()
    {
        $apk = $this->apk();

        return view('app-download', [
            'downloadUrl' => $this->downloadUrl(),
            'available' => $apk !== null || $this->externalUrl() !== '',
            'fileName' => $apk === null ? 'Meraat.apk' : basename($apk),
            'fileSize' => $apk === null ? null : $this->humanSize(filesize($apk)),
            'updatedAt' => $apk === null ? null : FunctionsController::jdate(filemtime($apk)),
            'version' => (string) config('services.mobile.app.version', '1.0.0'),
        ]);
    }

    /** خودِ فایل — با تغییرمسیر به نسخهٔ استاتیک تا nginx آن را بفرستد. */
    public function download()
    {
        $apk = $this->apk();

        if ($apk === null) {
            // اگر لینکِ خارجی تنظیم شده باشد، همان مقصد است؛ وگرنه برگرد به
            // صفحهٔ راهنما تا کاربر صفحهٔ ۴۰۴ِ خالی نبیند.
            $external = $this->externalUrl();

            if ($external !== '') {
                return redirect()->away($external);
            }

            return redirect('app')->with('error', 'فایل نصبی هنوز روی سرور گذاشته نشده است؛ با مدیر تماس بگیرید.');
        }

        return redirect($this->publicUrl($apk));
    }

    /**
     * نشانی‌ای که در صفحه و داخلِ QR می‌نشیند.
     *
     * اگر `MOBILE_APP_DOWNLOAD_URL` تنظیم شده باشد، همان حاکم است (مثلاً
     * فایل روی یک هاستِ دانلود یا بازار/مایکت باشد)؛ وگرنه مسیرِ خودِ سرور.
     */
    private function downloadUrl()
    {
        $external = $this->externalUrl();

        return $external !== '' ? $external : url('app/download');
    }

    /** لینکِ دانلودِ خارجی از تنظیمات، یا رشتهٔ خالی. */
    private function externalUrl()
    {
        return trim((string) config('services.mobile.app.download_url', ''));
    }

    /**
     * تحویلِ فایل از خودِ PHP — فقط وقتی که فایل بیرون از `public/` باشد.
     *
     * حالتِ عادی اینجا نمی‌رسد: فایل در `public/apk` است و nginx خودش
     * می‌فرستد. این مسیر برای وقتی است که کسی `MOBILE_APK_PATH` را به مسیری
     * بیرون از درختِ وب ببرد؛ آن‌وقت تنها راهِ تحویل، همین است.
     */
    public function stream()
    {
        $apk = $this->apk();

        if ($apk === null) {
            return redirect('app')->with('error', 'فایل نصبی هنوز روی سرور گذاشته نشده است؛ با مدیر تماس بگیرید.');
        }

        return response()->download($apk, 'Meraat.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
        ]);
    }

    /**
     * مسیرِ فایلِ نصبی، یا `null` اگر روی این سرور نیست.
     *
     * `realpath` لازم است: با یک مسیرِ نسبی یا نامعتبر، `file_exists` می‌تواند
     * به فایلِ دیگری برسد و `redirect` هم مسیرِ عجیب بسازد.
     */
    private function apk()
    {
        $path = (string) config('services.mobile.app.apk', '');

        if ($path === '' || ! is_file($path) || ! $this->looksComplete($path)) {
            return null;
        }

        return realpath($path) ?: null;
    }

    /**
     * آیا این فایل یک APKِ کامل است، یا آپلودِ نصفه‌کاره؟
     *
     * دو نشانه: حجمِ معقول، شروع با هدرِ محلیِ ZIP و — مهم‌تر — وجودِ
     * «فهرستِ مرکزی» در انتهای فایل. یک آپلودِ قطع‌شده که فقط بخشی از
     * ابتدای فایل را نوشته، آن نشانهٔ انتهایی را ندارد؛ پس فایلِ نصفه هرگز
     * به کاربر تحویل داده نمی‌شود، حتی اگر حجمش از سقفِ کمینه بگذرد.
     */
    private function looksComplete($path)
    {
        $size = @filesize($path);

        if ($size === false || $size < self::MIN_BYTES) {
            return false;
        }

        $handle = @fopen($path, 'rb');

        if (! $handle) {
            return false;
        }

        $head = (string) fread($handle, 4);
        @fseek($handle, -65557, SEEK_END);
        $tail = (string) fread($handle, 65557);
        fclose($handle);

        return $head === "PK\x03\x04" && strpos($tail, self::ZIP_END) !== false;
    }

    /**
     * نشانیِ عمومیِ فایل.
     *
     * اگر فایل از قبل داخلِ `public/` باشد، همان مسیرِ نسبی کافی است. مسیرِ
     * بیرونی (بایندِ داکر) هم در همین پوشه دیده می‌شود، پس در هر دو حالت
     * `/apk/<نام فایل>` جواب می‌دهد.
     */
    private function publicUrl($apk)
    {
        $publicRoot = realpath(public_path()) ?: public_path();
        $relative = ltrim(str_replace('\\', '/', substr($apk, strlen($publicRoot))), '/');

        // فایل بیرونِ public است (مثلاً مسیرِ سفارشیِ MOBILE_APK_PATH)؛
        // ناچار از خودِ PHP رد می‌شود تا لینک همچنان کار کند.
        if ($relative === '' || strpos($apk, $publicRoot) !== 0) {
            return url('app/stream');
        }

        return url($relative);
    }

    /** حجمِ خوانا برای نمایش («۵۳٫۴ مگابایت»). */
    private function humanSize($bytes)
    {
        $bytes = (int) $bytes;

        if ($bytes >= 1048576) {
            return FunctionsController::e2p(number_format($bytes / 1048576, 1)) . ' مگابایت';
        }

        if ($bytes >= 1024) {
            return FunctionsController::e2p(number_format($bytes / 1024, 0)) . ' کیلوبایت';
        }

        return FunctionsController::e2p($bytes) . ' بایت';
    }
}
