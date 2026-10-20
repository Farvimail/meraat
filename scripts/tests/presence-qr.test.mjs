/*
 * تستِ کدِ QR تأییدِ حضور.
 *
 * دو چیزِ متفاوت اینجا سنجیده می‌شود:
 *
 *   ۱) نسخهٔ **کلاسیک‌شدهٔ** کدگذار (`public/js/vendor/toqr.js`) که با یک تغییر
 *      از بستهٔ نصب‌شده ساخته می‌شود، برای چند رشته خروجیِ مو‌به‌مو برابرِ نسخهٔ
 *      اصلیِ ESM می‌دهد. بدونِ این تست، اگر روزی بسته عوض شود و اسکریپتِ
 *      vendor کارِ درست را نکند، فقط یک مربعِ سیاهِ بی‌معنی روی صفحه می‌ماند.
 *
 *   ۲) تابعِ `qrCells` در `public/js/panel-qr.js` — همان چیزی که کدِ سرور را به
 *      ماتریسِ نقطه‌ها تبدیل می‌کند: اندازهٔ درست، حاشیهٔ سفیدِ چهار ماژولی، و
 *      الگوی «یابنده» در گوشه‌ها (بدونِ آن هیچ دوربینی کد را پیدا نمی‌کند).
 *
 * چرا در node و بدونِ مرورگر: هر دو فایل کدِ خالص‌اند؛ فقط `document` لازم
 * دارند که اینجا با یک شیءِ کوچک جعل می‌شود. canvas لازم نیست چون تست،
 * ماتریس را می‌سنجد نه پیکسل‌ها را.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { toQR as referenceEncoder } from '../../mobile/node_modules/toqr/dist/toqr.mjs';

const vendorSource = readFileSync(
  new URL('../../public/js/vendor/toqr.js', import.meta.url),
  'utf8',
);
const panelSource = readFileSync(
  new URL('../../public/js/panel-qr.js', import.meta.url),
  'utf8',
);

/** کدهای نمونه‌ای که واقعاً روی کارتِ کارمند می‌نشینند. */
const SAMPLES = [
  // کدِ ثابتِ امروز: جای «پنجره» صفر است.
  'v1.12.0.0f1e2d3c4b5a6978',
  'v1.7.0.abcdef0123456789',
  // دو نمونهٔ قدیمیِ چرخان: کدگذار باید هر رشته‌ای را بکشد، حتی کدِ باطل؛
  // صفحه نباید به خاطرِ یک کدِ کهنه بشکند.
  'v1.12.1750000000.0f1e2d3c4b5a6978',
  'v1.103.1.0123456789abcdef',
];

/** نسخهٔ کلاسیک را همان‌طور که مرورگر بار می‌کند اجرا کن. */
function loadVendor(windowStub = {}) {
  new Function('window', vendorSource)(windowStub);

  return windowStub;
}

/**
 * `panel-qr.js` را با کمترین `document` ممکن اجرا کن.
 *
 * `querySelectorAll` عمداً خالی است: پس `start()` همان اول برمی‌گردد و این
 * تست فقط خودِ تابعِ تبدیلِ ماتریس را می‌سنجد، نه شبکه را.
 */
function loadPanel(windowStub = {}) {
  const document = {
    readyState: 'complete',
    hidden: false,
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
  };

  new Function('window', 'document', panelSource)(windowStub, document);

  return windowStub;
}

/** عرض/ارتفاعِ ماتریسِ یک کد در کدگذار. */
function matrixSize(flat) {
  return Math.round(Math.sqrt(flat.length));
}

test('نسخهٔ کلاسیکِ کدگذار همان خروجیِ نسخهٔ اصلی را می‌دهد', () => {
  const window = loadVendor();
  const toQR = window.MeraatQr && window.MeraatQr.toQR;

  assert.equal(typeof toQR, 'function', 'window.MeraatQr.toQR باید تابع باشد');

  for (const sample of SAMPLES) {
    const original = Array.from(referenceEncoder(sample));
    const vendored = Array.from(toQR(sample));

    assert.deepEqual(vendored, original, `خروجی برای ${sample} یکی نیست`);
  }
});

test('کدِ سرور به شکل v1.<کارمند>.<پنجره>.<امضا> است و کدگذار می‌خواندش', () => {
  const window = loadVendor();

  for (const sample of SAMPLES) {
    assert.match(sample, /^v1\.\d+\.\d+\.[0-9a-f]{16}$/, 'قالبِ کد عوض شده');
  }

  // کدِ ثابتِ واقعی: پنجره صفر است و اپِ نصب‌شده (که همین قالب را می‌سنجد)
  // بدونِ buildِ تازه آن را می‌پذیرد.
  assert.match(SAMPLES[0], /^v1\.12\.0\.[0-9a-f]{16}$/, 'کدِ ثابت باید پنجرهٔ صفر داشته باشد');

  const size = matrixSize(window.MeraatQr.toQR(SAMPLES[0]));

  assert.ok(size >= 21 && size <= 57, `اندازهٔ غیرمنتظره: ${size}`);
});

test('qrCells حاشیهٔ سفیدِ چهار ماژولی و الگوی یابنده را می‌سازد', () => {
  const window = loadVendor();
  loadPanel(window);

  const qr = window.MeraatPresenceQr;

  assert.equal(typeof qr.qrCells, 'function', 'MeraatPresenceQr.qrCells لازم است');
  assert.equal(qr.QUIET, 4, 'حاشیهٔ استانداردِ QR چهار ماژول است');

  const payload = SAMPLES[0];
  const flat = window.MeraatQr.toQR(payload);
  const size = matrixSize(flat);
  const cells = qr.qrCells(payload);
  const full = size + qr.QUIET * 2;

  assert.equal(cells.length, full, 'ارتفاع باید اندازه + دو حاشیه باشد');
  assert.equal(cells[0].length, full, 'عرض باید اندازه + دو حاشیه باشد');

  // کل حاشیه باید سفید (۰) باشد؛ وگرنه دوربین قابِ کد را پیدا نمی‌کند.
  for (let i = 0; i < full; i++) {
    for (let q = 0; q < qr.QUIET; q++) {
      assert.equal(cells[q][i], 0, `سطر ${q} (بالا) باید خالی باشد`);
      assert.equal(cells[full - 1 - q][i], 0, `سطر ${full - 1 - q} (پایین) باید خالی باشد`);
      assert.equal(cells[i][q], 0, `ستون ${q} (چپ) باید خالی باشد`);
      assert.equal(cells[i][full - 1 - q], 0, `ستون ${full - 1 - q} (راست) باید خالی باشد`);
    }
  }

  // الگوی یابنده: هفت ماژولِ پُر در گوشهٔ بالا-چپِ خودِ کد.
  const finderRow = cells[qr.QUIET].slice(qr.QUIET, qr.QUIET + 7);

  assert.deepEqual(finderRow, [1, 1, 1, 1, 1, 1, 1], 'ردیفِ اولِ الگوی یابنده');
  assert.equal(flat.slice(0, 7).join(''), '1111111', 'جابه‌جاییِ سطرها درست باشد');
});

test('بدونِ کدگذار، qrCells بی‌صدا null می‌دهد (صفحه نمی‌شکند)', () => {
  const window = loadPanel({});

  assert.equal(window.MeraatPresenceQr.qrCells('v1.1.1.abcdef0123456789'), null);
});

test('کدِ نامعتبر (ماتریسِ نامربع) رد می‌شود', () => {
  const window = loadVendor();
  loadPanel(window);

  // کدگذارِ جعلی که طولِ غیرمربع برمی‌گرداند.
  window.MeraatQr = { toQR: () => new Uint8Array(10) };

  assert.equal(window.MeraatPresenceQr.qrCells('x'), null);
});

/*
 * کدِ ثابت دیگر چرخهٔ ۳۰ ثانیه‌ای ندارد.
 *
 * صفحهٔ اصلیِ حضور عمومی است و کدها را بی‌نشست می‌گیرد؛ اگر اسکریپت مثل قبل
 * هر ۳۰ ثانیه درخواست می‌زد، برای کدی که هرگز عوض نمی‌شود هر دقیقه دو
 * درخواست به سرور می‌رفت. این تست همان تحدید را نگه می‌دارد.
 */
function loadPanelStatic() {
    const timers = [];
    const fetched = [];

    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {} }),
    };

    const badge = {
        hidden: false,
        attrs: { 'data-customer-id': '12' },
        getAttribute(name) {
            return name in this.attrs ? this.attrs[name] : null;
        },
        setAttribute(name, value) {
            this.attrs[name] = String(value);
        },
        querySelector: (selector) => (selector === 'canvas' ? canvas : null),
        closest: () => null,
        classList: { add() {}, remove() {} },
        scrollIntoView() {},
    };

    const document = {
        readyState: 'complete',
        hidden: false,
        addEventListener() {},
        querySelectorAll(selector) {
            return selector === '[data-presence-qr]' ? [badge] : [];
        },
        querySelector() {
            return null;
        },
    };

    const fetchStub = (url) => {
        fetched.push(String(url));

        return Promise.resolve({
            status: 200,
            ok: true,
            json: () =>
                Promise.resolve({
                    // دقیقاً همان پاسخِ سرور برای کاربرِ بدونِ نشست:
                    // بدونِ `confirmed` و بدونِ `expires_in`.
                    mode: 'static',
                    enabled: true,
                    required: true,
                    codes: { 12: 'v1.12.0.0f1e2d3c4b5a6978' },
                }),
        });
    };

    const window = loadVendor();

    new Function('window', 'document', 'fetch', 'FormData', 'setTimeout', panelSource)(
        window,
        document,
        fetchStub,
        class {
            append() {}
        },
        (fn) => {
            timers.push(fn);
            return timers.length;
        },
    );

    return { window, canvas, timers, fetched, badge };
}

/** صبر می‌کند تا زنجیرهٔ promiseهای `load()` تمام شود. */
async function settle() {
    for (let i = 0; i < 6; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

test('کدِ ثابت یک بار کشیده می‌شود و هیچ تازه‌سازیِ دوره‌ای ندارد', async () => {
    const panel = loadPanelStatic();
    await settle();

    assert.equal(panel.fetched.length, 1, 'فقط یک درخواست برای صفحهٔ کدِ ثابت');
    assert.equal(panel.timers.length, 0, 'کدِ ثابت تایمرِ تازه‌سازی ندارد');
    assert.ok(panel.canvas.width > 0, 'کد باید روی canvas کشیده شده باشد');
    assert.equal(panel.badge.hidden, false, 'کدِ ثابت باید دیده شود (دسترسیِ عمومی)');
});

/*
 * دکمهٔ «تأیید دستیِ حضور» در بخشِ «کارمندها»ی پنل مدیریت.
 *
 * این صفحه **هیچ کارتِ QR ندارد**؛ اگر `start()` مثل قبل با «نبودِ نشانهٔ QR»
 * برمی‌گشت، دکمه بی‌صدا بی‌اثر می‌ماند و هیچ خطایی هم دیده نمی‌شد. پایین همان
 * صفحه شبیه‌سازی می‌شود: یک دکمه، صفر نشانهٔ QR، و یک کلیک.
 */
function loadPanelWithButton() {
  const calls = [];
  const listeners = {};

  const button = {
    textContent: 'تأیید دستیِ حضور',
    disabled: false,
    classes: new Set(),
    attrs: { 'data-presence-confirm-manual': '12' },
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
  };

  button.classList = {
    add: (name) => button.classes.add(name),
    remove: (name) => button.classes.delete(name),
  };

  const document = {
    readyState: 'complete',
    hidden: false,
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    querySelectorAll(selector) {
      return selector === '[data-presence-confirm-manual]' ? [button] : [];
    },
    querySelector() {
      return { getAttribute: () => 'csrf' };
    },
  };

  const fetchStub = (url) => {
    calls.push(String(url));

    return Promise.resolve({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve(
          String(url).indexOf('qr-confirm-manual') >= 0
            ? { confirmed: { method: 'manual', at: '2026-10-17 09:12:00' } }
            : { codes: {}, confirmed: {}, expires_in: 30 },
        ),
    });
  };

  const formData = class {
    append() {}
  };

  new Function('window', 'document', 'fetch', 'FormData', 'setTimeout', panelSource)(
    {},
    document,
    fetchStub,
    formData,
    () => 0,
  );

  return { button, calls, listeners };
}

test('دکمهٔ تأییدِ دستی در صفحه‌ای بدونِ کارتِ QR کار می‌کند', async () => {
  const panel = loadPanelWithButton();
  const clicks = panel.listeners.click || [];

  assert.equal(clicks.length, 1, 'شنوندهٔ کلیک باید حتی بدونِ نشانهٔ QR ثبت شود');
  assert.equal(panel.calls.length, 1, 'یک بار وضعیتِ تأیید خوانده می‌شود');

  clicks[0]({
    target: { closest: (selector) => (selector === '[data-presence-confirm-manual]' ? panel.button : null) },
    preventDefault() {},
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(panel.calls.length, 2, 'کلیک باید یک درخواستِ ثبت بفرستد');
  assert.match(panel.calls[1], /qr-confirm-manual/);
  assert.equal(panel.button.textContent, 'حضور تأیید شد', 'بازخورد روی خودِ دکمه بنشیند');
  assert.ok(panel.button.classes.has('is-confirmed'), 'حالتِ سبزِ تأییدشده');
});

/*
 * «کارتِ من را بزرگ نشان بده» — کارمند در اپ اسکنرِ QR را باز می‌کند، سوکت
 * خبر می‌دهد و `timer.js` آن را به رویدادِ DOM تبدیل می‌کند. سنجیدنِ این مسیر
 * ارزشش را دارد چون بدونِ آن هیچ خطایی دیده نمی‌شود: کارت فقط بزرگ نمی‌شود و
 * کارمند فکر می‌کند اپ کار نمی‌کند.
 *
 * صفحه با یک کارت (شناسهٔ ۱۲) جعل می‌شود، همان‌جوری که بلید می‌سازد.
 */
function loadPanelWithCard() {
    const listeners = {};
    const badges = [];
    const holders = {};
    const timers = [];
    const fetched = [];

    // پاسخِ دوم، حضورِ ۱۲ را تأییدشده می‌کند؛ با آن مسیرِ «جمع‌کردنِ خودکار
    // بعد از تأیید» هم سنجیده می‌شود.
    const fetchStub = (url) => {
        fetched.push(String(url));
        const second = fetched.length > 1;

        return Promise.resolve({
            status: 200,
            ok: true,
            json: () =>
                Promise.resolve({
                    codes: { 12: 'v1.12.1750000000.0f1e2d3c4b5a6978' },
                    confirmed: second ? { 12: { method: 'qr', at: '2026-10-17 09:00:00' } } : {},
                    expires_in: 30,
                }),
        });
    };

    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {} }),
    };

    const holder = {
        classes: new Set(),
        classList: {
            add: (name) => holder.classes.add(name),
            remove: (name) => holder.classes.delete(name),
            contains: (name) => holder.classes.has(name),
        },
    };

    const badge = {
        hidden: false,
        scrolled: 0,
        attrs: { 'data-customer-id': '12' },
        getAttribute(name) {
            return name in this.attrs ? this.attrs[name] : null;
        },
        setAttribute(name, value) {
            this.attrs[name] = String(value);
        },
        querySelector: (selector) => (selector === 'canvas' ? canvas : null),
        closest: (selector) => (selector === '.presence-photo' ? holder : null),
        scrollIntoView: () => {
            badge.scrolled += 1;
        },
    };

    badge.classList = { add() {}, remove() {} };
    badges.push(badge);
    holders['12'] = holder;

    const document = {
        readyState: 'complete',
        hidden: false,
        addEventListener(type, fn) {
            (listeners[type] = listeners[type] || []).push(fn);
        },
        querySelectorAll(selector) {
            return selector === '[data-presence-qr]' ? badges : [];
        },
        querySelector() {
            return { getAttribute: () => 'csrf' };
        },
    };

    // تایمرِ جعلی: چرخهٔ ۳۰ ثانیه‌ای اینجا با یک فراخوانیِ دستی جلو می‌رود.
    const fakeTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };

    const window = loadVendor();

    new Function('window', 'document', 'fetch', 'FormData', 'setTimeout', panelSource)(
        window,
        document,
        fetchStub,
        class {
            append() {}
        },
        fakeTimeout,
    );

    /** یک چرخهٔ تازه‌سازی را جلو می‌برد و صبر می‌کند تا تمام شود. */
    async function tick() {
        const next = timers.shift();

        if (next) {
            next();
        }

        for (let i = 0; i < 4; i++) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    return { window, document, listeners, badge, holder, canvas, timers, tick, fetched };
}

/** رویدادی که `timer.js` از پیامِ سوکت می‌سازد. */
function focusEvent(id) {
    return { detail: { id: String(id) } };
}

/** همان رویداد با نوعِ درست (برای سنجیدنِ ناشناخته‌ها). */
function blurEvent(id) {
    return { detail: { id: String(id) } };
}

test('خبرِ سوکت کارتِ همان کارمند را بزرگ می‌کند و کد را با پیکسلِ بیشتر می‌کشد', async () => {
    const panel = loadPanelWithCard();
    await panel.tick();

    const size = panel.window.MeraatPresenceQr.qrCells('v1.12.1750000000.0f1e2d3c4b5a6978').length;
    const normal = size * 4;
    const zoomed = size * panel.window.MeraatPresenceQr.MODULE_PX_SPOTLIGHT;

    assert.equal(panel.canvas.width, normal, 'اندازهٔ عادیِ کد روی canvas');

    const focus = panel.listeners['meraat:qr-focus'];

    assert.ok(focus && focus.length, 'شنوندهٔ رویدادِ بزرگ‌نمایی باید ثبت شده باشد');

    focus[0](focusEvent(12));

    assert.ok(panel.holder.classes.has('is-spotlight'), 'کارت باید حالتِ بزرگ‌شده بگیرد');
    assert.equal(panel.badge.scrolled, 1, 'کارت باید داخلِ دید بیاید؛ کارمند نباید اسکرول کند');
    assert.equal(panel.canvas.width, zoomed, 'کد در حالتِ بزرگ‌شده باید پیکسلِ بیشتری داشته باشد');
});

test('خبرِ کارمندی که کارتش روی این صفحه نیست، کارِ کسی را خراب نمی‌کند', async () => {
    const panel = loadPanelWithCard();
    await panel.tick();

    panel.listeners['meraat:qr-focus'][0](focusEvent(12));
    panel.listeners['meraat:qr-focus'][0](focusEvent(99));

    assert.ok(
        panel.holder.classes.has('is-spotlight'),
        'کارتِ ۱۲ باید بزرگ بماند؛ صفحهٔ دیگری کارتِ ۹۹ را دارد',
    );
    assert.equal(panel.badge.scrolled, 1, 'دوباره اسکرول نمی‌شود');
});

test('با تأییدِ حضور، بزرگ‌نمایی خودش جمع می‌شود و کد به اندازهٔ عادی برمی‌گردد', async () => {
    const panel = loadPanelWithCard();
    await panel.tick();

    panel.listeners['meraat:qr-focus'][0](focusEvent(12));
    assert.ok(panel.holder.classes.has('is-spotlight'));

    const zoomed = panel.canvas.width;

    await panel.tick();

    assert.ok(!panel.holder.classes.has('is-spotlight'), 'بعد از تأیید، کارت جمع می‌شود');
    assert.ok(panel.canvas.width < zoomed, 'کد هم به اندازهٔ عادی برمی‌گردد');
});

test('با بسته شدنِ اسکنر (qr-blur) کارت همان لحظه جمع می‌شود؛ نه بعد از ۴۵ ثانیه', async () => {
    const panel = loadPanelWithCard();
    await panel.tick();

    const blur = panel.listeners['meraat:qr-blur'];

    assert.ok(blur && blur.length, 'شنوندهٔ qr-blur باید ثبت شده باشد');

    panel.listeners['meraat:qr-focus'][0](focusEvent(12));
    assert.ok(panel.holder.classes.has('is-spotlight'));

    const zoomed = panel.canvas.width;

    // بلورِ کارمندِ دیگر نباید کارتِ در حالِ بزرگیِ ما را جمع کند.
    blur[0](blurEvent(99));
    assert.ok(panel.holder.classes.has('is-spotlight'), 'qr-blurِ کارمندِ دیگر نباید اثری داشته باشد');

    blur[0](blurEvent(12));

    assert.ok(!panel.holder.classes.has('is-spotlight'), 'بستنِ اسکنر باید کارت را همان لحظه جمع کند');
    assert.ok(panel.canvas.width < zoomed, 'کد باید به اندازهٔ عادی برگردد');
});

/*
 * جلوی یک اشتباهِ آسانِ انسانی را می‌گیرد: «تأیید دستی» کارِ مدیر است و
 * جایش بخشِ «کارمندها»ی پنل است، نه کارت‌های صفحهٔ اصلیِ حضور و غیاب — و پنل
 * فقط وقتی دکمه‌اش کار می‌کند که خودِ اسکریپت را هم بار کند.
 */
test('دکمهٔ تأییدِ دستی در پنل است (نه در صفحهٔ اصلی) و اسکریپتش بار می‌شود', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

  const panelLayout = read('../../resources/views/layouts/panel.blade.php');
  const manager = read('../../resources/views/manager.blade.php');
  const attendance = read('../../resources/views/customer.blade.php');

  assert.match(panelLayout, /js\/panel-qr\.js/, 'پوستهٔ پنل باید اسکریپتِ تأییدِ حضور را بیاورد');
  assert.match(panelLayout, /js\/vendor\/toqr\.js/, 'کدگذارِ QR باید همان‌جا باشد');
  // نوارِ «QR شما» و علامتِ بزرگ‌نمایی باید در مارک‌آپِ همان صفحه باشد؛ وگرنه
  // JS کلاس را می‌گذارد ولی چیزی دیده نمی‌شود.
  assert.match(attendance, /data-presence-spotlight-note/, 'نوارِ «QR شما» باید روی کارتِ کارمند باشد');
  assert.match(read('../../public/js/timer.js'), /meraat:qr-focus/, 'پلِ سوکت در timer.js باید باشد');
  assert.match(read('../../public/js/timer.js'), /meraat:qr-blur/, 'پلِ سوکت باید qr-blur را هم رد کند');
  assert.match(read('../../ws/timer-hub.mjs'), /qr-focus/, 'هاب باید نوعِ پیامِ بزرگ‌نمایی را بشناسد');
  assert.match(manager, /data-presence-confirm-manual/, 'دکمه در بخشِ «کارمندها»ی پنل باشد');
  assert.doesNotMatch(
    attendance,
    /data-presence-confirm-manual/,
    'صفحهٔ اصلیِ حضور و غیاب جای QR است، نه دکمهٔ مدیر',
  );
});
