/*
 * ساختِ نسخهٔ کلاسیکِ `toqr` برای پنل: `public/js/vendor/toqr.js`.
 *
 * چرا لازم است: پنل باید کدِ QR را در مرورگر بکشد و پروژه برای `public/js`
 * سیستمِ build ندارد (همهٔ فایل‌ها با <script> ساده بار می‌شوند). بستهٔ `toqr`
 * فقط به‌شکل ES module منتشر می‌شود و بارگذاریِ ES module به MIME درستِ سرور
 * و انتظارِ async وابسته است؛ در حالی که اینجا فقط یک تابع می‌خواهیم.
 *
 * کارِ این اسکریپت دقیقاً یک تغییر است: آخرین خطِ بسته
 * (`export { toQR };`) به `window.MeraatQr = { toQR };` تبدیل می‌شود و کل فایل
 * داخلِ یک IIFE می‌نشیند؛ به‌علاوه یک سرصفحهٔ توضیحی/انتساب بالای فایل.
 *
 * اجرا (پس از هر بار به‌روزرسانیِ `toqr` در اپ):
 *     node scripts/vendor-toqr.mjs
 * سپس همین فایل را کامیت کن. درستیِ خروجی با
 * `node --test scripts/tests/presence-qr.test.mjs` سنجیده می‌شود: مقدارِ
 * برگشتیِ نسخهٔ کلاسیک با نسخهٔ اصلیِ ESM مو‌به‌مو مقایسه می‌شود.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';

const SOURCE = 'mobile/node_modules/toqr/dist/toqr.mjs';
const TARGET = 'public/js/vendor/toqr.js';

const version = JSON.parse(
  readFileSync('mobile/node_modules/toqr/package.json', 'utf8'),
).version;

const original = readFileSync(SOURCE, 'utf8');

if (!original.includes('export { toQR };')) {
  throw new Error(`شکلِ بستهٔ toqr عوض شده: خطِ export در ${SOURCE} پیدا نشد.`);
}

const body = original
  .replace('export { toQR };', 'window.MeraatQr = { toQR };')
  .replace(/\/\/# sourceMappingURL=.*\n?/, '');

const header = `/*!
 * toqr v${version} — کدگذارِ کوچکِ QR — https://github.com/kitten/toqr
 * MIT License, Copyright (c) Phil Pluckthun and 650 Industries, Inc. (Expo).
 *
 * چرا اینجا کپی شده و از CDN بار نمی‌شود: پنل باید بدونِ اینترنتِ بیرون هم کدِ
 * QR را بکشد، و پروژه برای public/js سیستمِ build ندارد تا بسته را bundle کند.
 *
 * تغییرِ واحد نسبت به نسخهٔ اصلی: خطِ آخر (export) به window.MeraatQr تبدیل
 * شده و کل فایل در یک IIFE نشسته تا با <script> کلاسیک بار شود. هیچ خطِ
 * دیگری دست نخورده؛ همین را scripts/vendor-toqr.mjs می‌سازد.
 *
 * صحت: scripts/tests/presence-qr.test.mjs خروجیِ همین فایل را برای چند رشته با
 * نسخهٔ اصلیِ نصب‌شده مقایسه می‌کند.
 */
(function () {
"use strict";

`;

writeFileSync(TARGET, `${header}${body}\n})();\n`);

console.log(`نوشته شد: ${TARGET} (${statSync(TARGET).size} بایت، toqr v${version})`);
