import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/**
 * رفتارِ «اتصال به سرور برقرار نیست» در صفحهٔ ورودِ پنل.
 *
 * همان فایلِ مرورگر (`public/js/auth-connection.js`) در یک محیطِ ساختگی اجرا
 * می‌شود و با fakeهایی که خودش قبول می‌کند (`fetch`, `window`, تایمرها) رانده
 * می‌شود. تست در پکیجِ موبایل است چون تنها اجراکنندهٔ `node --test` همین‌جاست
 * (مثل تستِ هم‌ارزیِ تایمر پنل).
 */

const scriptPath = fileURLToPath(new URL('../../../../public/js/auth-connection.js', import.meta.url));

interface PanelScript {
  createAuthConnection: (options: Record<string, unknown>) => {
    check: () => Promise<boolean | void>;
    stop: () => void;
    state: () => string;
  };
  AUTH_CONNECTION_RETRY_MS: number;
}

let cached: PanelScript | null = null;

function script(): PanelScript {
  if (cached) return cached;

  const sandbox: Record<string, unknown> = { console: { log: () => undefined } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(scriptPath, 'utf8'), sandbox, { filename: scriptPath });

  cached = sandbox as unknown as PanelScript;
  return cached;
}

/** عنصر ساختگی: فقط چیزهایی که اسکریپت از آن‌ها استفاده می‌کند. */
function fakeElement() {
  const classes = new Set<string>();
  const listeners: Record<string, Array<(event?: unknown) => void>> = {};

  return {
    hidden: false,
    disabled: false,
    textContent: '',
    submits: 0,
    prevented: 0,
    classList: {
      toggle: (name: string, on?: boolean) => {
        if (on === undefined ? !classes.has(name) : on) classes.add(name);
        else classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    addEventListener: (type: string, handler: (event?: unknown) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    },
    fire: (type: string) => {
      const event = { preventDefault: () => undefined, type };
      (listeners[type] ?? []).forEach((handler) => handler(event));
      return event;
    },
    submit: function submit(this: { submits: number }) {
      this.submits += 1;
    },
  };
}

interface Harness {
  form: ReturnType<typeof fakeElement>;
  card: ReturnType<typeof fakeElement>;
  note: ReturnType<typeof fakeElement>;
  retry: ReturnType<typeof fakeElement>;
  submitButton: ReturnType<typeof fakeElement>;
  connection: { check: () => Promise<unknown>; state: () => string; stop: () => void };
  pings: () => number;
  reachable: (value: boolean) => void;
  online: (value: boolean) => void;
  runTimers: () => void;
  fireWindow: (type: 'online' | 'offline') => void;
  scheduled: () => number;
}

function harness(startOnline = true): Harness {
  const form = fakeElement();
  const card = fakeElement();
  const note = fakeElement();
  const retry = fakeElement();
  const submitButton = fakeElement();

  let isOnline = startOnline;
  let reachable = true;
  let pings = 0;

  const timers = new Map<number, () => void>();
  let nextTimerId = 1;
  const windowListeners: Record<string, Array<() => void>> = {};
  const listenToWindow = (type: string, handler: () => void) => {
    windowListeners[type] = windowListeners[type] ?? [];
    windowListeners[type].push(handler);
  };

  const connection = script().createAuthConnection({
    form,
    submitButton,
    card,
    note,
    retryButton: retry,
    window: { addEventListener: listenToWindow },
    url: 'https://meraat.piqagram.ir/login',
    fetch: () => {
      pings += 1;
      return reachable ? Promise.resolve({ status: 200 }) : Promise.reject(new Error('offline'));
    },
    isOnline: () => isOnline,
    setTimer: (handler: () => void) => {
      const id = nextTimerId++;
      timers.set(id, handler);
      return id;
    },
    clearTimer: (id: number) => {
      timers.delete(id);
    },
    retryMs: 1000,
  });

  return {
    form,
    card,
    note,
    retry,
    submitButton,
    connection,
    pings: () => pings,
    reachable: (value: boolean) => {
      reachable = value;
    },
    online: (value: boolean) => {
      isOnline = value;
    },
    runTimers: () => {
      const handlers = [...timers.values()];
      timers.clear();
      handlers.forEach((handler) => handler());
    },
    fireWindow: (type) => (windowListeners[type] ?? []).forEach((handler) => handler()),
    scheduled: () => timers.size,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('اگر همان اول اینترنت نباشد، بدون هیچ درخواستی کارت می‌آید و تلاش خودکار کوک می‌شود', () => {
  const h = harness(false);

  assert.equal(h.connection.state(), 'offline');
  assert.equal(h.card.hidden, false);
  assert.equal(h.pings(), 0);
  assert.equal(h.submitButton.disabled, true);
  assert.equal(h.scheduled(), 1);
  assert.match(h.note.textContent, /اینترنت/);
});

test('در حالت عادی کارت پنهان است و دکمهٔ ورود باز', () => {
  const h = harness(true);

  assert.equal(h.card.hidden, true);
  assert.equal(h.submitButton.disabled, false);
  assert.equal(h.scheduled(), 0);
});

test('فرستادنِ فرم بدون اتصال: پست نمی‌شود و کارت با دکمهٔ تلاش دوباره ظاهر می‌شود', async () => {
  const h = harness(true);
  h.reachable(false);

  h.form.fire('submit');
  await flush();

  assert.equal(h.connection.state(), 'offline');
  assert.equal(h.form.submits, 0);
  assert.equal(h.card.hidden, false);
  assert.equal(h.submitButton.disabled, true);
  assert.match(h.note.textContent, /خودکار/);
  assert.equal(h.scheduled(), 1);
});

test('وقتی اتصال برگشت، همان ورودِ معلق خودش انجام می‌شود — فقط یک بار', async () => {
  const h = harness(true);
  h.reachable(false);

  h.form.fire('submit');
  await flush();
  assert.equal(h.form.submits, 0);

  // کاربر یا تایمر خودکار یکی از این دو را می‌زند.
  h.reachable(true);
  h.retry.fire('click');
  await flush();

  assert.equal(h.connection.state(), 'online');
  assert.equal(h.card.hidden, true);
  assert.equal(h.submitButton.disabled, false);
  assert.equal(h.form.submits, 1, 'درخواستِ معلق باید دقیقاً یک بار ادامه پیدا کند');
  assert.equal(h.scheduled(), 0, 'بعد از وصل شدن نباید تایمری بماند');
  assert.equal(h.note.textContent, 'اتصال برقرار شد؛ در حال ورود…');
});

test('بدون ورودِ معلق، برگشتنِ اتصال فرم را خودسرانه پست نمی‌کند', async () => {
  const h = harness(false);

  h.reachable(true);
  h.online(true);
  h.fireWindow('online');
  await flush();

  assert.equal(h.connection.state(), 'online');
  assert.equal(h.form.submits, 0);
});

test('تایمرِ تلاش خودکار تا وصل شدن ادامه می‌دهد و قطعِ وسطِ کار دوباره کارت را می‌آورد', async () => {
  const h = harness(true);
  h.reachable(false);

  h.form.fire('submit');
  await flush();

  h.runTimers();
  await flush();
  assert.equal(h.pings(), 2, 'تلاش خودکار باید دوباره تست کند');
  assert.equal(h.scheduled(), 1, 'تا وصل نشدن، تایمر باید دوباره کوک شود');

  h.reachable(true);
  h.runTimers();
  await flush();
  assert.equal(h.connection.state(), 'online');
  assert.equal(h.scheduled(), 0);

  h.fireWindow('offline');
  assert.equal(h.connection.state(), 'offline');
  assert.equal(h.card.hidden, false);
  assert.equal(h.scheduled(), 1);
});

test('در حالتِ آنلاین، زدنِ ورود قبل از پست یک تستِ اتصال می‌زند', async () => {
  const h = harness(true);

  h.form.fire('submit');
  await flush();

  assert.equal(h.pings(), 1);
  assert.equal(h.form.submits, 1);
  assert.equal(h.card.hidden, true, 'در این مسیر کارت نباید بپرد');
});
