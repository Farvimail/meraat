import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiError } from '../api.ts';
import { CONNECTION_RETRY_MS, connectionNote, reachableFromError } from '../connection.ts';

test('فقط خطای شبکه و تایم‌اوت یعنی «به سرور نرسیدیم»', () => {
  assert.equal(reachableFromError(new ApiError('network', 'به سرور وصل نشدیم.')), false);
  assert.equal(reachableFromError(new ApiError('timeout', 'پاسخی از سرور نگرفتیم.')), false);
});

test('هر پاسخی از سرور یعنی اتصال برقرار است — حتی ۴۰۱ و ۵۰۰', () => {
  assert.equal(reachableFromError(new ApiError('unauthorized', 'نشست بسته است.', 401)), true);
  assert.equal(reachableFromError(new ApiError('invalid_credentials', 'رمز غلط است.', 422)), true);
  assert.equal(reachableFromError(new ApiError('server', 'خطای سرور.', 500)), true);
  assert.equal(reachableFromError(new ApiError('outside_office_network', 'شبکهٔ محل کار نیست.', 403)), true);
  assert.equal(reachableFromError(new ApiError('bad_response', 'خوانا نبود.', 200)), true);
});

test('خطای ناشناخته پیامِ «اینترنت نیست» نمی‌گیرد', () => {
  assert.equal(reachableFromError(new Error('باگِ خودِ اپ')), true);
  assert.equal(reachableFromError('یه چیز عجیب'), true);
  assert.equal(reachableFromError(null), true);
});

test('جملهٔ وضعیت برای هر حالت', () => {
  assert.equal(connectionNote('checking'), 'در حال بررسی اتصال به سرور…');
  assert.match(connectionNote('offline'), /اینترنت/);
  assert.equal(connectionNote('online'), '');
});

test('فاصلهٔ تلاش خودکار عددِ مثبت و کوتاه است', () => {
  assert.ok(CONNECTION_RETRY_MS > 1000 && CONNECTION_RETRY_MS <= 30000);
});
