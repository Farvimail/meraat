import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NO_PRESENCE,
  PUNCH_LOCK_NOTE,
  codeCustomerId,
  localCodeProblem,
  looksLikeCode,
  needsQrScan,
  presenceExpired,
  presenceLocksPunch,
  presenceNote,
  presenceOf,
  presenceReaskNote,
  presenceSecondsLeft,
} from '../presence.ts';

/** کدِ نمونه، همان قالبی که سرور می‌سازد: `v1.<کارمند>.<پنجره>.<۱۶ کاراکتر>`. */
const OWN_CODE = 'v1.60.1750000000.0f1e2d3c4b5a6978';

test('پاسخِ ناقص یا قدیمیِ سرور → حالتِ پیش‌فرضِ «تأییدی لازم نیست»', () => {
  assert.deepEqual(presenceOf(undefined), NO_PRESENCE);
  assert.deepEqual(presenceOf(null), NO_PRESENCE);
  assert.deepEqual(presenceOf('v1'), NO_PRESENCE);
  assert.equal(needsQrScan(presenceOf(undefined)), false);
});

test('حالتِ تأیید درست خوانده می‌شود و مقادیرِ بی‌ربط نادیده می‌مانند', () => {
  const state = presenceOf({
    required: true,
    enabled: true,
    confirmed: false,
    method: 'telepathy',
    confirmed_at: 42,
    seconds_left: '9',
  });

  assert.equal(state.required, true);
  assert.equal(state.enabled, true);
  assert.equal(state.confirmed, false);
  assert.equal(state.method, null, 'روشِ ناشناخته باید null شود، نه اینکه خام برود داخل UI');
  assert.equal(state.confirmedAt, null);
  assert.equal(state.secondsLeft, 0, 'عددِ غیرعددی نباید NaN به UI بدهد');
});

/*
 * «هر ثبت یک تأیید» — قلبِ تغییرِ رفتاری.
 *
 * سرور با هر ورود، تأییدِ مصرف‌نشده را مصرف می‌کند: `confirmed` (امروز تأییدی
 * گرفتیم) از `pending` (تأیید آماده برای ثبتِ بعدی) جدا می‌شود. اگر این دو
 * قاطی شوند، اپ بعد از یک بار ورود دیگر اسکن نمی‌خواهد و همان باگِ «یک تأیید
 * برای کلِ روز» برمی‌گردد — این بار فقط در UI، که بدتر است چون سرور ردش می‌کند.
 */
test('تأییدِ مصرف‌شده قفل را دوباره می‌بندد؛ تأییدِ مصرف‌نشده بازش می‌کند', () => {
  const consumed = presenceOf({
    required: true,
    enabled: true,
    confirmed: true,
    pending: false,
    lock: true,
    intent: 'start',
  });

  assert.equal(consumed.confirmed, true, 'روز را تأیید کرده بود');
  assert.equal(consumed.pending, false, 'ولی آن تأیید با ثبتِ قبلی خرج شده');
  assert.equal(consumed.lock, true, 'پس ورودِ تازه قفل است — همان چیزی که کم بود');
  assert.equal(presenceLocksPunch(consumed), true);

  const ready = presenceOf({ required: true, enabled: true, confirmed: true, pending: true, lock: false, intent: 'start' });

  assert.equal(ready.lock, false);
  assert.equal(presenceLocksPunch(ready), false, 'تأییدِ تازه همان ثبت را باز می‌کند');
});

test('خروج هم قفل است وقتی تأییدِ مصرف‌نشده‌ای نمانده — همان قاعدهٔ ورود', () => {
  // سرور برای هر دو نوبت یکسان قفل می‌کند؛ اپ هم باید همان را نشان دهد:
  // کارمند پشتِ شیفت، پیش از اثرِ انگشتِ خروج باید QR کارتِ خودش را اسکن کند.
  const inside = presenceOf({
    required: true,
    enabled: true,
    confirmed: true,
    pending: false,
    lock: true,
    intent: 'pause',
  });

  assert.equal(inside.intent, 'pause');
  assert.equal(presenceLocksPunch(inside), true, 'بستنِ شیفت هم تأییدِ تازه می‌خواهد');

  // تأییدِ تازه خروج را هم باز می‌کند — مثل ورود.
  const ready = presenceOf({
    required: true,
    enabled: true,
    confirmed: true,
    pending: true,
    lock: false,
    intent: 'pause',
  });

  assert.equal(presenceLocksPunch(ready), false, 'تأییدِ آماده خروج را هم باز می‌کند');
});

test('سرورِ قدیمی (بدونِ pending/lock) مثل قبل رفتار می‌کند', () => {
  const legacy = presenceOf({ required: true, enabled: true, confirmed: false });

  assert.equal(legacy.pending, false);
  assert.equal(legacy.lock, true);
  assert.equal(presenceLocksPunch(legacy), true);
});

test('اسکنر فقط وقتی باز می‌شود که لازم، روشن و قفل باشد', () => {
  const base = { enabled: true, required: true, confirmed: false, pending: false, lock: true, intent: 'start' as const, method: null, confirmedAt: null, secondsLeft: 20 };

  assert.equal(needsQrScan(base), true);
  assert.equal(needsQrScan({ ...base, lock: false, pending: true }), false);
  assert.equal(needsQrScan({ ...base, required: false }), false);
  assert.equal(needsQrScan({ ...base, enabled: false }), false);
});

test('قالبِ کد سنجیده می‌شود: پیشوند، ارقام و امضای ۱۶ کاراکتری', () => {
  assert.equal(looksLikeCode(OWN_CODE), true);
  assert.equal(looksLikeCode(`  ${OWN_CODE}  `), true, 'فاصلهٔ اضافه نباید رد کند');
  assert.equal(looksLikeCode('v1.60.1750000000.0F1E2D3C4B5A6978'), false, 'امضای سرور با حروف کوچک است');
  assert.equal(looksLikeCode('v2.60.1750000000.0f1e2d3c4b5a6978'), false, 'قالبِ عوض‌شده باید رد شود');
  assert.equal(looksLikeCode('https://meraat.piqagram.ir'), false, 'لینکِ معمولی کد نیست');
  assert.equal(looksLikeCode(''), false);
});

test('شناسهٔ صاحبِ کد از خودِ کد خوانده می‌شود', () => {
  assert.equal(codeCustomerId(OWN_CODE), 60);
  assert.equal(codeCustomerId('v1.7.1750000001.abcdef0123456789'), 7);
  assert.equal(codeCustomerId('چیزی-دیگر'), null);
});

test('QR همکار پیش از رفتن به سرور رد می‌شود', () => {
  assert.equal(localCodeProblem(OWN_CODE, 60), null, 'کدِ خودِ کارمند باید بی‌ایراد باشد');
  assert.match(String(localCodeProblem('v1.61.1750000000.0123456789abcdef', 60)), /یکی دیگر/);
  assert.match(String(localCodeProblem('', 60)), /خوانده نشد/);
  assert.match(String(localCodeProblem('v1.60.1750000000.zz', 60)), /مِرآت نیست/);
});

test('جملهٔ کارت با وضعیتِ واقعی می‌خواند', () => {
  const base = { enabled: true, required: true, confirmed: false, pending: false, lock: true, intent: 'start' as const, method: null, confirmedAt: null, secondsLeft: 20 };

  assert.equal(presenceNote({ ...base, enabled: false }), '', 'وقتی مسیر خاموش است چیزی گفته نمی‌شود');
  assert.match(presenceNote(base), /اسکن/);
  assert.match(presenceNote({ ...base, confirmed: true, pending: true, lock: false, method: 'qr' }), /QR/);
  assert.match(presenceNote({ ...base, confirmed: true, pending: true, lock: false, method: 'manual' }), /مدیر/);
  assert.match(
    presenceNote({ ...base, confirmed: true, pending: false, lock: true, intent: 'pause' }),
    /ورود یا خروج/,
    'برای خروج هم باید صریح گفته شود تأیید لازم است، نه اینکه رایگان به نظر برسد',
  );
});

/*
 * ترتیبِ «اول تأیید، بعد ثبت».
 *
 * اهمیتش این است که این تابع دقیقاً همان شرطی را می‌گوید که سرور در
 * `MobilePresence::blocksPunch` می‌سنجد؛ اگر یکی از این دو عوض شود و آن یکی
 * نه، یا کارمند درخواستِ محکوم‌به‌شکست می‌فرستد یا دکمه بی‌دلیل قفل می‌ماند.
 */
test('تا تأییدِ همین ثبت، دکمهٔ ثبت قفل است', () => {
  const base = { enabled: true, required: true, confirmed: false, pending: false, lock: true, intent: 'start' as const, method: null, confirmedAt: null, secondsLeft: 20, expiresAt: null };

  assert.equal(presenceLocksPunch(base), true);
  assert.equal(presenceLocksPunch({ ...base, pending: true, lock: false }), false, 'تأییدِ تازه قفل را باز می‌کند');
  assert.equal(presenceLocksPunch({ ...base, required: false }), false, 'تأییدِ نمایشی (required=false) قفلی نمی‌سازد');
  assert.equal(presenceLocksPunch({ ...base, enabled: false }), false, 'مسیرِ خاموش قفلی ندارد');
  assert.equal(presenceLocksPunch(undefined), false, 'پاسخِ ناقص/قدیمی نباید کارمند را پشتِ در نگه دارد');
});

test('جملهٔ قفل «چه کنم» را می‌گوید، نه فقط «نمی‌شود»', () => {
  assert.match(PUNCH_LOCK_NOTE, /QR/);
  assert.match(PUNCH_LOCK_NOTE, /ورود یا خروج/, 'جملهٔ قفل باید هر دو نوبت را پوشش دهد');
  assert.match(PUNCH_LOCK_NOTE, /اثرِ انگشت/, 'ترتیب باید گفته شود: اول اسکن، بعد اثرِ انگشت');
});

test('جملهٔ کارتِ تأییدنشده به اجباری‌بودن حساس است', () => {
  const base = { enabled: true, required: true, confirmed: false, pending: false, lock: true, intent: 'start' as const, method: null, confirmedAt: null, secondsLeft: 20, expiresAt: null };

  // اجباری: صریح می‌گوید «هر ثبتِ تازه تأیید می‌خواهد» تا کاربر بداند
  // چرا دوباره اسکن می‌خواهد، نه اینکه فکر کند اپ گیر کرده.
  assert.match(presenceNote(base), /هر ثبتِ تازه/);

  // نمایشی: همان جمله بدونِ ترساندنِ بی‌مورد.
  const optional = presenceNote({ ...base, required: false });
  assert.match(optional, /اسکن/);
  assert.doesNotMatch(optional, /هر ثبتِ تازه/);
});

/*
 * مهلتِ تأیید — ۳۰ ثانیه از لحظهٔ اسکن.
 *
 * قاعده‌ای که سرور اجرا می‌کند (`MobilePresence::punchWindow`): تأیید فقط
 * می‌گوید «همین حالا در برابرِ کارت بودم». اگر اپ این مهلت را نداند، دکمه
 * بعد از نیم دقیقه باز می‌ماند و کارمند ضربه‌ای می‌زند که سرور ردش می‌کند؛
 * اگر بداند، همان لحظه دوباره اسکن می‌خواهد.
 */
test('تأییدِ آماده مهلت می‌گیرد و شمارش از همان لحظهٔ پاسخ شروع می‌شود', () => {
  const now = 1_700_000_000_000;
  const state = presenceOf(
    { required: true, enabled: true, confirmed: true, pending: true, lock: false, intent: 'start', seconds_left: 30 },
    now,
  );

  assert.equal(state.expiresAt, now + 30_000, 'مهلت باید از ثانیه‌های سرور ساخته شود');
  assert.equal(presenceSecondsLeft(state, now), 30);
  assert.equal(presenceSecondsLeft(state, now + 10_000), 20);
  assert.equal(presenceSecondsLeft(state, now + 30_000), 0);
  assert.equal(presenceExpired(state, now + 29_999), false);
  assert.equal(presenceExpired(state, now + 30_000), true, 'در پایانِ مهلت منقضی است');
});

test('تأییدِ منقضی دوباره قفل است، حتی اگر سرور هنوز lock=false داده باشد', () => {
  const now = 1_700_000_000_000;
  const fresh = presenceOf(
    { required: true, enabled: true, confirmed: true, pending: true, lock: false, intent: 'start', seconds_left: 30 },
    now,
  );

  assert.equal(presenceLocksPunch(fresh, now + 5_000), false, 'در مهلت، دکمه باز است');
  assert.equal(presenceLocksPunch(fresh, now + 31_000), true, 'بعد از مهلت، دکمه قفل است');
  assert.match(presenceNote(fresh, now + 31_000), /دوباره QR/, 'جمله باید بگوید دوباره اسکن کن');
});

/*
 * «مهلت که گذشت، خودت دوباره بپرس» — خواستهٔ اصلیِ جریانِ خروج.
 *
 * کارمندی که برای خروج تأیید می‌کند فقط ۳۰ ثانیه وقت دارد؛ اگر اثرِ انگشت
 * را نزند، سرور ثبت را رد می‌کند. جمله باید کارِ بعدی را بگوید (دوباره اسکن،
 * بعد اثرِ انگشت) و برای خروج صریح باشد — نه یک «خطا داد»ِ گنگ.
 */
test('جملهٔ «مهلت تمام شد» کارِ بعدی را می‌گوید و برای خروج صریح است', () => {
  const base = { enabled: true, required: true, confirmed: true, pending: true, lock: false, intent: 'pause' as const, method: 'qr' as const, confirmedAt: null, secondsLeft: 30, expiresAt: null };

  const checkout = presenceReaskNote(base);

  assert.match(checkout, /خروج ثبت نشد/, 'برای خروج باید بگوید خودِ خروج ثبت نشد');
  assert.match(checkout, /QR/, 'راهِ حل باید گفته شود: اسکنِ دوباره');
  assert.match(checkout, /۳۰/, 'مهلت باید ذکر شود تا کارمند بداند چرا تمام شد');

  const entry = presenceReaskNote({ ...base, intent: 'start' });

  assert.doesNotMatch(entry, /خروج ثبت نشد/, 'جملهٔ ورود نباید از خروج حرف بزند');
  assert.match(entry, /ثبت انجام نشد/);
});

test('تأییدِ مصرف‌شده یا قدیمی مهلت نمی‌سازد (و NaN به UI نمی‌دهد)', () => {
  const consumed = presenceOf({ required: true, enabled: true, confirmed: true, pending: false, lock: true, intent: 'start', seconds_left: 0 });

  assert.equal(consumed.expiresAt, null);
  assert.equal(presenceSecondsLeft(consumed), 0);
  assert.equal(presenceExpired(consumed), false, 'تأییدی نیست، پس «منقضی» هم معنی ندارد');

  const legacy = presenceOf({ required: true, enabled: true, confirmed: true, pending: true, lock: false });
  assert.equal(legacy.expiresAt, null, 'سرورِ قدیمی اعداد نمی‌فرستد؛ نباید مهلتِ ساختگی بسازیم');
  assert.equal(presenceSecondsLeft(legacy), 0);
});
