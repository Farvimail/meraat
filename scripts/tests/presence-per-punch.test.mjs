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
