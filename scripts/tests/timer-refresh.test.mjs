/*
  بررسیِ رفتارِ زمانیِ تایمرِ پنل (public/js/timer.js) بدون مرورگر و بدون سرور.

  چرا لازم است: صفحهٔ پنل به لاراول و دیتابیس وصل است و اینجا بالا نمی‌آید، ولی
  منطقِ «هر چند وقت یک‌بار تازه شود» خودش مستقل است. این اسکریپت همان فایل را در
  یک محیطِ ساختگی می‌نشاند و می‌سنجد:

    ۱) شیفتِ باز  → تازه‌سازیِ بعدی ۱۵ ثانیه
    ۲) شیفتِ بسته → تازه‌سازیِ بعدی ۶۰ ثانیه
    ۳) تبِ پنهان  → تازه‌سازیِ بعدی ۱۲۰ ثانیه
    ۴) برگشتنِ تب → همان لحظه یک درخواست برای همهٔ کارت‌ها، و هیچ زنجیرهٔ موازی
    ۵) ثبتِ گوشی → پیدا شدن با درخواستِ سبک و خواندنِ فقط همان کارت
    ۶) کارمندِ بی‌ثبتِ امروز هم «دیده» می‌شود (اولین ورودِ روز در پنل دیده شود)
    ۷) فاصلهٔ نگهبانِ سبک یک ثانیه است و روزِ خالی زنجیرهٔ دوره‌ای نمی‌کارد
    ۸) شروعِ نگهبان بعد از پایانِ بارگذاریِ صفحه، نه وسطِ آن
    ۹) چیپِ وضعیتِ کانال: «دوره‌ای» ↔ «زنده» و تعدادِ پنل‌های باز
    ۱۰) بودنِ چیپ در پارشالِ مشترک و در هر دو نوار بالا (پنل و حضور و غیاب)
    ۱۱) کارتِ رسم‌شده با پاسخِ خالی هم در هر دو مسیرِ زنده ثبت می‌شود
        (ثبتِ گوشی بعد از «ثبت حضور» باید بی‌رفرش در سایت دیده شود)
    ۱۲) خطای گذرا (۵۰۲/۵۰۰) نگهبان را خاموش نمی‌کند: مکثِ روبه‌رشد تا سقف،
        و بعد از سالم شدنِ سرور برگشت به فاصلهٔ عادی

  اجرا:  node scripts/tests/timer-refresh.test.mjs
*/
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../public/js/timer.js'), 'utf8');

/** یک صفحهٔ ساختگی با تایمرهای قابل‌شمارش. */
function sandbox() {
  const timers = [];        // {id, delay, fn}
  const intervals = [];
  const ajaxCalls = [];
  let nextId = 1;
  let visibility = null;

  /*
   * هر سلکتور یک عنصرِ ثابت دارد (مثل خودِ DOM)؛ وگرنه `Interval` روی یک شیء
   * می‌نویسد و تست نمی‌تواند همان چیزی را بخواند که کاربر می‌بیند.
   */
  const elements = new Map();
  const elementOf = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '' });
    return elements.get(selector);
  };

  /** چیپ‌های وضعیتِ کانالِ زندهٔ همین صفحه (مثل مارک‌آپِ بلید). */
  const chips = [];

  /*
   * سوکتِ ساختگی.
   *
   * هاب در این تست بالا نمی‌آید (تستِ خودش را دارد)؛ اینجا فقط می‌خواهیم بدانیم
   * خودِ `timer.js` در برابرِ باز/بسته شدنِ سوکت و پیام‌های هاب چه می‌کند —
   * چیزی که تا وقتی کسی مرورگر را باز نکرده، کشف‌نشدنی است. هر سوکتی که کد
   * بسازد اینجا نگه داشته می‌شود تا تست رویدادها را از بیرون بزند.
   */
  const sockets = [];

  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }

    send(data) {
      this.sent.push(String(data));
    }

    open() {
      this.readyState = 1;
      this.onopen?.();
    }

    message(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }

    /** هم بستنِ عادی و هم مردنِ سوکت (هر دو `onclose` می‌دهند). */
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }

  const documentStub = {
    hidden: false,
    addEventListener: (type, fn) => {
      if (type === 'visibilitychange') visibility = fn;
    },
    querySelector: elementOf,
    querySelectorAll: (selector) => (selector === '[data-timer-hub-status]' ? chips : []),
    ready: () => undefined,
  };

  let onLoad = null;

  const windowStub = {};
  /* `window` را هم مثل DOM لازم داریم: شروعِ نگهبان تا `load` صبر می‌کند. */
  windowStub.addEventListener = (type, fn) => {
    if (type === 'load') onLoad = fn;
  };

  /*
   * یک jQueryِ ساختگی که هر متدی را می‌پذیرد و هیچ‌کاری نمی‌کند؛ فقط `attr`
   * مقدارِ توکنِ CSRF را می‌دهد (همان چیزی که کدِ تایمر می‌خواند).
   */
  const jqObject = () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'attr') return () => 'csrf';
          if (prop === 'length') return 0;
          if (prop === 'forEach') return () => undefined;
          return () => jqObject();
        },
      },
    );

  const $stub = (arg) => {
    if (typeof arg === 'function') {
      arg();                        // $(document).ready(fn)
      return jqObject();
    }

    return jqObject();
  };
  $stub.ajaxSetup = () => undefined;

  /*
   * دو مسیر داریم و پاسخ هرکدام جداست:
   *   /read/timer           → رکوردهای امروزِ یک کارمند
   *   /read/timer-revision  → «انگشتِ تغییر» همهٔ کارت‌ها در یک درخواست
   * همچنین `__revisionFails` رفتارِ سروری را شبیه‌سازی می‌کند که این مسیر را
   * ندارد (نسخهٔ قدیمیِ کد).
   */
  $stub.ajax = (options) => {
    const isRevision = String(options.url).indexOf('timer-revision') >= 0;

    ajaxCalls.push(options);

    if (isRevision && documentStub.__revisionFails) {
      // مقدارِ عددی یعنی وضعیتِ همان خطا (۵۰۲ وسطِ استقرار)؛ `true` یعنی
      // «این مسیر اصلاً نیست» (نسخهٔ قدیمیِ کد → ۴۰۴).
      const status = typeof documentStub.__revisionFails === 'number'
        ? documentStub.__revisionFails
        : 404;

      // مثلِ خودِ jQuery: اول `error` بعد `complete` — وگرنه نگهبان پیش از
      // شنیدنِ خطا زمان‌بندی می‌شود و بررسیِ «پس از خطا چه فاصله‌ای می‌گیرد»
      // بی‌معنا می‌شود.
      options.error?.({ status }, 'error', status === 404 ? 'Not Found' : 'Server Error');
      options.complete?.({ status }, 'error');
      return { done: () => ({ fail: () => undefined }), fail: () => undefined };
    }

    const body = isRevision
      ? documentStub.__revisions ?? '{}'
      : documentStub.__payload ?? '[]';

    options.success?.(body, 'success', { getResponseHeader: () => null });
    options.complete?.({ status: 200 }, 'success');

    return { done: () => ({ fail: () => undefined }), fail: () => undefined };
  };

  const context = createContext({
    window: windowStub,
    document: documentStub,
    // `timer.js` بدونِ `location` و `WebSocket` سراغِ سوکت نمی‌رود.
    location: { protocol: 'https:', host: 'panel.test' },
    WebSocket: FakeSocket,
    $: $stub,
    console: { log: () => undefined, error: () => undefined },
    JSON,
    Date,
    Object,
    Array,
    Number,
    String,
    Math,
    RegExp,
    setTimeout: (fn, delay) => {
      const id = nextId++;
      timers.push({ id, delay, fn });
      return id;
    },
    clearTimeout: (id) => {
      const at = timers.findIndex((timer) => timer.id === id);
      if (at >= 0) timers.splice(at, 1);
    },
    setInterval: (fn, delay) => {
      const id = nextId++;
      intervals.push({ id, delay, fn });
      return id;
    },
    clearInterval: (id) => {
      const at = intervals.findIndex((timer) => timer.id === id);
      if (at >= 0) intervals.splice(at, 1);
    },
  });

  windowStub.window = windowStub;

  runInContext(source, context, { filename: 'timer.js' });

  return {
    context,
    documentStub,
    timers,
    ajaxCalls,
    /** خالی‌کردنِ تایمرهای معلق تا هر بند از صفر شروع شود. */
    clearTimers: () => {
      timers.length = 0;
    },
    revisionCalls: () => ajaxCalls.filter((call) => String(call.url).indexOf('timer-revision') >= 0),
    cardReads: () => ajaxCalls.filter((call) => String(call.url).indexOf('timer-revision') < 0),
    /** تایمرهای تازه‌سازیِ خودِ کارت‌ها (نه نگهبانِ revision). */
    cardTimers: () => timers.filter((timer) => String(timer.fn).indexOf('runTimer') >= 0),
    element: elementOf,
    sockets,
    /**
     * یک چیپِ وضعیتِ ساختگی مثل همان که `partials/timer-hub-chip.blade.php`
     * می‌سازد.
     * فقط همان سه چیزی را دارد که `timer.js` لمس می‌کند.
     */
    makeChip: () => {
      const label = { textContent: '' };
      const peers = { textContent: '' };

      const chip = {
        state: null,
        setAttribute: (name, value) => {
          if (name === 'data-state') chip.state = value;
        },
        querySelector: (selector) => {
          if (selector === '[data-timer-hub-label]') return label;
          if (selector === '[data-timer-hub-peers]') return peers;
          return null;
        },
        label,
        peers,
      };

      chips.length = 0;
      chips.push(chip);

      return chip;
    },
    revisionTimers: () => timers.filter((timer) => String(timer.fn).indexOf('checkTimerRevisions') >= 0),
    intervalCount: () => intervals.length,
    fireVisibility: (hidden) => {
      documentStub.hidden = hidden;
      visibility?.();
    },
    /** نزدیک‌ترین تازه‌سازیِ در انتظار برای یک کارمند. */
    pendingDelays: () => timers.map((timer) => timer.delay),
    /** پایانِ بارگذاریِ صفحه (همان `window.load`). */
    fireLoad: () => onLoad?.(),
  };
}

const openShift = JSON.stringify([{ time: '08:00:00', start: 1, pause: 0 }]);
const closedShift = JSON.stringify([
  { time: '08:00:00', start: 1, pause: 0 },
  { time: '17:00:00', start: 0, pause: 1 },
]);

// ۱) شیفتِ باز → ۱۵ ثانیه
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.__payload = openShift;
  runInContext('runTimer(7, "کارمند هفت", true)', app.context);

  assert.equal(app.ajaxCalls.length, 1, 'یک درخواست برای یک کارمند');
  assert.equal(app.cardTimers().length, 1, 'فقط یک زنجیرهٔ تازه‌سازی');
  assert.equal(app.cardTimers()[0].delay, 15000, 'شیفتِ باز باید ۱۵ ثانیه باشد');
  assert.equal(app.intervalCount(), 1, 'قدم‌شمارِ ثانیه‌ای باید روشن شود');
  console.log('✔ شیفتِ باز → تازه‌سازی هر ۱۵ ثانیه');
}

// ۲) شیفتِ بسته → ۶۰ ثانیه و بدون قدم‌شمار
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.__payload = closedShift;
  runInContext('runTimer(9, "کارمند نه", true)', app.context);

  assert.equal(app.cardTimers()[0].delay, 60000, 'شیفتِ بسته باید ۶۰ ثانیه باشد');
  assert.equal(app.intervalCount(), 0, 'شیفتِ بسته قدم‌شمار لازم ندارد');
  console.log('✔ شیفتِ بسته → تازه‌سازی هر ۶۰ ثانیه');
}

// ۳) تبِ پنهان → ۱۲۰ ثانیه
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.hidden = true;
  app.documentStub.__payload = openShift;
  runInContext('runTimer(11, "کارمند یازده", true)', app.context);

  assert.equal(app.cardTimers()[0].delay, 120000, 'تبِ پنهان باید ۱۲۰ ثانیه باشد');
  console.log('✔ تبِ پنهان → تازه‌سازی هر ۱۲۰ ثانیه');
}

// ۴) برگشتنِ تب: تازه‌سازیِ فوری + نبودِ زنجیرهٔ موازی
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.hidden = false;
  app.documentStub.__payload = openShift;

  runInContext('runTimer(21, "الف", true); runTimer(22, "ب", true)', app.context);
  assert.equal(app.cardReads().length, 2);
  assert.equal(app.cardTimers().length, 2);

  // همان کارمند دوباره صدا زده شود (مثل رفرشِ دستی): نباید دو زنجیره بکارد.
  runInContext('runTimer(21, "الف", true)', app.context);
  assert.equal(app.cardTimers().length, 2, 'زنجیرهٔ قبلیِ همان کارمند باید قطع شود');

  const before = app.cardReads().length;
  app.fireVisibility(true);   // رفت به تبِ دیگر: چیزی نباید بخواهد
  assert.equal(app.cardReads().length, before, 'در پنهان‌شدن نباید درخواستی برود');

  app.fireVisibility(false);  // برگشت
  assert.equal(
    app.cardReads().length,
    before + 2,
    'برگشتنِ تب باید هر دو کارمند را همان لحظه تازه کند',
  );
  assert.equal(app.cardTimers().length, 2, 'بعد از برگشت هم دو زنجیره، نه بیشتر');
  console.log('✔ برگشتنِ تب → تازه‌سازیِ فوریِ همهٔ کارت‌ها بدون زنجیرهٔ موازی');
}

// ۵) مسیرِ «زنده»: ثبتِ گوشی با یک درخواستِ سبک دیده شود
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.__payload = closedShift;   // شیفت بسته: زنجیرهٔ خودِ کارت ۶۰ ثانیه است
  app.documentStub.__revisions = '{"31":"2:900"}';

  runInContext('runTimer(31, "کارمند سی‌ویک", true)', app.context);
  assert.equal(app.cardReads().length, 1);

  // اولین بررسیِ revision: خطِ مبنا فقط ثبت می‌شود، ولی کارت یک بار می‌خواند
  // تا عددِ نمایش‌داده‌شده با رکوردهای واقعی هم‌خوان باشد.
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.cardReads().length, 2, 'بار اول: یک خواندنِ مبنا');

  // تغییر نکرده: نباید درخواستِ اضافه برود (همان چیزی که درخواست سبک را سبک نگه می‌دارد).
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.cardReads().length, 2, 'انگشتِ تغییرِ یکسان → بدون خواندنِ تازه');

  // گوشی همین حالا یک ورود ثبت کرده: انگشتِ تغییر عوض می‌شود → فقط همان کارت خوانده می‌شود.
  app.documentStub.__payload = JSON.stringify([{ time: '21:05:00', start: 1, pause: 0 }]);
  app.documentStub.__revisions = '{"31":"3:941"}';
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.cardReads().length, 3, 'تغییر → یک خواندنِ تازه برای همان کارت');
  assert.match(
    app.element('.digital-timer-31').innerHTML,
    /[۰-۹]+ : [۰-۹]+' : [۰-۹]+"/,
    'تایمرِ همان کارت باید بلافاصله ساعتِ تازه را بنویسد (بدون رفرشِ صفحه)',
  );

  // نگهبانِ سبک خودش را دوباره زمان‌بندی می‌کند تا چرخه ادامه پیدا کند.
  assert.equal(app.revisionTimers().length, 1, 'چرخهٔ درخواستِ سبک باید ادامه داشته باشد');

  // سرورِ قدیمی (بی این مسیر): بعد از یک خطا خاموش می‌شود تا درخواستِ تکراری نرود.
  app.clearTimers();
  app.documentStub.__revisionFails = true;
  runInContext('checkTimerRevisions()', app.context);
  runInContext('startTimerRevisions()', app.context);
  assert.equal(app.revisionTimers().length, 0, 'خطا → نگهبانِ سبک خاموش شود');

  console.log('✔ ثبتِ گوشی → پیدا شدن با درخواستِ سبک و خواندنِ فقط همان کارت');
}

// ۶) کارمندِ بی‌ثبت: فقط «دیده» می‌شود و اولین ورودِ روز خودش را می‌خواند
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.hidden = false;

  // کارمندِ بی‌ثبت عددی برای خواندن ندارد؛ پس هیچ درخواستی نباید برود.
  runInContext('watchTimer(41, "کارمند چهل‌ویک")', app.context);
  assert.equal(app.cardReads().length, 0, 'کارمندِ بی‌ثبت درخواستِ رکورد نمی‌فرستد');

  // نگهبانِ اول: مبنای «صفر» ثبت می‌شود (همان چیزی که صفحه رسم کرده)، پس
  // یک درخواستِ بی‌هوده برای روزِ خالی نمی‌رود.
  app.documentStub.__revisions = '{"41":"0:0"}';
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.cardReads().length, 0, 'روزِ خالی → بدون خواندنِ تازه');

  // اولین ورودِ روز با گوشی ثبت شد: فقط همان کارت خوانده و نوشته می‌شود.
  app.documentStub.__payload = JSON.stringify([{ time: '08:12:00', start: 1, pause: 0 }]);
  app.documentStub.__revisions = '{"41":"1:950"}';
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.cardReads().length, 1, 'اولین ثبتِ روز → خواندنِ همان کارت');
  assert.match(
    app.element('.digital-timer-41').innerHTML,
    /[۰-۹]+ : [۰-۹]+' : [۰-۹]+"/,
    'کارتِ کارمندِ بی‌ثبت باید با اولین ثبتِ روز زنده شود',
  );
  assert.equal(app.intervalCount(), 1, 'شیفتِ بازِ تازه → قدم‌شمارِ ثانیه‌ای');
  console.log('✔ کارمندِ بی‌ثبت → دیده می‌شود و اولین ثبتِ روز زنده می‌شود');
}

// ۷) فاصلهٔ نگهبانِ سبک، و نبودِ زنجیرهٔ دوره‌ای برای روزِ خالی
{
  const app = sandbox();
  const visible = runInContext('TIMER_REVISION_MS', app.context);
  const hidden = runInContext('TIMER_REVISION_HIDDEN_MS', app.context);

  assert.ok(visible <= 1000 && visible >= 250, 'نگهبانِ زنده باید حداکثر یک ثانیه فاصله داشته باشد');
  assert.ok(hidden >= 60000, 'تبِ پنهان نباید تند‌و‌تاز تازه شود');

  app.clearTimers();
  app.documentStub.__payload = '[]';
  runInContext('runTimer(51, "کارمند پنجاه‌ویک", true)', app.context);
  assert.equal(
    app.cardTimers().length,
    0,
    'روزِ خالی → نه عددی برای کهنه شدن، نه زنجیرهٔ درخواستِ دوره‌ای',
  );
  console.log('✔ نگهبانِ یک‌ثانیه‌ای + بدون زنجیرهٔ دوره‌ای برای روزِ خالی');
}

// ۸) شروعِ نگهبان بعد از `load` صفحه، نه وسطِ بارگذاریِ تصویرها
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.readyState = 'loading';

  runInContext('startTimerRevisionsWhenReady()', app.context);
  assert.equal(app.revisionTimers().length, 0, 'تا پایانِ بارگذاری هیچ تیکی نمی‌زند');

  app.fireLoad();
  assert.equal(app.revisionTimers().length, 1, 'بعد از load نگهبان روشن می‌شود');
  console.log('✔ شروعِ نگهبان بعد از پایانِ بارگذاریِ صفحه');
}

// ۹) چیپِ وضعیتِ کانالِ زنده: «دورهای» ↔ «زنده» و تعدادِ پنل‌های باز
{
  const app = sandbox();
  app.clearTimers();

  const chip = app.makeChip();

  // ۱. قبل از هر اتصالی، چیپ باید صادق باشد و نه خوش‌بین: «دورهای»، بدونِ عدد.
  runInContext('timerHubPaintStatus()', app.context);
  assert.equal(chip.state, 'polling', 'بدونِ سوکت باید «دورهای» باشد');
  assert.equal(chip.label.textContent, 'دوره‌ای');
  assert.equal(chip.peers.textContent, '', 'در حالتِ دوره‌ای عددِ کهنه نباید بماند');

  // ۲. سوکت باز شد → «زنده» و همان لحظه فهرستِ کارت‌های این صفحه می‌رود.
  runInContext('timerHubConnect()', app.context);

  const socket = app.sockets[0];
  assert.ok(socket, 'با باز شدنِ صفحه یک سوکت ساخته می‌شود');

  socket.open();
  assert.equal(chip.state, 'live', 'سوکتِ باز یعنی «زنده»');
  assert.equal(chip.label.textContent, 'زنده');
  assert.match(socket.sent[0] || '', /"type":"watch"/, 'با باز شدنِ سوکت فهرستِ کارت‌ها فرستاده می‌شود');

  // ۳. تعدادِ پنل‌ها: هم در `ready` می‌آید و هم هاب با پیامِ `peers` تازه‌اش
  //    می‌کند — بدونِ اینکه چیپ هیچ درخواستی به سرور بفرستد.
  socket.message({ type: 'ready', watching: 2, clients: 3 });
  assert.equal(chip.peers.textContent, ' · ۳ پنل', 'عدد باید با رقمِ فارسی نوشته شود');

  socket.message({ type: 'peers', count: 1 });
  assert.equal(chip.peers.textContent, ' · ۱ پنل', 'بستنِ یک پنل باید همان لحظه دیده شود');

  // ۴. سوکت مرد → فوراً «دورهای» و عدد پاک می‌شود؛ چیپ نباید تا وصل شدنِ
  //    دوباره سبز بماند و دروغ بگوید.
  socket.close();
  assert.equal(chip.state, 'polling', 'قطعِ سوکت باید فوراً به «دورهای» برگردد');
  assert.equal(chip.peers.textContent, '');

  console.log('✔ چیپِ وضعیت: «زنده» ↔ «دورهای» و تعدادِ پنل‌های باز');
}
/*
 * ۱۰) چیپ در هر دو نوار بالا هست؟
 *
 * این بند رفتارِ جاوااسکریپت را نمی‌سنجد؛ جلوی یک اشتباهِ آسانِ انسانی را
 * می‌گیرد: اضافه‌کردنِ چیپ به یک صفحه و جا ماندنِ صفحهٔ دیگر. مارک‌آپ در یک
 * پارشالِ مشترک است و هر دو پوسته از آن استفاده می‌کنند؛ اگر اشتراک از یکی
 * برداشته شود، آن صفحه بی‌چیپ می‌ماند و هیچ تستِ رفتاری آن را نمی‌بیند.
 */
{
  const read = (path) => readFileSync(resolve(here, path), 'utf8');

  const chip = read('../../resources/views/partials/timer-hub-chip.blade.php');

  assert.match(chip, /data-timer-hub-status/, 'پارشال باید قلابِ چیپ را داشته باشد');
  assert.match(chip, /data-timer-hub-label/, 'برچسبِ متن باید سر جایش باشد');
  assert.match(chip, /data-timer-hub-peers/, 'جای عددِ پنل‌ها باید سر جایش باشد');
  assert.match(
    chip,
    /data-state="polling"/,
    'حالتِ اولیه باید «دوره‌ای» باشد تا پیش از باز شدنِ سوکت چیپ دروغ نگوید',
  );
  assert.match(
    chip,
    /<span data-timer-hub-label>دوره‌ای<\/span>/,
    'متنِ اولیه بدونِ جاوااسکریپت هم باید «دوره‌ای» باشد',
  );

  const panel = read('../../resources/views/layouts/panel.blade.php');
  const attendance = read('../../resources/views/layouts/attendance.blade.php');

  assert.match(
    panel,
    /@include\('partials\.timer-hub-chip'\)/,
    'پنل مدیریت باید همان پارشال را بیاورد، نه یک نسخهٔ جداگانه',
  );
  assert.match(
    attendance,
    /@include\('partials\.timer-hub-chip'\)/,
    'صفحهٔ حضور و غیاب هم باید چیپ را داشته باشد',
  );

  console.log('✔ چیپ در پارشالِ مشترک است و هر دو نوار بالا آن را می‌آورند');
}

// ۱۱) کارتِ رسم‌شده با پاسخِ خالی: در هر دو مسیرِ زنده ثبت می‌شود
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.__payload = '[]';   // امروز رکوردی ندارد (روزِ خالی یا رکوردهای حذف‌شده)

  // خودِ صفحه کارت را رسم کرده و `runTimer` را صدا زده است.
  runInContext('runTimer(60, "کارمند شصت", true)', app.context);

  // کانالِ زنده باید همین کارت را در فهرست ببیند — وگرنه ثبتِ گوشی به این
  // پنل نمی‌رسد و تنها راهِ دیدنش رفرشِ دستیِ صفحه می‌شود.
  runInContext('timerHubConnect()', app.context);
  const socket = app.sockets[0];
  assert.ok(socket, 'برای این صفحه سوکت ساخته می‌شود');
  socket.open();

  const watch = socket.sent
    .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
    .find((message) => message && message.type === 'watch');

  assert.ok(watch, 'با باز شدنِ سوکت باید فهرستِ کارت‌ها فرستاده شود');
  assert.ok(
    (watch.ids || []).map(String).indexOf('60') >= 0,
    'پاسخِ خالی نباید کارت را از فهرستِ هاب بیندازد',
  );

  // و نگهبانِ دوره‌ای هم باید همین کارت را بپرسد؛ اولین ثبتِ گوشی که برسد
  // عدد تازه می‌شود و پاک‌کاریِ تایمر همان لحظه انجام می‌شود.
  app.documentStub.__payload = JSON.stringify([{ time: '08:12:00', start: 1, pause: 0 }]);
  app.documentStub.__revisions = '{"60":"1:951"}';
  runInContext('checkTimerRevisions()', app.context);

  assert.equal(
    app.cardReads().length, 2,
    'اولین ثبتِ بی‌رکورد باید همان کارت را بخواند، بی‌آنکه صفحه رفرش شود',
  );
  assert.ok(app.intervalCount() >= 1, 'قدم‌شمارِ شیفتِ باز باید روشن شود');

  console.log('✔ پاسخِ خالی هم کارت را زیر نظر نگه می‌دارد (ثبتِ گوشی بی‌رفرش دیده می‌شود)');
}

// ۱۲) خطای گذرا نگهبان را برای همیشه خاموش نمی‌کند
{
  const app = sandbox();
  app.clearTimers();
  app.documentStub.__revisions = '{"71":"0:0"}';
  runInContext('watchTimer(71, "کارمند هفتادویک")', app.context);

  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.revisionTimers().length, 1, 'روی روالِ عادی یک تیکِ بعدی در انتظار است');

  // یک ۵۰۳ میانِ استقرار — اول خطای گذرا، بعدِ تکمیل، مثلِ خودِ jQuery.
  app.clearTimers();
  app.documentStub.__revisionFails = 503;
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.revisionTimers().length, 1, 'خطای گذرا نباید نگهبان را خاموش کند');
  assert.equal(app.revisionTimers()[0].delay, 1000, 'اولین خطا: یک ثانیه مکث');

  app.clearTimers();
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.revisionTimers().length, 1, 'خطای دوم هم فقط مکث می‌دهد، نه خاموشی');
  assert.equal(app.revisionTimers()[0].delay, 2000, 'خطای دوم: فاصله دو برابر می‌شود');

  // سرور دوباره سالم شد → باید به فاصلهٔ عادی برگردد، نه اینکه تا رفرشِ دستی بخوابد.
  app.clearTimers();
  app.documentStub.__revisionFails = false;
  runInContext('checkTimerRevisions()', app.context);
  assert.equal(app.revisionTimers().length, 1, 'سلامتیِ دوباره چرخه را روشن نگه می‌دارد');
  assert.equal(app.revisionTimers()[0].delay, 1000, 'بعد از موفقیت، فاصله به حالتِ عادی برمی‌گردد');

  console.log('✔ خطای گذرا → مکثِ روبه‌رشد و برگشت به روالِ عادی، بدون خاموشیِ همیشگی');
}

console.log('\nهمهٔ بررسی‌های زمان‌بندیِ تایمرِ پنل گذشت.');
