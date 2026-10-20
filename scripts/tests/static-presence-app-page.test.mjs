/*
  «کدِ ثابت + صفحهٔ دانلود اپ + تغییر رمزِ مدیر» — بررسیِ سیم‌کشی، بدونِ سرور
  و بدونِ مرورگر.

  چرا این تست لازم است: این تغییر سه قاعدهٔ قبلی را برمی‌گرداند و هر کدام
  می‌تواند بی‌صدا برگردد:

    ۱) کدِ QR دیگر چرخان نیست. اگر کسی دوباره `windowAt`/پنجرهٔ زمانی را
       برگرداند، کارمند دوباره باید در برابرِ صفحه بایستد و عکسِ کد هم بی‌فایده
       می‌شود — همان چیزی که صاحبِ کار عمداً کنار گذاشت.
    ۲) کدها باید **بدونِ نشستِ مدیر** در دسترس باشند (کارتِ صفحهٔ اصلی)، ولی
       وضعیتِ تأییدِ امروز و ثبتِ دستیِ مدیر نباید بی‌نشست در دسترس باشند.
    ۳) دکمهٔ «پنل مدیریت» و «خروج» از هدرِ صفحهٔ اصلی رفته‌اند و جایش دکمهٔ اپ
       آمده؛ صفحهٔ /app باید QRِ لینکِ دانلود و راهنمای نصب را داشته باشد و
       مدیر از /manager/login بتواند رمزِ خودش را عوض کند.

  اجرا:  node scripts/tests/static-presence-app-page.test.mjs
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, path), 'utf8');

const presence = read('../../app/MobilePresence.php');
const qrController = read('../../app/Http/Controllers/PresenceQrController.php');
const downloadController = read('../../app/Http/Controllers/AppDownloadController.php');
const accountController = read('../../app/Http/Controllers/ManagerAccountController.php');
const panelQr = read('../../public/js/panel-qr.js');
const routes = read('../../routes/web.php');
const attendance = read('../../resources/views/layouts/attendance.blade.php');
const panelLayout = read('../../resources/views/layouts/panel.blade.php');
const downloadView = read('../../resources/views/app-download.blade.php');
const accountView = read('../../resources/views/manager-account.blade.php');
const services = read('../../config/services.php');
const nginx = read('../../docker/nginx/prod.conf.template');
const panelCss = read('../../public/css/panel.css');

/** بدنهٔ یک متد را از `function name` تا متدِ بعدی برمی‌گرداند. */
function body(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.ok(start >= 0, `متدِ ${name} پیدا نشد`);

  const ends = ['\n    public ', '\n    private ', '\n    protected ']
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index > start);

  return source.slice(start, ends.length ? Math.min(...ends) : source.length);
}

// ------------------------------------------------------------ کدِ ثابت

test('کدِ QR ثابت است و پنجرهٔ زمانی ندارد', () => {
  assert.match(presence, /const STATIC_WINDOW = 0;/, 'پنجرهٔ صفر باید ثابتِ کد باشد');
  assert.doesNotMatch(presence, /function windowAt\(/, 'محاسبهٔ پنجره باید رفته باشد');
  assert.doesNotMatch(presence, /function secondsLeft\(/, 'شمارشِ ثانیه‌های انقضا باید رفته باشد');

  const codeFor = body(presence, 'codeFor');

  assert.match(codeFor, /STATIC_WINDOW/, 'کد باید با پنجرهٔ ثابت ساخته شود');
  assert.doesNotMatch(codeFor, /\$window\b/, 'codeFor نباید ورودیِ پنجره بگیرد');
});

test('کدِ هر کارمند یکتاست و کدِ چرخانِ قدیمی رد می‌شود', () => {
  const verify = body(presence, 'verify');

  assert.match(
    verify,
    /\$window !== self::STATIC_WINDOW/,
    'فقط پنجرهٔ صفر (کدِ ثابت) پذیرفته شود',
  );
  assert.match(verify, /hash_equals\(\$expected, \$mac\)/, 'امضا باید با hash_equals سنجیده شود');
  assert.match(verify, /'foreign'/, 'کدِ همکار باید foreign باشد');
  assert.doesNotMatch(verify, /'expired'/, 'کدِ ثابت دیگر منقضی نمی‌شود');
});

test('پاسخِ دسته‌ای حالت را static اعلام می‌کند و انقضا ندارد', () => {
  const codesFor = body(presence, 'codesFor');

  assert.match(codesFor, /'mode' => 'static'/, 'کلاینت باید بداند کد ثابت است');
  assert.doesNotMatch(codesFor, /expires_in/, 'کدِ ثابت expires_in ندارد');
  assert.doesNotMatch(codesFor, /windowAt|secondsLeft/, 'هیچ محاسبهٔ زمانی نمانده باشد');
});

// ---------------------------------------------- دسترسیِ عمومی به کدها

test('کدها بدونِ نشست می‌آیند، ولی وضعیتِ تأیید و ثبتِ دستی پشتِ نشست‌اند', () => {
  const codes = body(qrController, 'codes');

  assert.doesNotMatch(
    codes,
    /unauthenticated|panelUser\(\)\)\s*\{\s*\n\s*return response\(\)->json\(\['error' => 'unauthenticated'\]/,
    'codes نباید بی‌نشست‌ها را رد کند',
  );
  assert.match(codes, /\[\'mode\'\]/, 'کدها باید mode را رد کنند');
  assert.match(
    codes,
    /if \(\$this->panelUser\(\)\) \{[\s\S]{0,400}'confirmed'/,
    'وضعیتِ تأیید فقط برای کاربرِ پنل در پاسخ بیاید',
  );

  const manual = body(qrController, 'manual');

  assert.match(manual, /panelUser\(\)/, 'ثبتِ دستیِ حضور باید پشتِ نشستِ مدیر بماند');
});

test('اسکریپتِ QR برای کدِ ثابت تازه‌سازیِ دوره‌ای نمی‌زند', () => {
  assert.match(panelQr, /data\.mode === 'static'/, 'حالتِ static باید شناخته شود');
  assert.match(
    panelQr,
    /polling = repeating && \(!staticMode \|\| !!data\.confirmed\)/,
    'صفحهٔ عمومیِ کدِ ثابت نباید وقت‌بندی بگیرد؛ فقط پنل برای وضعیتِ تأیید',
  );
  assert.match(panelQr, /paint: paint/, 'paint برای صفحهٔ دانلود لازم است');
});

// ------------------------------------------------------ صفحهٔ حضور

test('هدرِ صفحهٔ اصلی: دکمهٔ اپ هست، «پنل مدیریت» و «خروج» نیست', () => {
  // کامنت‌های بلید دربارهٔ همین حذف توضیح می‌دهند؛ نباید خودشان را گزارش
  // کنند. HTML باقی می‌ماند و همان سنجیده می‌شود.
  const markup = attendance.replace(/\{\{--[\s\S]*?--\}\}/g, '');

  assert.match(markup, /url\('app'\)/, 'دکمهٔ اپ باید در هدر باشد');
  assert.match(markup, /att-topbtn-app/, 'دکمهٔ اپ باید کلاسِ خودش را داشته باشد');
  assert.doesNotMatch(markup, /route\('logout'\)/, 'دکمهٔ خروج باید از هدر رفته باشد');
  assert.doesNotMatch(markup, /att-logout-form/, 'فرمِ خروجِ هدر باید رفته باشد');
  assert.doesNotMatch(markup, /پنل مدیریت/, 'دکمهٔ «پنل مدیریت» نباید در هدر باشد');
  assert.match(markup, /url\('manager\/login'\)/, 'مسیرِ ورودِ مدیر باید همان /manager/login باشد');
});

// --------------------------------------------------- صفحهٔ دانلود اپ

test('صفحهٔ /app QRِ لینکِ دانلود و راهنمای نصب و استفاده دارد', () => {
  assert.match(routes, /Route::get\('\/app', 'AppDownloadController@page'\)/, 'روتِ صفحهٔ دانلود لازم است');
  assert.match(routes, /Route::get\('\/app\/download', 'AppDownloadController@download'\)/, 'روتِ دانلود فایل لازم است');

  assert.match(downloadView, /data-app-qr/, 'بومِ QR باید در صفحه باشد');
  assert.match(downloadView, /\$downloadUrl/, 'آدرسِ لینک باید به QR داده شود');
  assert.match(downloadView, /href="\{\{ \$downloadUrl \}\}"/, 'دکمهٔ دانلود باید همان لینکِ داخلِ QR را بزند');
  assert.match(downloadView, /app-dl-step-list/, 'مراحلِ نصب باید فهرست شوند');
  assert.match(downloadView, /ایمیل و پسورد/, 'باید گفته شود ایمیل و پسورد را مدیر تعریف می‌کند');
  assert.match(downloadView, /آزاد کردن گوشی/, 'راهِ عوض‌کردن گوشی باید گفته شود');
  assert.match(downloadView, /تأییدِ حضور|QR/, 'باید نحوهٔ تأییدِ حضور توضیح داده شود');
  assert.match(downloadView, /MeraatPresenceQr/, 'QR با همان کدگذارِ محلیِ پنل ساخته شود');
});

test('متنِ دکمهٔ دانلود خوانا می‌ماند: قاعدهٔ رنگِ لینکِ پنل نباید آن را بپوشاند', () => {
  // قاعدهٔ `body.panel-page .panel-content a:not(...)` متنِ لینک‌ها را سبز می‌کند و
  // چون `:not()`‌ها قدرت تخصصی می‌دهند، از `.app-dl-btn` قوی‌تر است؛ بدونِ استثنا،
  // متنِ سفیدِ دکمه سبز می‌شد — سبز روی زمینهٔ سبزِ خودِ دکمه، ناخوانا.
  assert.match(
    panelCss,
    /a:not\(\.btn\):not\(\.nav-link\):not\(\.page-link\):not\(\.app-dl-btn\)/,
    'دکمهٔ دانلود باید از قاعدهٔ رنگِ لینکِ پنل استثنا شده باشد',
  );
  assert.match(
    panelCss,
    /\.app-dl-btn \{[\s\S]{0,300}color: #fff;/,
    'دکمه باید متنِ سفید داشته باشد',
  );
});

test('کنترلرِ دانلود فایلِ نبوده را به صفحهٔ راهنما برمی‌گرداند، نه ۴۰۴', () => {
  assert.match(downloadController, /function page\(/, 'صفحهٔ راهنما لازم است');
  assert.match(downloadController, /function download\(/, 'تحویلِ فایل لازم است');
  assert.match(downloadController, /is_file\(\$path\)/, 'وجودِ فایل باید سنجیده شود');
  assert.match(
    downloadController,
    /redirect\('app'\)->with\('error'/,
    'فایلِ نبوده باید پیام بدهد، نه صفحهٔ خطای خالی',
  );
  assert.match(services, /'apk' => env\('MOBILE_APK_PATH'/, 'مسیرِ APK باید قابلِ تنظیم باشد');
  assert.match(downloadController, /const MIN_BYTES = \d+;/, 'فایلِ نیمه‌کاره نباید «آماده» حساب شود');
  assert.match(downloadController, /function looksComplete\(/, 'یک بررسیِ کامل‌بودنِ فایل لازم است');
  assert.match(
    downloadController,
    /ZIP_END|PK\\x05\\x06/,
    'آپلودِ نصفه باید از نبودِ فهرستِ مرکزیِ ZIP شناخته شود، نه فقط از حجم',
  );
  assert.match(
    downloadController,
    /MOBILE_APP_DOWNLOAD_URL|download_url/,
    'باید بتوان لینکِ دانلود را به هاستِ دیگری برد',
  );
  assert.match(services, /'download_url' => env\('MOBILE_APP_DOWNLOAD_URL'\)/);
});

test('اسکنِ QR باید دانلود را خودش شروع کند: نشانیِ دانلود فایل را مستقیم می‌فرستد', () => {
  // ریدایرکتِ ۳۰۲ سمتِ سرور را خیلی از اپ‌های دوربین و اسکرِ QR دنبال نمی‌کنند:
  // کاربر می‌رود روی نشانی و هیچ دانلودی نمی‌بیند. پس خودِ نشانی باید فایل باشد.
  assert.match(nginx, /location = \/app\/download \{/, 'نشانیِ داخلِ QR باید locationِ جدا داشته باشد');
  assert.match(nginx, /rewrite \^ \/apk\/Meraat\.apk last;/, 'باید بدونِ ریدایرکتِ ۳۰۲ به فایل برسد');
  assert.match(
    nginx,
    /add_header Content-Disposition "attachment; filename=Meraat\.apk";/,
    'دانلود باید پیوست باشد تا مرورگر فایل را باز نکند',
  );
  assert.match(
    nginx,
    /application\/vnd\.android\.package-archive/,
    'MIMEِ درستِ APK لازم است تا مرورگرِ موبایل دانلود کند',
  );
  assert.match(
    nginx,
    /error_page 404 = @apk_missing;/,
    'فایلِ نبوده باید از مسیرِ ریدایرکتِ بیرونی به صفحهٔ راهنما برود، نه ۴۰۴ِ خالی',
  );
  assert.match(
    nginx,
    /location @apk_missing \{[\s\S]{0,400}return 302 \/app;/,
    'ریدایرکتِ بیرونی به صفحهٔ راهنما لازم است (ریدایرکتِ داخلی ۴۰۴ِ لاراول را برمی‌گرداند)',
  );
  assert.match(
    nginx,
    /location @apk_missing \{[\s\S]{0,400}absolute_redirect off;/,
    'ریدایرکت باید نسبی باشد تا پشتِ TLS-ترمینال httpِ مطلق نسازد',
  );
  assert.doesNotMatch(nginx, /expires 30d;[\s\S]{0,200}\.apk/, 'APK نباید کشِ بلند بگیرد تا نسخهٔ تازه همیشه برسد');
});

// -------------------------------------------------- تغییر رمزِ مدیر

test('/manager/login و صفحهٔ تغییر رمزِ مدیر وصل‌اند', () => {
  assert.match(
    routes,
    /Route::get\('\/manager\/login', 'Auth\\LoginController@showManagerLoginForm'\)/,
    'فرمِ ورودِ مدیر باید روی /manager/login هم باشد',
  );
  assert.match(routes, /Route::post\('\/manager\/login'/, 'پستِ همان فرم لازم است');
  assert.match(
    routes,
    /Route::get\('\/manager\/password', 'ManagerAccountController@edit'\)/,
    'صفحهٔ تغییر رمز لازم است',
  );
  assert.match(
    routes,
    /Route::post\('\/manager\/password', 'ManagerAccountController@update'\)\s*\n?\s*->middleware\('auth:manager'\)/,
    'ذخیرهٔ رمز باید پشتِ گاردِ مدیر باشد',
  );
});

test('کنترلرِ رمز: رمزِ فعلی می‌سنجد و رمزِ تازه را هش می‌کند', () => {
  const update = body(accountController, 'update');

  assert.match(update, /\$this->validate\(\$request,/, 'در لاراول ۵٫۶ اعتبارسنجی از کنترلر صدا زده شود');
  assert.match(update, /'current_password' => 'required\|string'/, 'رمزِ فعلی الزامی است');
  assert.match(update, /'password' => 'required\|string\|min:6\|confirmed'/, 'رمزِ تازه با تکرار و حداقلِ ۶');
  assert.match(update, /Hash::check\(/, 'رمزِ فعلی باید با Hash::check سنجیده شود');
  assert.match(update, /Hash::make\(/, 'رمزِ تازه باید هش شود');
  assert.doesNotMatch(update, /'password' => \$request\['password'\]/, 'رمز هرگز خام ذخیره نشود');
  assert.match(update, /redirect\('manager\/login'\)/, 'بی‌نشست باید به فرمِ ورودِ مدیر برود، نه ورودِ مشتری');

  assert.match(accountController, /function edit\(/, 'فرمِ تغییر رمز لازم است');
});

test('فرمِ تغییر رمز و لینکِ پنل درست‌اند', () => {
  assert.match(accountView, /name="current_password"/, 'فیلدِ رمزِ فعلی');
  assert.match(accountView, /name="password"/, 'فیلدِ رمزِ تازه');
  assert.match(accountView, /name="password_confirmation"/, 'تکرارِ رمزِ تازه');
  assert.match(accountView, /url\('manager\/password'\)/, 'فرم باید به همان روت بفرستد');
  assert.match(accountView, /@csrf/, 'CSRF لازم است');
  assert.match(accountView, /\$errors->any\(\)/, 'خطاها باید دیده شوند');

  assert.match(
    panelLayout,
    /url\('manager\/password'\)/,
    'پنل باید لینکِ تغییر رمز را داشته باشد',
  );
  assert.match(
    panelLayout,
    /auth\('manager'\)->check\(\)[\s\S]{0,400}manager\/password/,
    'لینک فقط برای مدیر باشد، نه مدیر ارشد',
  );
});

console.log('✔ کدِ ثابت، صفحهٔ دانلودِ اپ و تغییر رمزِ مدیر به هم وصل‌اند');
