# اجرای meraat روی داکر

چهار سرویس: `app` (PHP 7.4 FPM)، `web` (nginx)، `db` (MariaDB 10.4) و
`scheduler` (اجرای روزانهٔ `schedule:run`).
کد به‌صورت bind-mount داخل کانتینر می‌رود، پس هر تغییری در فایل‌ها بلافاصله
دیده می‌شود و نیازی به rebuild نیست.

## اجرا

```bash
docker compose up -d --build      # http://localhost:8080
docker compose logs -f app        # لاگ‌های PHP-FPM و entrypoint
docker compose down               # توقف
docker compose down -v            # توقف + پاک کردن دیتابیس (import مجدد)
```

اولین باری که volume دیتابیس ساخته می‌شود، فایل `inbox.sql` خودکار import
می‌شود (MariaDB فقط وقتی پوشهٔ داده خالی است `/docker-entrypoint-initdb.d` را
اجرا می‌کند). برای import مجدد باید `down -v` بزنید.

## فایل‌ها

| فایل | کار |
|---|---|
| `Dockerfile` | ایمیج PHP 7.4 با افزونه‌های pdo_mysql، mbstring، gd، exif، opcache |
| `docker/php/app.ini` | تنظیمات PHP و OPcache |
| `docker/php/fpm-pool.conf` | `clear_env = no` و اندازهٔ pool |
| `docker/nginx/default.conf` | vhost با gzip، کش ۳۰ روزهٔ استاتیک و fastcgi |
| `docker/entrypoint.sh` | انتظار برای دیتابیس، دسترسی‌ها، پاک کردن کش‌های قدیمی |
| `docker-compose.yml` | تعریف چهار سرویس و volume‌ها |
| `.env.docker` | کپی `.env` با `DB_HOST=db` — در git نیست |

## نکات مهم

- **`DOCUMENT_ROOT` در nginx عمداً روی `/var/www/html` ست شده**، نه `public/`.
  کد آپلود آواتار مسیرش را `$_SERVER['DOCUMENT_ROOT'].'/public/images/users/'`
  می‌سازد و با مقدار پیش‌فرض، فایل‌ها در `public/public/...` نوشته می‌شدند و
  نمایش داده نمی‌شدند.
- **OPcache**: `validate_timestamps = 0` یعنی هر فایل یک‌بار کامپایل می‌شود و در
  هر درخواست دوباره `stat` نمی‌شود — روی bind-mount ویندوز همین تنظیم تفاوت
  بزرگی ایجاد کرد (۹ درخواست همزمان از ۵۰۰ms به ~۱۵۰ms رسید). نتیجه‌اش این است
  که بعد از هر تغییر در کد باید کانتینر ری‌استارت شود: `docker compose restart app`
  (entrypoint خودش کش‌های view/config/route را هم پاک می‌کند).
- **رمز دیتابیس** برای سرویس `db` از همان `.env` پروژه خوانده می‌شود
  (`${DB_PASSWORD}`). رمز روت با `DB_ROOT_PASSWORD` قابل تنظیم است.
- **`APP_DEBUG=false`** است. برای عیب‌یابی موقتاً در `.env.docker` آن را `true`
  کنید (این کار رقت‌بار stack trace را بیرون می‌دهد، پس دائمی نکنید).
- **دیتابیس** در volume به نام `db_data` و کد در bind-mount است؛ آپلودها در
  `public/images/users/` روی همان پروژه ذخیره می‌شوند.
- تست‌های دستی: `curl -s -o /dev/null -w '%{http_code} %{time_total}\n' http://localhost:8080/`

## کارایی (صفحات داشبورد)

سه صفحهٔ داشبورد به ازای هر سلول تقویم، کل جدول تقویم را دوباره می‌خواندند و برای
هر روز ۳ کوئری حضور می‌زدند — برای صفحهٔ اصلی حدود ۲۸۰۰ کوئری در هر درخواست.

تغییرات انجام‌شده:

- **memoize در همان درخواست** برای `CalendarController::show()`, `findPackage()`,
  `selectedPackage()`، `TimerController::pastDays()`, `check()`،
  `AppendCustomerController::showManagerCustomers()`, `showCustomer()` و
  `AppendRolesController::selectedManagerRole()` — همه فقط‌خواندنی هستند.
- **متد جدید** `TimerController::savedTimesMap($id)` که همهٔ ردیف‌های حضور یک
  کارمند را با یک کوئری برمی‌گرداند.
- **ویوها** (`customer.blade.php`, `manager.blade.php`,
  `calendar/activity_month.blade.php`) یک‌بار تقویم را می‌خوانند و از نقشهٔ آماده
  استفاده می‌کنند، به‌جای `exists()` + `first()` به ازای هر روز.

| صفحه | قبل | بعد |
|---|---|---|
| `/` (صفحهٔ اصلی) | ۱.۵s (با نوسان تا ۴.۲s)، ~۲۸۰۰ کوئری | **۰.۱۱–۰.۲۱s، ۱۱۲ کوئری** |
| `/calendar/year/{y}/c/{id}` | ۰.۹۷–۲.۶۴s | **۰.۲۷–۰.۳۱s** |
| ۹ درخواست همزمان `/read/timer` | هرکدام ۴۸۵–۶۲۱ms | **هرکدام ۱۱۰–۲۸۰ms** |
| `/login` و `/salary/table/month/{id}` | ۰.۰۸s و ۰.۱۴s | بدون تغییر |

برای اطمینان از اینکه بهینه‌سازی چیزی را عوض نکرده، خروجی HTML قبل و بعد با
نرمال‌سازی توکن CSRF و فاصله‌ها مقایسه شد (`diff` خالی شد) و هیستوگرامکلاس‌های سلول‌های تقویم (حضور/غیبت/مرخصی/تعطیل) دقیقاً برابر است: `btn-success=245`,
`btn-danger=96`, `btn-primary=14`, `btn-warning=74`, `btn-secondary=34`.

## بکاپ دیتابیس

دستور artisan:

```bash
docker compose exec app php artisan db:backup          # بکاپ دستی
docker compose exec app php artisan db:backup --keep=60  # نگه‌داری ۶۰ روز (پیش‌فرض: ۳۰ روز)
docker compose exec app zcat storage/app/backups/meraat-XXXX_XXXXXX.sql.gz | head  # بازبینی
docker compose exec -T db sh -c 'mysql -umeraat_user -p"$MYSQL_PWD" inbox' < backup.sql  # بازگردانی
```

- فایل‌ها: `storage/app/backups/meraat-تاریخ_ساعت.sql.gz` (gzip -9، رمز با
  `MYSQL_PWD` ارسال می‌شود تا در `ps` دیده نشود).
- `--single-transaction --quick --skip-lock-tables` یعنی حین بکاپ قفلی روی
  جدول‌ها نمی‌افتد و سایت کار می‌کند.
- فایل‌های قدیمی‌تر از ۳۰ روز خودکار حذف می‌شوند؛ `--keep` تعداد روزها را
  عوض می‌کند.
- **زمانبندی روزانه ساعت ۰۳:۰۰ به وقت تهران** (`config/app.php` → `Asia/Tehran`)
  از طریق سرویس `scheduler` که هر ۶۰ ثانیه `php artisan schedule:run` را اجرا
  می‌کند. بدون این سرویس زمانبندی اجرا نمی‌شود.
- اگر روی هاستی بدون داکر اجرا می‌شود (مثلاً cPanel)، همین زمانبندی با یک
  کرون ساده کار می‌کند:
  `* * * * * cd /path/to/meraat && php artisan schedule:run >> /dev/null 2>&1`
- **در پنل مدیریت**: بخش «پشتیبان‌گیری» در منوی «میزکار»، در هر دو پنل
  (`/manager` و `/admin`) — دکمهٔ
  بکاپ دستی، تاریخ/حجم آخرین بکاپ و لیست فایل‌ها برای دانلود. مسیرها با
  `auth:manager,admin` محافظت شده‌اند و نام فایل با الگوی سخت‌گیرانه چک می‌شود
  (مانع path traversal).
- هر دو پنل همان partial را نشان می‌دهند
  (`resources/views/partials/backup.blade.php`) و پیام موفقیت از
  `resources/views/partials/toasts.blade.php` می‌آید.
- نکتهٔ مهم برای نگهداری: در php-fpm خروجی `getenv()` کلید `argv` را هم دارد
  که **آرایه** است؛ اگر همان آرایهٔ خام به `proc_open` داده شود، PHP خطای
  «Array to string conversion» می‌دهد و دکمهٔ بکاپ HTML پاسخ ۵۰۰ می‌گیرد (در
  CLI مشکلی ندارد). `DatabaseBackup` الان فقط مقادیر رشته‌ای را رد می‌کند.
- بازگردانی: `zcat فایل.sql.gz | docker compose exec -T db mysql -u... -p... inbox`
  — توجه: تمام جداول فعلی DROP می‌شوند (`--add-drop-table`).
