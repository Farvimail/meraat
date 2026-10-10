# بردن meraat روی سرور

این راهنما برای سروری است که **داکر دارد** و سایت زنده فعلی باید **جایش گرفته
شود بدون از دست دادن داده**. اگر سرور داکر ندارد، اول نصبش کن
(`get.docker.com`) و از این مسیر بیا.

## ۱) معماری استقرار

```
اینترنت
   |
   | 443  (TLS، گواهی certbot)
   v
nginx خود سرور  --->  127.0.0.1:8080
(deploy/host-nginx-meraat.conf)          |
                                         v
                              +---------------------+
                              | nginx کانتینر (web) |
                              +----------+----------+
                                         | fastcgi
                              +----------v----------+
                              |  php-fpm (app)      |
                              +----------+----------+
                                         | TCP 3306
                              +----------v----------+
                              |  MariaDB (db)       |  <- volume: meraat_db
                              +---------------------+

volume ها: meraat_db (دیتابیس) | meraat_storage (لاگ/سشن/بکاپ) | meraat_uploads (عکس پرسنل)
```

سه چیز عوض نمی‌شود: گواهی SSL، پورت‌های 80/443 و دیتابیس فعلی. nginx سرور فقط
تبدیل به reverse proxy می‌شود و کد جدید در کانتینرها اجرا می‌شود.

## ۲) پیش‌نیازها روی سرور

```bash
docker --version                       # باید باشد
docker compose version                 # باید 2.3.3 یا بالاتر باشد (فیلد name در compose)
mkdir -p /srv/meraat
```

## ۳) ساخت فایل `.env`

اگر سایت فعلی سرور `.env` دارد، **همان را کپی کن** و فقط این‌ها را عوض کن:

| کلید | مقدار جدید | چرا |
|---|---|---|
| `DB_HOST` | `db` | داخل شبکه compose، دیتابیس با نام سرویس صدا زده می‌شود نه 127.0.0.1 |
| `APP_URL` | `https://meraat.piqagram.ir` | باید با دامنه واقعی بخواند |
| `APP_ENV` | `production` | |
| `APP_DEBUG` | `false` | |

بعد این کلیدها را به پایین فایل اضافه کن (فقط compose می‌خواندشان):

```env
WEB_BIND=127.0.0.1
WEB_PORT=8080
SERVER_NAME=meraat.piqagram.ir
BACKEND_HTTPS=on
DB_ROOT_PASSWORD=یک-رمز-قوی
```

`DB_PASSWORD` را هم چک کن که با چیزی که به دیتابیس می‌دهیم یکی باشد.

> **APP_KEY را دست نزن.** اگر `php artisan key:generate` بزنی، همه نشست‌ها باطل
> می‌شوند و مقادیری که با کلید قبلی رمزنگاری شده‌اند دیگر خوانده نمی‌شوند.

اگر می‌خواهی از صفر بسازی: `cp .env.production.example .env` و مقادیر را پر کن.

## ۴) آوردن کد به سرور

از **همین ماشین** (ویندوز، Git Bash):

```bash
SERVER=root@آی-پی-سرور ./deploy/push.sh
```

اسکریپت آرشیو می‌سازد، با ssh می‌فرستد و روی سرور در `/srv/meraat` باز می‌کند.
`.env` سرور دست‌نخورده می‌ماند (کنار گذاشته و برگردانده می‌شود) و درخت قبلی با
نام `/srv/meraat.prev-<تاریخ>` برای بازگشت سریع نگه داشته می‌شود (فقط سه نسخه
آخر).

فرستاده **نمی‌شود**: `.git`، `vendor` (داخل ایمیج نصب می‌شود)، `node_modules`،
`inbox.sql`، `storage/` و `public/images/users`.

## ۵) آوردن دیتابیس فعلی داخل داکر (فقط یک‌بار)

روی سرور، از دیتابیس بومی فعلی دامپ بگیر:

```bash
mysqldump --single-transaction --quick --skip-lock-tables \
    -u root -p inbox | gzip -9 > /root/meraat-live.sql.gz
```

بعد داخل استک داکری بارگذاری کن. (اول گام ۷ را حداقل یک‌بار اجرا کن تا volume
دیتابیس ساخته شود.)

```bash
cd /srv/meraat
./deploy/import-db.sh /root/meraat-live.sql.gz          # اول خلاصه را نشان می‌دهد
./deploy/import-db.sh /root/meraat-live.sql.gz --yes    # بارگذاری واقعی
```

اسکریپت قبل از دست زدن به چیزی، از دیتابیس مقصد هم بکاپ می‌گیرد و در آخر
`php artisan migrate --force` را اجرا می‌کند.

## ۶) آوردن عکس‌های پرسنل (فقط یک‌بار)

آپلودها در دیتابیس نیستند؛ فایل‌اند:

```bash
cd /srv/meraat
docker compose -f docker-compose.prod.yml cp \
    /var/www/meraat/public/images/users/. app:/var/www/html/public/images/users/
```

(مسیر مبدأ را با مسیر واقعی سایت فعلی عوض کن. اگر volume آپلود هنوز ساخته نشده
باشد، کپی داخل `/srv/meraat/public/images/users/` پیش از اولین build هم کار
می‌کند، چون volume اولین بار از محتوای ایمیج پر می‌شود.)

## ۷) استقرار

```bash
cd /srv/meraat
./deploy/deploy.sh
```

یا از همین ماشین با اجرای خودکار روی سرور:

```bash
SERVER=root@آی-پی-سرور ./deploy/push.sh --deploy
```

`deploy.sh` این کارها را می‌کند:

1. بررسی می‌کند `.env` هست، `APP_KEY` و رمزهای دیتابیس پرند، compose جدید است؛
2. اگر استک بالا بود، اول `db:backup` می‌گیرد؛
3. `docker compose build` (کد داخل ایمیج پخته می‌شود)؛
4. `up -d` و انتظار برای آماده شدن دیتابیس؛
5. `php artisan migrate --force` — روی دیتابیس فعلی فقط یک مهاجرت اجرا می‌شود:
   `2026_10_09_000001_add_archive_fields_to_users_table` (ستون‌های `archived_at`
   و `national_code`)؛
6. پاک کردن کش‌های وابسته به هاست؛
7. تست سلامت با `curl` روی `127.0.0.1:8080`.

اگر گام ۷ عدد `2xx` یا `3xx` داد، کانتینر سالم است و نوبت nginx سرور است.

## ۸) فعال کردن vhost سرور

با کاربر root روی سرور (vhost قدیمی همین دامنه را غیرفعال کن تا دو server block
تکراری برای یک server_name نماند):

```bash
cp /srv/meraat/deploy/host-nginx-meraat.conf /etc/nginx/sites-available/meraat.piqagram.ir

# مسیر ssl_certificate را اگر فرق می‌کند اصلاح کن
nano /etc/nginx/sites-available/meraat.piqagram.ir

ls -l /etc/nginx/sites-enabled/          # vhost قبلی همین دامنه را پیدا کن
rm /etc/nginx/sites-enabled/<vhost-قدیمی>

ln -s /etc/nginx/sites-available/meraat.piqagram.ir /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

نکته: `BACKEND_HTTPS=on` باعث می‌شود PHP درخواست را https ببیند و آدرس‌های
`asset()`/`url()` با `https://meraat.piqagram.ir` ساخته شوند. اگر آن را `off`
بگذاری، مرورگر فایل‌های CSS/JS را به‌عنوان محتوای ناامن بلاک می‌کند.

### بازگشت سریع (rollback)

اگر چیزی خراب شد، vhost قدیمی را برگردان و کد قبلی را دوباره مستقر کن:

```bash
rm /etc/nginx/sites-enabled/meraat.piqagram.ir
ln -s /etc/nginx/sites-available/<vhost-قدیمی> /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## ۹) بکاپ و بازگردانی

بکاپ روزانه ساعت ۰۳:۰۰ به وقت تهران خودکار اجرا می‌شود (سرویس `scheduler` در
compose که هر دقیقه `schedule:run` می‌زند و در `app/Console/Kernel.php` دستور
`db:backup` را زمان‌بندی کرده). فایل‌ها در volume و در مسیر
`storage/app/backups/meraat-<تاریخ>_<ساعت>.sql.gz` می‌نشینند (۳۰ روز نگه‌داری).

```bash
cd /srv/meraat

# بکاپ دستی
docker compose -f docker-compose.prod.yml exec app php artisan db:backup

# لیست بکاپ‌ها (علاوه بر پنل مدیریت -> بخش پشتیبان‌گیری)
docker compose -f docker-compose.prod.yml exec app ls -lh storage/app/backups

# بیرون کشیدن بکاپ از volume
docker compose -f docker-compose.prod.yml cp app:/var/www/html/storage/app/backups ./backups/

# بازگردانی (جداول فعلی DROP می‌شوند)
zcat backups/meraat-<تاریخ>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db \
    sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

## ۱۰) به‌روزرسانی‌های بعدی

```bash
SERVER=root@آی-پی-سرور ./deploy/push.sh --deploy
```

همین. چون کد داخل ایمیج می‌رود، هر استقرار یعنی build جدید؛ OPcache
(`validate_timestamps=0`) هم بی‌خطر است، چون فایل‌ها زیر پای PHP عوض نمی‌شوند.
دیتابیس، آپلودها، لاگ‌ها و بکاپ‌ها در volume می‌مانند و استقرار به آن‌ها دست
نمی‌زند.

## ۱۱) عیب‌یابی

| نشانه | چیزهایی که چک کن |
|---|---|
| سایت `502` می‌دهد | `docker compose -f docker-compose.prod.yml ps` و بعد `logs web app`؛ معمولا `app` بالا نیست یا نام سرویس در `fastcgi_pass` عوض شده |
| سایت `500` می‌دهد | `logs app` و `storage/logs/laravel.log`؛ معمولا `APP_KEY` خالی یا دیتابیس در دسترس نیست |
| CSS/JS بلاک می‌شود | `BACKEND_HTTPS=on` است؟ `APP_URL` با `https` شروع می‌شود؟ |
| عکس پرسنل آپلود می‌شود ولی نمایش داده نمی‌شود | کانتینر `web` باید همان volume آپلود را ببیند (`meraat_uploads`) و در vhost کانتینر `fastcgi_param DOCUMENT_ROOT /var/www/html;` باید سر جایش باشد |
| بعد از تغییر `.env` هیچی عوض نمی‌شود | `.env` به‌صورت bind-mount خوانده می‌شود؛ `docker compose -f docker-compose.prod.yml restart app scheduler` |
| تغییر کد دیده نمی‌شود | کد داخل ایمیج است؛ باید `./deploy/deploy.sh` (یا دست‌کم `build` + `up -d`) اجرا شود. `restart` کافی نیست |
| `name` در compose را نمی‌شناسد | نسخه compose قدیمی است؛ یا compose را آپدیت کن یا `name:` را از فایل بردار و همه‌جا `-p meraat-prod` اضافه کن |

## ۱۲) چه چیزی با `docker-compose.yml` لوکال فرق دارد

فایل `docker-compose.yml` (بدون `.prod`) برای توسعه روی همین ویندوز است 
و روی سرور **استفاده نشود**:

| | `docker-compose.yml` (لوکال) | `docker-compose.prod.yml` (سرور) |
|---|---|---|
| کد | bind-mount پوشه پروژه | پخته‌شده داخل ایمیج (`Dockerfile.prod`) |
| `vendor/` | از روی دیسک، در صورت نبود داخل کانتینر نصب می‌شود | در زمان build نصب می‌شود |
| دیتابیس | اولین بار از `inbox.sql` پر می‌شود | دست‌نخورده؛ از داده زنده استفاده می‌کند |
| پورت | `0.0.0.0:8080` | `127.0.0.1:8080` (پشت nginx سرور) |
| `storage` و آپلودها | روی پوشه پروژه | volumeهای نام‌دار |
| پروژه compose | نام پوشه | `meraat-prod` |

چون نام پروژه compose فرق می‌کند، هر دو می‌توانند همزمان روی یک ماشین باشند؛
فقط پورت میزبانشان نباید یکی باشد.
