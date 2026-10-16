# قرارداد API اپ حضور — سمت سرور meraat

این سند قراردادِ مسیرهایی است که اپ با آن حرف می‌زند و دلیلِ هر تصمیم را می‌گوید.
سمتِ سرور پیاده شده است: مسیرها در `routes/api.php` و منطق در
`app/Http/Controllers/MobileApiController.php`؛ پس این سند مرجعی است برای این‌که
آن دو چه چیزی را باید رعایت کنند، نه فهرستِ کاری که مانده.

دو مسیرِ قدیمیِ `GET /present/start?id=` و `GET /present/pause?id=` دست‌نخورده
مانده‌اند چون پنل وب به آن‌ها وابسته است، ولی **برای اپ قابل استفاده نیستند**
(پایین توضیح داده شده).

## چرا نمی‌شود از مسیرهای فعلی استفاده کرد

```php
Route::get('/present/start', 'SavedTimeController@start');
Route::get('/present/pause', 'SavedTimeController@pause');
```

سه مشکل جدی:

1. **احراز هویت ندارد.** هر کسی با حدس زدن `id` می‌تواند برای هر کارمندی
   حضور بزند — حتی بدون حساب کاربری. (بخش «کارهای امنیتی» را ببینید.)
2. **`GET` است و پارامتر در URL.** با `GET` هیچ محافظت CSRF/هم‌مبدأیی وجود
   ندارد و آدرس‌ها لاگ می‌شوند.
3. **قید دستگاه ندارد.** هیچ راهی نیست بفهمیم درخواست از گوشی خودِ کارمند
   آمده یا از مرورگر همسایه.

اپ به `POST` + توکن + قید دستگاه نیاز دارد. مسیرهای وب فعلی دست‌نخورده
بمانند (پنل به آن‌ها وابسته است) و مسیرهای موبایل جدا اضافه شوند.

## شکل داده‌ای که باید حفظ شود

هر «زدن کارت» یک ردیف تازه در `tbl_saved_time` است، به‌علاوه یک ردیف پیوند در
`tbl_timer`:

```
tbl_saved_time(id, time 'H:i:s', start 0|1, pause 0|1, deleted, disabled)
tbl_timer(calendar_id, saved_time_id, national_code, customer_id, customer_email)
tbl_calendar(id, year, month, day, dmy, status, ...)
users(id, name, email, national_code, password, archived_at)
```

- `start=1, pause=0` → ورود
- `start=0, pause=1` → خروج
- `customer_id` = `users.id` (در این سامانه «customer» همان کارمند است)

## دو تلهٔ واقعی که باید رعایت شود

### ۱. امروزِ واقعی، نه «تاریخ فعال سامانه»

`SavedTimeController::todayDate()` و `TimerController::findToday()` هر دو
`FunctionsController::systemDmy()` را صدا می‌زنند و آن تابع **تاریخ override
مدیر** را برمی‌گرداند (وقتی مدیر از نوار بالای پنل روی ماه گذشته کار می‌کند).

برای ثبت حضور از گوشی این رفتار غلط است: اگر مدیر روی شهریور باشد، حضور امروز
در شهریور ثبت می‌شود. در API موبایل باید از تاریخ واقعی استفاده شود:

```php
FunctionsController::realDate();   // Y-m-d واقعی، مستقل از انتخاب مدیر
date('dmY', strtotime(FunctionsController::realDate()));   // dmy واقعی
```

### ۲. زمان فقط از سرور

`SavedTimeController::timeNow()` با offset ثابت `+03:30` کار می‌کند (ایران از
۲۰۲۲ ساعت تابستانی ندارد). اپ هیچ ساعتی را به‌عنوان زمان حضور نمی‌فرستد.
سرور همان الگو را برای موبایل هم استفاده کند:

```php
$time = date('H:i:s', (new DateTime('now', new DateTimeZone('+03:30')))->getTimestamp());
```

## احراز هویت

توکن bearer ساده؛ سامانهٔ Laravel 5.6 است و Sanctum ندارد. یک middleware کوچک
`App\Http\Middleware\MobileTokenAuth` که هدر `Authorization: Bearer <token>` را
بخواند، `hash('sha256', $token)` را در جدول توکن‌ها پیدا کند، منقضی/باطل‌شده
نباشد و `customer_id` را در request بگذارد.

هرگز توکن خام را ذخیره نکنید — فقط hash.

## جدول‌های تازه

```sql
CREATE TABLE `tbl_mobile_device` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,          -- users.id
  `device_id` char(36) NOT NULL,            -- UUID تولیدشده در اپ
  `device_secret_hash` char(64) NOT NULL,   -- sha256 راز دستگاه
  `device_name` varchar(100) DEFAULT NULL,
  `platform` varchar(20) DEFAULT NULL,
  `bound_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `last_ip` varchar(45) DEFAULT NULL,
  `released_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_device_id` (`device_id`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

CREATE TABLE `tbl_mobile_token` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `device_id` char(36) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- آی‌پی‌های خروجی محل کار؛ توسط ایجنت داخلی پر می‌شود (بخش قید شبکه)
CREATE TABLE `tbl_office_ip` (
  `ip` varchar(45) NOT NULL,
  `seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
```

قید «یک کارمند، یک گوشی» با `UNIQUE KEY uniq_device_id` روی `device_id` و
`released_at IS NULL` اعمال می‌شود: یک دستگاه فعال در لحظه فقط به یک کارمند.

## قید شبکهٔ محل کار

سرور باید `REMOTE_ADDR` را با `tbl_office_ip` مقایسه کند و فقط آی‌پی‌هایی را
بپذیرد که در N دقیقهٔ اخیر (پیشنهاد: ۳۰) گزارش شده‌اند. چون آی‌پی صندوق ثابت
نیست، یک ایجنت کوچک داخل شبکه هر ۱–۵ دقیقه آن را ثبت می‌کند:

```cron
*/2 * * * * curl -s -X POST -H "X-Agent-Key: <secret>" \
  -d "ip=$(curl -s https://api.ipify.org)" \
  https://meraat.piqagram.ir/api/v1/office-ip > /dev/null
```

- اگر اینترنت صندوق **CGNAT** باشد (`100.64.0.0/10`) این روش بی‌فایده است، چون
  همان آی‌پی با هزاران مشترک مشترک است. در آن حالت باید به‌جای آی‌پی، مجاورت
  اثبات شود (بیکن BLE یا QR چرخشی دم در) و سرور همان فیلد
  `proximity` را بررسی کند. (اپ فعلی این فیلد را ندارد؛ جای اضافه‌کردنش
  `PunchRequestBody` در `src/lib/api.ts` است.)

## مسیرها

همه زیر `/api/v1`، همه `POST` جز آن‌هایی که مشخص شده، همه `Content-Type: application/json`.

### `POST /api/v1/login`

```json
{ "email": "…", "password": "…",
  "device_id": "uuid", "device_name": "گوشی کارمند", "platform": "android" }
```

- `200` → `{ "token", "employee", "device", "today" }` (شکل پایین)
- `401 { "error": "invalid_credentials" }`
- `409 { "error": "device_already_bound", "message": "…" }` اگر `device_id`
  به کارمند دیگری بسته شده باشد (مدیر باید آزادش کند).
- `403 { "error": "outside_office_network" }` اگر ورود هم باید از شبکهٔ محل کار باشد.
- اگر همین کارمند قبلاً روی دستگاه فعال دیگری بسته شده، `device_id` جدید
  **جایگزین** نشود؛ خطا برگردد تا مدیر آزادسازی کند.

### `POST /api/v1/logout`

هدر توکن لازم. توکن را باطل کند (`revoked_at`). پاسخ `204` بدون بدنه.

### `GET /api/v1/me`

→ `{ "employee": {...}, "device": { "id", "bound_at" }, "server_time": {...} }`

### `GET /api/v1/today`

→

```json
{
  "dmy": 13102026,
  "punches": [ { "time": "08:15:00", "start": 1, "pause": 0 },
               { "time": "17:20:00", "start": 0, "pause": 1 } ],
  "server_time": { "iso": "2026-10-13T08:15:03+03:30", "dmy": 13102026, "clock": "08:15:03" }
}
```

`punches` فقط ردیف‌های **امروزِ واقعی** و **همین کارمند** و
`tbl_saved_time.deleted = 0` باشد، مرتب بر اساس `tbl_saved_time.id` صعودی.
`start`/`pause` را عدد برگردانید (نه رشته).

### `GET /api/v1/revision`

→ `{ "revision": "3:941:2026-10-17 09:12:00", "dmy": 17102026, "server_time": {...} }`

«انگشتِ تغییرِ» امروزِ همین کارمند، برای تایمرِ زندهٔ اپ. رشتهٔ
`revision` = `تعداد رکوردها : آخرین شناسه : زمانِ تأییدِ حضور` (وقتی تأییدی
نیست، قسمتِ سوم `-` است). اپ این را دورهای میپرسد و **فقط وقتی عوض شد**
`today` را کامل میگیرد؛ بدونِ آن، هر گوشی هر چند ثانیه یک پاسخِ کامل می‌گرفت.

کارِ اصلیِ زنده‌سازیِ اپ سوکتِ هاب است (`wss://<دامنه>/ws?ids=<کارمند>`، همان
کانالی که پنل استفاده می‌کند و `/read/timer-revision` را برای پنل بی‌نیاز کرده)؛
این مسیر پشتیبانِ آن است برای وقتی که سوکت وصل نمی‌شود. سه جزءِ رشته هر سه
لازم است: ثبتِ تازه، ویرایش/حذفِ رکورد (شناسه عوض می‌شود) و تأییدِ **دستیِ**
مدیر از پنل (مُهرِ زمانی).

### `POST /api/v1/punch`

```json
{ "device_id": "uuid", "intent": "start",
  "biometric_verified_at": 1760342103000, "biometric_kind": "fingerprint" }
```

قواعد سرور:

1. دستگاه باید همان دستگاه بسته‌شده به این کارمند باشد → وگرنه
   `403 { "error": "device_mismatch" }`.
2. شبکه: آی‌پی باید در `tbl_office_ip` باشد → وگرنه
   `403 { "error": "outside_office_network" }`.
3. `intent` فقط یک **راهنما** است. سرور خودش تصمیم می‌گیرد با همان قاعدهٔ
   `SavedTimeController::noDuplicate()`: اگر آخرین ردیف امروز یک ورود باشد،
   ورود دوم ثبت نمی‌شود.
   - اگر ممکن نیست → `409 { "error": "duplicate_punch", "expected": "pause" }`
   - اگر `intent` با واقعیت فرق داشت ولی کارِ درست ممکن بود، همان کارِ درست را
     ثبت کنید و در پاسخ `action` را برگردانید (اپ `action` را نمایش می‌دهد).
4. `biometric_verified_at` را به‌عنوان **ادعای کلاینت** بررسی کنید، نه مدرک:
   اگر `now - biometric_verified_at` از ۶۰ ثانیه بیشتر بود
   `422 { "error": "biometric_required" }`. توجه: API سیستم‌عامل نمی‌گوید
   کدام انگشت تطبیق خورد و الگو را بیرون نمی‌دهد، پس این فیلد فقط جلوی
   درخواست‌های تمام‌خودکار را می‌گیرد. امنیت واقعی از «دستگاه بسته‌شده»
   می‌آید، نه از این عدد.
5. **تأییدِ حضور اول، ثبت بعد**: اگر `MOBILE_QR_REQUIRED=true` باشد و این
   کارمند امروز ردیفی در `tbl_mobile_presence_confirm` نداشته باشد
   (`MobilePresence::blocksPunch`) → هر دو کار
   `403 { "error": "presence_required", "message": "…" }` و هیچ رکوردی
   نوشته نمی‌شود. تأییدِ دستیِ مدیر هم همین قفل را باز می‌کند.
   ضمناً همین شرط را در `GET /today` هم دیده می‌شود (`today.qr`).
6. سپس مثل مسیرهای وب: یک ردیف `tbl_saved_time` با `time` سرور ساخته شود و
   `TimerController::create()` ردیف `tbl_timer` را با `calendar_id` روزِ
   **واقعی** بسازد.

پاسخ `200`:

```json
{ "action": "start",
  "punch": { "time": "08:15:03", "start": 1, "pause": 0 },
  "today": { "dmy": 13102026, "punches": [ … ], "server_time": { … } } }
```

`today` باید همان شکل `GET /today` باشد تا اپ بدون درخواست دوم به‌روز شود.

نکته: اپ در حالتِ `presence_required` هیچ درخواستی نمی‌فرستد؛ دکمه‌اش
«تأیید حضور با QR» می‌شود و اسکنر را باز می‌کند (و همان لحظه
`POST /qr/spotlight` را می‌زند). این کد خطا برای حالتی است که اپ از سرور عقب
افتاده باشد (تأیید در گوشیِ دیگری یا توسط مدیر انجام شده).

### `GET /api/v1/history?page=1`

→ `{ "days": [ { "dmy", "entry", "exit", "minutes", "punches" } ], "server_time": { … } }`

`entry` = ساعت اولین ردیف `start=1` آن روز، `exit` = آخرین ردیف `pause=1`،
`minutes` = جمع دقیقه‌ها. نزولی بر اساس `dmy`، حداکثر ۳۰ روز در هر صفحه.

`punches` = همهٔ تیک‌های آن روز به ترتیب، با همان شکل `today.punches`
(`[ { "time": "08:02:00", "start": 1, "pause": 0 }, … ]`). اپ با ضربه روی هر
روز همین‌ها را باز می‌کند، پس اگر نفرستید صفحهٔ سابقه فقط خلاصهٔ روز را
نشان می‌دهد (فیلد اختیاری است).

### `POST /api/v1/profile/photo`

بدنهٔ `multipart/form-data` با فیلدِ `photo`، با توکنِ همان نشست.

→ `{ "avatar": "u12-20261016-093012-a1b2c3.jpg", "employee": { … } }`

برش و چرخش در خودِ گوشی انجام می‌شود — در **ویرایشگرِ خودِ اپ** (قابِ مربع،
لغزندهٔ زاویه، چرخشِ ۹۰ درجه‌ای، بزرگ‌نمایی و کشیدن)، نه پیکرِ سیستم‌عامل،
پس سرور فقط اعتبارسنجی و ذخیره می‌کند: تصویرِ واقعی (jpeg/png/gif/webp —
تشخیص از *محتوا*، نه پسوند) و حداکثر ۸ مگابایت. فایل با نامی یگانه در
`public/images/users/` می‌نشیند و ردیف `tbl_users_profile` به‌روز می‌شود —
همان جدولی که پنل وب می‌خواند، پس عکس هم‌زمان در اپ و سایت دیده می‌شود.
عکسِ قبلی بعد از موفقیت پاک می‌شود (به‌جز `PRP.jpg` که پیش‌فرض است).

خطاها: `photo_required` / `photo_not_image` / `photo_too_large` (۴۱۳) /
`photo_save_failed`.

### `DELETE /api/v1/profile/photo`

→ `{ "avatar": null, "employee": { … } }`

ردیفِ `tbl_users_profile` پاک می‌شود و فایلِ عکس هم از دیسک می‌رود؛ از آن به
بعد اپ و پنل هر دو عکسِ پیش‌فرضِ سرور (`images/users/PRP.jpg`) را نشان
می‌دهند.

### `POST /api/v1/office-ip`

فقط با هدر `X-Agent-Key` (کلید در `.env` سرور). بدنه `ip` را upsert کند.

### `POST /api/v1/qr/confirm`

ورودی: `{ "code": "v1.60.1750000000.0f1e2d3c4b5a6978" }`

→ `{ "confirmed": true, "qr": { … }, "employee": { … } }`

کد از QR روی کارتِ همان کارمند در صفحهٔ «همکاران» خوانده می‌شود. قالب:
`v1.<شناسهٔ کارمند>.<شمارهٔ پنجره>.<۱۶ کاراکترِ HMAC-SHA256>` — امضا با
`MOBILE_QR_KEY` سمت سرور زده می‌شود و پنجرهٔ زمانی `MOBILE_QR_WINDOW` ثانیه
است (پیش‌فرض ۳۰). **سرور فقط پنجرهٔ جاری و پنجرهٔ قبلی را می‌پذیرد**؛ پس عکسِ
گرفته‌شده از QR با واتساپ در پنجرهٔ بعد بی‌اعتبار است و ساعتِ گوشی هم هیچ
نقشی در اعتبار کد ندارد.

جریان: **اول تأیید، بعد ثبت.** تا `qr.confirmed` نیاید، `POST /punch` با
`403 { "error": "presence_required" }` رد می‌شود؛ اپ پس از ورود اگر
`qr.required && !qr.confirmed` بود، اسکنر را باز می‌کند و دکمهٔ ثبت را از
کار می‌اندازد (همان شرط را از `today.qr` می‌خواند). قفل در سرور است نه فقط
در دکمهٔ اپ، چون اپ مرزِ امنیتی نیست.

خطاها: `qr_invalid` (کدِ دست‌ساز یا MAC غلط) / `qr_expired` (پنجره گذشته) /
`qr_foreign` (QRِ **کارمندِ دیگر** — اسکنِ کارتِ همکار) / `qr_required` (چیزی
خوانده نشد) / `qr_disabled` (۵۰۳: کلید روی سرور خالی است).

### `POST /api/v1/qr/spotlight`

ورودی: `{ "state": "open" }` (پیش‌فرض) یا `{ "state": "close" }`

→ `{ "sent": true }`

«کارتِ من را روی صفحهٔ پنل بزرگ و روشن نشان بده». اپ لحظه‌ای که اسکنر را باز
می‌کند این را می‌زند تا کارمند بین کارت‌های صفحهٔ دفتر نگردد و کدِ ۳۰ ثانیه‌ای
پیش از رسیدنش عوض نشود. شناسه از **توکنِ خودِ کارمند** می‌آید، پس با این مسیر
نمی‌شود کارتِ کسی دیگر را بالا آورد.

`sent: false` یعنی هابِ زندهٔ پنل روی سرور تنظیم/روشن نیست (`TIMER_HUB_SECRET`
خالی)؛ این خطا نیست و اپ نباید چیزی نشان بدهد. کدِ خطای خاصی هم ندارد — این
مسیر کاملاً «بهترین تلاش» است.

سمتِ پنل: هاب پیامِ `qr-focus` را به همهٔ پنل‌های باز می‌فرستد و هر صفحه‌ای که
کارتِ آن کارمند را دارد، کارتش را بزرگ و بالاى فهرست می‌آورد (۴۵ ثانیه یا تا
تأییدِ حضور). جزئیات در `ws/README.md`.

با `{ "state": "close" }` (لحظهٔ بسته شدنِ اسکنر در گوشی) همان مسیر پیامِ «جمع
کن» می‌فرستد و پنل کارت را همان لحظه به حالتِ عادی برمی‌گرداند — نه ۴۵ ثانیه
بعد. اگر این خبر نرسد، همان مهلتِ ۴۵ ثانیه پشتیبان است.

در پاسخِ `login` / `today` / `punch` هم فیلدِ `today.qr` می‌آید:

```json
"qr": {
  "required": true, "enabled": true, "confirmed": false,
  "method": null, "confirmed_at": null, "seconds_left": 17
}
```

سمتِ پنل دو مسیر هست (هر دو با **نشستِ مدیر**، نه توکنِ گوشی — چون گرفتنِ
کدِ کسی از راه دور، کل خاصیتِ «در برابرِ صفحه بودن» را از بین می‌برد):

- `GET /read/qr-codes?ids=60,61` → کدِ لحظه‌ایِ همهٔ کارت‌های یک صفحه در یک
  پاسخ، به‌همراه وضعیتِ تأییدِ امروزِ هر کارمند.
- `POST /read/qr-confirm-manual` با `{ id, _token }` → تأییدِ دستیِ مدیر برای
  روزی که دوربینِ گوشیِ کارمند کار نمی‌کند (`method = manual`).

خاموش کردن: `MOBILE_QR_KEY` خالی → هیچ کدی ساخته نمی‌شود، هیچ ثبتی قفل
نمی‌شود و تأییدی خواسته نمی‌شود. `MOBILE_QR_REQUIRED=false` → QR نمایش داده
می‌شود و تأییدِ دستی کار می‌کند و ثبت هم قفل نمی‌شود (تأییدِ اختیاری).
اگر جدولِ تأیید ساخته نشده باشد (migration اجرا نشده)، قفل بی‌اثر است: کارمند
پشتِ در نمی‌ماند.

## شکل کارمند و دستگاه

```json
"employee": { "id": 12, "name": "حسین قربانی", "email": "…",
              "national_code": "…", "role": "کارشناس مالی",
              "avatar": "a1b2….jpg" }
```

`role` اختیاری است؛ اپ اگر نبود ایمیل را نشان می‌دهد. می‌توانید از
`tbl_customer_roles` + `tbl_roles` پر کنید.

`avatar` اختیاری است: نام فایل عکس پروفایل در `public/images/users/`
(همان ستون `name` جدول `tbl_users_profile` که پنل وب نشان می‌دهد). اپ
نشانی را با مبدأِ سرور می‌سازد (`<origin>/images/users/<avatar>`).

اگر فیلد `null` باشد، اپ همان **عکسِ پیش‌فرضِ سرور** را می‌خواهد
(`<origin>/images/users/PRP.jpg` — همان فایلی که پنل وب برای کارمندِ بی‌عکس
نشان می‌دهد) تا کارمند در گوشی و پنل دو چهرهٔ متفاوت نبیند. حروفِ اوّل نام
فقط آخرین پشتوانه‌اند: وقتی خودِ عکسِ پیش‌فرض هم بارگذاری نشود (مثلاً قطع
بودنِ اینترنت). پس نبودِ عکس هرگز ورود یا رندر صفحه را نمی‌شکند.

## کدهای خطا که اپ می‌شناسد

اپ این‌ها را به پیام فارسی ترجمه می‌کند (`src/lib/messages.ts`). اگر کد ناشناس
بفرستید، پیام عمومی نشان داده می‌شود:

`invalid_credentials` · `device_already_bound` · `device_mismatch` ·
`outside_office_network` · `duplicate_punch` · `biometric_required` ·
`unauthenticated` · `token_expired`

هر پاسخ خطا بهتر است `{ "error": "<code>", "message": "<متن فارسی>" }` باشد.

## آزادسازی دستگاه (پنل مدیریت)

باید در پنل مدیر یک بخش «دستگاه‌های موبایل» اضافه شود که لیست
`tbl_mobile_device` را با نام کارمند، برچسب دستگاه، `bound_at`، `last_seen_at`
و `last_ip` نشان دهد و دکمهٔ «آزادسازی» داشته باشد:

```sql
UPDATE tbl_mobile_device SET released_at = NOW() WHERE id = ?;
UPDATE tbl_mobile_token  SET revoked_at  = NOW() WHERE device_id = ?;
```

بدون این دکمه، هر تعویض گوشی یا نصب دوبارهٔ اپ به تماس با شما ختم می‌شود؛ چون
`SecureStore` اندروید با حذف اپ پاک می‌شود و شناسهٔ نصب هم عوض می‌شود.

## کارهای امنیتی که این کار آشکار کرد

مسیرهای حضور در `routes/web.php` **بدون هیچ گاردی** هستند و با `GET` کار
می‌کنند:

```php
Route::get('/present/start', 'SavedTimeController@start');
Route::get('/present/pause', 'SavedTimeController@pause');
Route::get('/read/timer','TimerController@show');
```

یعنی هر کسی روی اینترنت با حدس زدن شمارهٔ کارمند می‌تواند حضور بزند یا ساعت
همه را بخواند. پیشنهاد جدی: این سه مسیر هم پشت `middleware('auth:manager,admin')`
بروند یا حداقل `auth` بگیرند و `POST` شوند. (خارج از محدودهٔ این تسک انجام نشده
است؛ چون پنل وب فعلی به `GET` وابسته است و باید اول مطمئن شویم چیزی نمی‌شکند.)
