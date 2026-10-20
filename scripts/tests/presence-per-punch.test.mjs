/*
  «هر ثبت یک تأیید» — بررسیِ سیم‌کشی، بدونِ PHP و بدونِ مرورگر.

  چرا لازم است: این قاعده سه جا باید هم‌زمان درست باشد و اگر یکی جا بماند،
  باگ بی‌صدا برمی‌گردد:

    ۱) سرور: `MobilePresence::blocksPunch` برای **هر ثبتی** (ورود و خروج)
       قفل می‌کند و تأییدِ **مصرف‌نشده** می‌خواهد؛ `consume()` همان تأیید را با
       ثبتِ موفق مصرف می‌کند.
    ۲) API: `punch` نوبت (`$expected`) را پیش از قفل حساب می‌کند (وگرنه به
       `blocksPunch` نمی‌شود گفت «ورود یا خروج»)، و مصرف داخلِ همان تراکنش
       است تا اگر ثبت شکست بخورد تأیید از دست نرود.
    ۳) دیتابیس: کلیدِ یکتای (customer_id, dmy) که یک ردیف را به کلِ روز گره
       می‌زد برداشته می‌شود و `consumed_at` اضافه می‌شود.

  اجرا:  node scripts/tests/presence-per-punch.test.mjs
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, path), 'utf8');

const presence = read('../../app/MobilePresence.php');
const api = read('../../app/Http/Controllers/MobileApiController.php');
const migration = read('../../database/migrations/2026_10_17_000001_confirm_each_punch_with_presence.php');

/** بدنهٔ یک متد را از `function name` تا متدِ بعدی برمی‌گرداند. */
function body(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.ok(start >= 0, `متدِ ${name} پیدا نشد`);

  const next = source.indexOf('\n    public ', start + 1);
  const nextPrivate = source.indexOf('\n    private ', start + 1);
  const ends = [next, nextPrivate].filter((index) => index > start);
  const end = ends.length ? Math.min(...ends) : source.length;

  return source.slice(start, end);
}

test('قفلِ ثبت برای ورود و خروج یکی است: هر دو تأییدِ مصرف‌نشده می‌خواهند', () => {
  const block = body(presence, 'blocksPunch');

  assert.match(block, /\$intent/, 'blocksPunch باید نوعِ ثبت را بگیرد (امضا و پیام)');
  // استثنای قدیمی «خروج قفل نیست» نباید برگشته باشد: خروج هم مثل ورود
  // پشتِ همان قفل است تا اثرِ انگشتِ خروج فقط بعد از اسکنِ QR پذیرفته شود.
  assert.doesNotMatch(
    block,
    /if \(\$intent !== 'start'\)/,
    'خروج نباید از قفل مستثنی باشد — ثبتِ خروج هم تأییدِ تازه می‌خواهد',
  );
  assert.match(block, /pending\(/, 'قفل باید «تأییدِ مصرف‌نشده» را بسنجد، نه «تأییدِ آن روز»');
});

test('تأییدِ آماده، مصرف‌نشده پیدا می‌شود و با ثبت مصرف می‌شود', () => {
  const pendingRow = body(presence, 'pendingRow');
  const consume = body(presence, 'consume');

  assert.match(pendingRow, /whereNull\('consumed_at'\)/, 'تأییدِ آماده یعنی consumed_at خالی');
  assert.match(consume, /consumed_at/, 'consume باید مهرِ مصرف بزند');
  assert.doesNotMatch(
    body(presence, 'row'),
    /whereNull\('consumed_at'\)/,
    'نمایشِ «آخرین تأیید» نباید فقط مصرف‌نشده‌ها را ببیند',
  );
});

test('ثبتِ تأییدِ تازه ردیفِ نو می‌سازد، نه بازنویسیِ ردیفِ قبلی', () => {
  const confirm = body(presence, 'confirm');

  assert.match(confirm, /->insert\(/, 'confirm باید insert کند');
  assert.doesNotMatch(confirm, /updateOrInsert/, 'updateOrInsert ردیفِ قبلی را بازنویسی می‌کند');
  assert.match(confirm, /'consumed_at' => null/, 'تأییدِ تازه باید مصرف‌نشده باشد');
});

test('API نوبت را پیش از قفل حساب می‌کند و مصرف داخلِ تراکنش است', () => {
  const punch = body(api, 'punch');

  const expectedAt = punch.indexOf('$expected = $this->nextIntent');
  const blockAt = punch.indexOf('blocksPunch');

  assert.ok(expectedAt >= 0 && blockAt > expectedAt, 'قفل باید بعد از معلوم‌شدنِ نوبت سنجیده شود');
  assert.match(punch, /blocksPunch\(\$user->id, \$dmy, \$expected\)/, 'نوبت باید به blocksPunch داده شود');
  assert.match(punch, /MobilePresence::consume\(/, 'ثبت باید تأیید را مصرف کند');

  // مصرف نباید پشتِ شرطِ ورود باشد: خروج هم تأییدِ خودش را خرج می‌کند.
  assert.doesNotMatch(
    punch,
    /if \(\$isStart\)[\s\S]{0,120}MobilePresence::consume/,
    'مصرفِ تأیید نباید فقط برای ورود باشد؛ خروج هم باید تأییدش را مصرف کند',
  );

  const consumeAt = punch.indexOf('MobilePresence::consume(');
  const commitAt = punch.indexOf('DB::commit()');

  assert.ok(consumeAt > 0 && commitAt > consumeAt, 'مصرف باید داخلِ تراکنش و پیش از commit باشد');
  assert.match(
    api,
    /'qr' => MobilePresence::state\(\$customerId, \$dmy, null, \$this->nextIntent\(\$customerId\)\)/,
    'today باید وضعیت را با نوبتِ واقعی بفرستد',
  );
});

test('migration: ستونِ مصرف، حذفِ کلیدِ یکتای روزانه و ردیف‌های قدیمیِ مصرف‌شده', () => {
  assert.match(migration, /ADD COLUMN `consumed_at`/, 'ستونِ consumed_at لازم است');
  assert.match(migration, /DROP INDEX `uniq_presence_day`/, 'کلیدِ یکتای (customer_id, dmy) باید برداشته شود');
  assert.match(migration, /idx_presence_pending/, 'ایندکسِ جست‌وجوی تأییدِ آماده لازم است');
  assert.match(
    migration,
    /whereNull\('consumed_at'\)[\s\S]{0,120}consumed_at' => DB::raw\('`confirmed_at`'\)/,
    'ردیف‌های قدیمی باید مصرف‌شده علامت بخورند تا ثبتِ رایگانِ اضافه باز نکنند',
  );
});

test('اپ به lock سرور تکیه می‌کند، نه به confirmedِ روز', () => {
  const source = read('../../mobile/src/lib/presence.ts');

  assert.match(source, /pending: boolean/, 'وضعیتِ اپ باید pending داشته باشد');
  assert.match(source, /lock: boolean/, 'وضعیتِ اپ باید lock داشته باشد');

  const scan = /export function needsQrScan[\s\S]*?\n}/.exec(source);

  assert.ok(scan, 'needsQrScan باید باشد');
  assert.match(scan[0], /return state\.lock;/, 'تنها معیارِ اسکن باید lock باشد');
});

test('تأییدِ آماده ۳۰ ثانیه بیشتر اعتبار ندارد', () => {
  const presence = read('../../app/MobilePresence.php');
  const config = read('../../config/services.php');
  const app = read('../../mobile/src/lib/presence.ts');
  const session = read('../../mobile/src/session.tsx');

  assert.match(
    config,
    /'punch_window' => env\('MOBILE_QR_PUNCH_WINDOW', 30\)/,
    'مهلت باید از env خوانده شود و پیش‌فرضش ۳۰ ثانیه باشد',
  );

  assert.match(presence, /const PUNCH_WINDOW_SECONDS = 30;/, 'پیش‌فرضِ ۳۰ ثانیه در خودِ کلاس هم باشد');

  const pending = /private static function pendingRow[\s\S]*?\n    }/.exec(presence);

  assert.ok(pending, 'pendingRow باید باشد');
  assert.match(
    pending[0],
    /where\('confirmed_at', '>=', \$cutoff\)/,
    'جست‌وجوی «تأییدِ آماده» باید ردیفِ کهنه‌تر از مهلت را کنار بگذارد',
  );

  // اپ باید مهلت را بشمارد و در پایانش وضعیت را از سرور تازه کند؛ وگرنه دکمهٔ
  // باز، ضربه‌ای می‌گیرد که سرور با ۴۰۳ ردش می‌کند.
  assert.match(app, /export function presenceExpired/, 'اپ باید «منقضی شد» را بشناسد');
  assert.match(
    app,
    /export function presenceLocksPunch[\s\S]{0,300}presenceExpired/,
    'قفلِ دکمه باید مهلت را هم در نظر بگیرد',
  );
  assert.match(
    session,
    /presence\.expiresAt[\s\S]{0,400}refreshToday/,
    'در پایانِ مهلت، وضعیت باید از سرور تازه شود',
  );
});

test('بعد از تأیید، همان ثبت ادامه می‌یابد تا مهلت نسوزد', () => {
  const dashboard = read('../../mobile/src/screens/DashboardScreen.tsx');
  const session = read('../../mobile/src/session.tsx');

  assert.match(
    session,
    /punch\(options\?: \{ presenceJustConfirmed\?: boolean \}\)/,
    'ثبت باید گزینهٔ «تأیید همین لحظه» را بپذیرد',
  );
  assert.match(
    session,
    /!options\?\.presenceJustConfirmed && presenceLocksPunch\(presence\)/,
    'در مسیرِ اسکنِ تازه، قفلِ محلی نباید ثبت را رد کند (سرور می‌سنجد)',
  );
  assert.match(
    dashboard,
    /setTimeout\(\(\) => void punch\(\{ presenceJustConfirmed: true \}\), 350\)/,
    'داشبورد باید بعد از اسکنِ موفق خودش ثبت را ادامه بدهد',
  );
  assert.match(
    dashboard,
    /onPress=\{\(\) => \(punchLocked \? openScan\(true\) : void punch\(\)\)\}/,
    'اسکنی که از دکمهٔ ثبت باز می‌شود باید «برای ثبت» علامت بخورد',
  );
  assert.match(
    dashboard,
    /onPress=\{\(\) => openScan\(\)\}/,
    'دکمهٔ کارتِ تأیید نباید بعد از اسکن ثبت بسازد',
  );
});

test('مهلت که تمام شد، اپ خودش دوباره تأییدِ حضور می‌خواهد', () => {
  const app = read('../../mobile/src/lib/presence.ts');
  const dashboard = read('../../mobile/src/screens/DashboardScreen.tsx');

  assert.match(app, /export function presenceReaskNote\(/, 'جملهٔ «دوباره تأیید کن» باید یک جا باشد');
  assert.match(
    app,
    /state\.intent === 'pause'[\s\S]{0,200}خروج ثبت نشد/,
    'برای نوبتِ خروج، جمله باید بگوید خودِ خروج ثبت نشده',
  );

  // رویدادِ «مهلت تمام شد» باید روی تایمر بنشیند، نه فقط رندرِ ثانیه‌ای: نشست
  // خودش کمی بعد از مهلت وضعیت را تازه می‌کند و آن‌وقت دیگر «منقضی» دیده نمی‌شود.
  assert.match(
    dashboard,
    /setTimeout\(\(\) => setPresenceTimedOut\(true\), left \+ 50\)/,
    'پایانِ مهلت باید یک رویدادِ زمان‌بندی‌شدهٔ مستقل باشد',
  );

  const effect = /if \(!presenceTimedOut \|\| presence\.expiresAt == null\)[\s\S]*?\n  \}, \[presenceTimedOut, presence\.expiresAt\]\);/.exec(
    dashboard,
  );

  assert.ok(effect, 'افکندِ «مهلت تمام شد» باید در داشبورد باشد');
  assert.match(effect[0], /setScanOpen\(true\)/, 'شیتِ اسکن باید خودش باز شود');
  assert.match(effect[0], /presenceReaskNote\(presence\)/, 'دلیلِ باز شدن باید گفته شود');
  assert.match(
    effect[0],
    /reaskedRef\.current === presence\.expiresAt/,
    'یک مهلت نباید چندبار شیت را باز کند (وگرنه بستنش ممکن نیست)',
  );
});
