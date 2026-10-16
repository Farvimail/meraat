import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarSources } from '../avatar.ts';
import { API_ORIGIN, DEFAULT_AVATAR, DEFAULT_AVATAR_VERSION } from '../config.ts';

test('کارمندِ بی‌عکس فقط عکسِ پیش‌فرض را می‌گیرد، نه حروفِ اول', () => {
  const sources = avatarSources(null);

  assert.equal(sources.length, 1, 'فقط یک نشانی: عکسِ پیش‌فرضِ سرور');
  assert.equal(sources[0], `${API_ORIGIN}/images/users/PRP.jpg?v=${DEFAULT_AVATAR_VERSION}`);
});

test('نشانیِ عکسِ پیش‌فرض نسخه دارد تا فایلِ تازهٔ سرور از کشِ گوشی رد شود', () => {
  assert.ok(DEFAULT_AVATAR_VERSION.length > 0, 'نسخه باید مقدار داشته باشد');
  assert.ok(
    DEFAULT_AVATAR.includes(`?v=${DEFAULT_AVATAR_VERSION}`),
    'بدون `?v=` گوشی همان تصویرِ کش‌شدهٔ قدیمی را نگه می‌دارد',
  );
});

test('عکسِ خودِ کارمند اول است و عکسِ پیش‌فرض پشتوانهٔ دوم', () => {
  const sources = avatarSources('a1b2c3.jpg');

  assert.equal(sources.length, 2);
  assert.equal(sources[0], `${API_ORIGIN}/images/users/a1b2c3.jpg`);
  assert.match(
    sources[1],
    /\/images\/users\/PRP\.jpg\?v=/,
    'اگر عکسِ خودش باز نشود باید چهرهٔ پیش‌فرض بیاید، نه حروفِ اول',
  );
});

test('نامِ فایل با فاصله یا حرفِ فارسی درست کد می‌شود', () => {
  const sources = avatarSources(' عکس من.jpg ');

  assert.equal(sources[0], `${API_ORIGIN}/images/users/${encodeURIComponent('عکس من.jpg')}`);
});

test('رشتهٔ خالی یا فقط فاصله یعنی «عکس ندارد»', () => {
  assert.equal(avatarSources('').length, 1);
  assert.equal(avatarSources('   ').length, 1);
  assert.equal(avatarSources(undefined).length, 1);
});
