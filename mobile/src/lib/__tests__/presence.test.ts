import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NO_PRESENCE,
  PUNCH_LOCK_NOTE,
  codeCustomerId,
  localCodeProblem,
  looksLikeCode,
  needsQrScan,
  presenceLocksPunch,
  presenceNote,
  presenceOf,
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

test('اسکنر فقط وقتی باز می‌شود که لازم، روشن و تأییدنشده باشد', () => {
  const base = { enabled: true, required: true, confirmed: false, method: null, confirmedAt: null, secondsLeft: 20 };

  assert.equal(needsQrScan(base), true);
  assert.equal(needsQrScan({ ...base, confirmed: true }), false);
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
  const base = { enabled: true, required: true, confirmed: false, method: null, confirmedAt: null, secondsLeft: 20 };

  assert.equal(presenceNote({ ...base, enabled: false }), '', 'وقتی مسیر خاموش است چیزی گفته نمی‌شود');
  assert.match(presenceNote(base), /اسکن/);
  assert.match(presenceNote({ ...base, confirmed: true, method: 'qr' }), /QR/);
  assert.match(presenceNote({ ...base, confirmed: true, method: 'manual' }), /مدیر/);
});

/*
 * ترتیبِ «اول تأیید، بعد ثبت».
 *
 * اهمیتش این است که این تابع دقیقاً همان شرطی را می‌گوید که سرور در
 * `MobilePresence::blocksPunch` می‌سنجد؛ اگر یکی از این دو عوض شود و آن یکی
 * نه، یا کارمند درخواستِ محکوم‌به‌شکست می‌فرستد یا دکمه بی‌دلیل قفل می‌ماند.
 */
test('تا تأییدِ حضور، ثبتِ ورود و خروج قفل است', () => {
  const base = { enabled: true, required: true, confirmed: false, method: null, confirmedAt: null, secondsLeft: 20 };

  assert.equal(presenceLocksPunch(base), true);
  assert.equal(presenceLocksPunch({ ...base, confirmed: true }), false, 'تأییدِ امروز قفل را باز می‌کند');
  assert.equal(presenceLocksPunch({ ...base, required: false }), false, 'تأییدِ نمایشی (required=false) قفلی نمی‌سازد');
  assert.equal(presenceLocksPunch({ ...base, enabled: false }), false, 'مسیرِ خاموش قفلی ندارد');
  assert.equal(presenceLocksPunch(undefined), false, 'پاسخِ ناقص/قدیمی نباید کارمند را پشتِ در نگه دارد');
});

test('جملهٔ قفل «چه کنم» را می‌گوید، نه فقط «نمی‌شود»', () => {
  assert.match(PUNCH_LOCK_NOTE, /QR/);
  assert.match(PUNCH_LOCK_NOTE, /کار نمی‌کند/);
});

test('جملهٔ کارتِ تأییدنشده به اجباری‌بودن حساس است', () => {
  const base = { enabled: true, required: true, confirmed: false, method: null, confirmedAt: null, secondsLeft: 20 };

  // اجباری: صریح می‌گوید ثبت کار نمی‌کند تا کاربر دنبالِ مشکلِ اشتباهی نرود.
  assert.match(presenceNote(base), /کار نمی‌کند/);

  // نمایشی: همان جمله بدونِ ترساندنِ بی‌مورد.
  const optional = presenceNote({ ...base, required: false });
  assert.match(optional, /اسکن/);
  assert.doesNotMatch(optional, /کار نمی‌کند/);
});
