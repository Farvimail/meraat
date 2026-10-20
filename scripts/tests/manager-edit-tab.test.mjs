/*
  تبِ «ویرایش» پنل مدیر — بررسیِ سیم‌کشی، بدون مرورگر و بدون سرور.

  چرا لازم است: سه فایل باید با هم دقیق جور باشند وگرنه تب یا اصلاً کار نمی‌کند
  یا بی‌صدا خاموش است:

    ۱) روت `POST /customer/credentials` پشتِ گارد `auth:manager` باشد
       (به رمزِ عبورِ کاربران دست می‌زند؛ بدون نشست نباید در دسترس باشد)
    ۲) کنترلر: ایمیلِ یکتا (نادیده‌گرفتنِ خودِ همان کارمند)، پسوردِ اختیاریِ
       حداقل ۶ کاراکتر، و ذخیره فقط با Hash::make — هرگز متنِ خام یا خالی
    ۳) بلید: دکمهٔ تب کنارِ «تماس»، پنلش به همان روت فرم بفرستد و فیلدهای
       email/password و کلید CSRF داشته باشد

  اجرا:  node scripts/tests/manager-edit-tab.test.mjs
*/
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, path), 'utf8');

const routes = read('../../routes/web.php');
const controller = read('../../app/Http/Controllers/CustomerController.php');
const blade = read('../../resources/views/manager.blade.php');

// ۱) روت پشتِ گارد مدیر است؟
const routeBlock = /Route::post\('\/customer\/credentials','CustomerController@credentials'\)\s*\n?\s*->name\('customer\.credentials'\)->middleware\('auth:manager'\);/.exec(routes);
assert.ok(routeBlock, "روت customer.credentials باید باشد و پشتِ گارد auth:manager باشد");

// ۲) کنترلر
const method = /function credentials\s*\(/.exec(controller);
assert.ok(method, 'CustomerController باید متد credentials داشته باشد');
assert.match(controller, /unique:users,email,/, 'ایمیل باید یکتا باشد (به‌جز خودِ همان کارمند)');
assert.match(controller, /'password'\s*=>\s*'nullable\|string\|min:6'/, 'پسوردِ خالی یعنی بدون تغییر؛ پر باید حداقل ۶ باشد');
assert.match(controller, /Hash::make\(\$request\['password'\]\)/, 'پسورد باید Hash::make شود، نه متنِ خام');
assert.doesNotMatch(
    controller.slice(method.index),
    /password'\s*=>\s*\$request\['password'\]/,
    'پسورد هرگز نباید بدون Hash ذخیره شود',
);
assert.match(controller, /exists:users,id/, 'customer_id باید به کارمندِ واقعی اشاره کند');

// ۲٫۵) آزاد کردن گوشی: همان کاری که تا دیروز فقط با CLI ممکن بود
const releaseRoute = /Route::post\('\/customer\/device\/release','CustomerController@releaseDevice'\)\s*\n?\s*->name\('customer\.device\.release'\)->middleware\('auth:manager'\);/.exec(routes);
assert.ok(releaseRoute, 'روت آزادسازی گوشی باید باشد و پشتِ گارد auth:manager باشد');
assert.match(controller, /function releaseDevice\s*\(/, 'CustomerController باید releaseDevice داشته باشد');
assert.match(controller, /released_at' => \$now/, 'آزادسازی باید released_at را بنویسد');
assert.match(controller, /tbl_mobile_token[\s\S]{0,200}revoked_at/, 'توکن‌های همان گوشی هم باید باطل شوند');

// ۳) بلید: دکمهٔ تب، پنل، فرم و فیلدها
assert.match(
    blade,
    /id="nav-edit-tab-\{\{\$item->customer_id\}\}"[^>]*data-bs-target="#nav-edit-\{\{\$item->customer_id\}\}"[^>]*>ویرایش<\/button>/,
    'دکمهٔ «ویرایش» باید به پنلش وصل باشد',
);
assert.match(
    blade,
    /nav-contact-tab-\{\{\$item->customer_id\}\}[\s\S]{0,400}nav-edit-tab-\{\{\$item->customer_id\}\}/,
    'دکمهٔ «ویرایش» باید کنارِ تب «تماس» باشد، نه جایِ دور',
);
assert.match(
    blade,
    /<div class="tab-pane fade" id="nav-edit-\{\{\$item->customer_id\}\}" role="tabpanel" aria-labelledby="nav-edit-tab-\{\{\$item->customer_id\}\}">/,
    'پنلِ «ویرایش» باید با دکمه جور باشد',
);
assert.match(blade, /route\('customer\.credentials'\)/, 'فرم باید به همان روت بفرستد');
assert.match(blade, /name="customer_id"/, 'فرم باید کارمندِ همان کارت را بفرستد');
assert.match(blade, /name="email"/, 'فیلد ایمیل لازم است');
assert.match(blade, /name="password"/, 'فیلد پسورد لازم است');
assert.match(blade, /type="password"[^>]*name="password"/, 'پسورد باید در فیلدِ پسورد باشد نه متنِ ساده');
assert.match(blade, /@csrf/, 'فرم باید CSRF داشته باشد');

// فرمِ تبِ ویرایش باید داخل همان پنلِ خودش باشد (csrfِ بالای صفحه هم هست،
// پس شمارش کافی نیست). پنل تا شروعِ پنلِ بعدی بریده می‌شود، نه با اولین
// `</div>` — ساختارِ درونیِ فرم divهای تو در تو دارد.
const paneStart = blade.indexOf('<div class="tab-pane fade" id="nav-edit-');
const paneEnd = blade.indexOf('show active" id="nav-presents-', paneStart);
assert.ok(paneStart >= 0 && paneEnd > paneStart, 'پنلِ ویرایش باید قبل از پنلِ حضور در بلید باشد');
const pane = blade.slice(paneStart, paneEnd);
assert.match(pane, /route\('customer\.credentials'\)/, 'خودِ فرم باید درونِ پنلِ ویرایش باشد');
assert.match(pane, /name="password"/, 'فیلد پسورد باید درونِ همان پنل باشد');
assert.match(pane, /name="email"/, 'فیلد ایمیل باید درونِ همان پنل باشد');
assert.match(pane, /name="customer_id"/, 'شناسهٔ کارمند باید درونِ همان پنل باشد');
assert.match(pane, /AppendCustomerController::activeDevice/, 'وضعیت گوشیِ فعال باید در همان تب نمایش داده شود');
assert.match(pane, /route\('customer\.device\.release'\)/, 'دکمهٔ «آزاد کردن گوشی» باید به همان روت بفرستد');
assert.match(pane, /آزاد کردن گوشی/, 'متنِ دکمه باید صریح باشد');

/*
 * شکستِ بی‌صدا — همان چیزی که «ایمیل و پسورد را عوض کردم ولی رفرش کردم دیدم
 * قدیمی‌ها مانده‌اند» را می‌ساخت.
 *
 * وقتی اعتبارسنجی رد می‌شد (رمزِ کوتاه، ایمیلِ تکراری، ایمیلِ بی‌قالب)، لاراول
 * با خطاها به همان صفحه برمی‌گشت، ولی تبِ ویرایش هیچ `$errors` را نشان نمی‌داد
 * و مقدارِ فیلد هم از دیتابیس (یعنی قدیمی) خوانده می‌شد. از دیدِ کاربر یعنی
 * «ذخیره شد، ولی هیچ چیز عوض نشد». این تست همان سوراخ را می‌بندد.
 */
assert.match(pane, /\$errors->any\(\)/, 'خطاهای اعتبارسنجی باید در همان تب دیده شوند');
assert.match(pane, /old\('email'\)/, 'بعد از خطا باید همان ایمیلِ تایپ‌شده بماند، نه مقدارِ قدیمی');
assert.match(
  pane,
  /old\('customer_id'\)[\s\S]{0,120}\$item->customer_id/,
  'خطا فقط روی کارتِ همان کارمند نشان داده شود، نه تبِ همه',
);
assert.match(pane, /autocomplete="new-password"/, 'مدیر نباید رمزِ خودش را داخلِ این فرم ببیند (autofillِ مرورگر)');

// ۴) کنترلر دلیلِ ردشدن را فارسی می‌گوید، نه با متنِ پیش‌فرضِ انگلیسیِ لاراول.
assert.match(controller, /'email\.unique'\s*=>/, 'پیامِ ایمیلِ تکراری باید صریح باشد');
assert.match(controller, /'password\.min'\s*=>/, 'کوتاه‌بودنِ رمز باید گفته شود، نه اینکه بی‌صدا رد شود');

/*
 * ریشهٔ باگِ واقعی: در لاراول ۵٫۶ (همین نسخهٔ پروژه) `validate` روی
 * `Illuminate\Http\Request` وجود ندارد؛ متد روی کنترلر است
 * (`ValidatesRequests`). `$request->validate(...)` در همین نسخه
 * `BadMethodCallException` می‌دهد → درخواست ۵۰۰ می‌شود و ذخیره اصلاً اجرا
 * نمی‌شود. کاربر فقط می‌دید «ذخیره کردم، رفرش کردم، همان قدیمی‌ها مانده».
 *
 * این تست کلِ `app/` را می‌گردد تا این اشتباه در هیچ مسیرِ دیگری برنگردد.
 */
function phpFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);

    if (entry.isDirectory()) return phpFiles(path);

    return entry.name.endsWith('.php') ? [path] : [];
  });
}

// کامنت‌ها دور ریخته می‌شوند: توضیحِ همین باگ داخلِ کامنت آمده و نباید
// خودش را گزارش کند.
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const wrongRequestValidate = phpFiles(resolve(here, '../../app')).filter((file) =>
  /\$request->validate\s*\(/.test(stripComments(readFileSync(file, 'utf8'))),
);

assert.deepEqual(
  wrongRequestValidate.map((file) => file.slice(file.indexOf('app'))),
  [],
  'در لاراول ۵٫۶ باید $this->validate($request, ...) باشد، نه $request->validate(...)',
);
assert.match(controller, /\$this->validate\(\$request,/, 'اعتبارسنجیِ تبِ ویرایش باید از کنترلر صدا زده شود');

console.log('✔ تبِ «ویرایش»: روتِ گارددار، کنترلرِ امن و فرمِ وصل به هم');
console.log('\nهمهٔ بررسی‌های تبِ ویرایشِ پنل مدیر گذشت.');