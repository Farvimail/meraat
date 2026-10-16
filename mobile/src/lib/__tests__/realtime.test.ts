import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hubIntent, hubSocketUrl, watchTimer } from '../realtime.ts';
import type { HubSocket } from '../realtime.ts';

/**
 * تایمرِ زندهٔ اپ: سوکتِ هاب + پرسشِ پشتیبان.
 *
 * این تست بدونِ مرورگر و بدونِ سرور اجرا می‌شود: سوکت و تایمرها جعل می‌شوند.
 * آنچه سنجیده می‌شود دقیقاً همان چیزی است که روی گوشی دیده می‌شود — «مدیر از
 * پنل شروع زد، گوشی همان لحظه عوض شد» — و مسیرِ پشتیبان برای وقتی سوکت وصل
 * نمی‌شود.
 */

/** یک نوبت انتظار تا همهٔ Promiseهای معلق تمام شوند. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

/** تایمرهای ساختگی: نه چیزی خودش می‌زند، نه زمان واقعی لازم است. */
function fakeTimers() {
  let nextId = 1;

  const intervals = new Map<number, { fn: () => void; delay: number }>();
  const timeouts = new Map<number, { fn: () => void; delay: number }>();

  return {
    setIntervalFn: ((fn: () => void, delay?: number) => {
      const id = nextId++;
      intervals.set(id, { fn, delay: delay ?? 0 });
      return id as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval,
    clearIntervalFn: ((id: unknown) => {
      intervals.delete(id as number);
    }) as typeof clearInterval,
    setTimeoutFn: ((fn: () => void, delay?: number) => {
      const id = nextId++;
      timeouts.set(id, { fn, delay: delay ?? 0 });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: unknown) => {
      timeouts.delete(id as number);
    }) as typeof clearTimeout,
    /** همهٔ تایمرهای دوره‌ای یک نوبت زده می‌شوند (و منتظرِ نتیجه‌شان می‌مانیم). */
    async runIntervals(): Promise<void> {
      for (const [id, timer] of [...intervals]) {
        if (intervals.has(id)) timer.fn();
      }

      await flush();
    },
    runTimeouts(): void {
      for (const [id, timer] of [...timeouts]) {
        timeouts.delete(id);
        timer.fn();
      }
    },
    intervalCount: () => intervals.size,
    timeoutCount: () => timeouts.size,
  };
}

/** سوکتِ ساختگی؛ رویدادها از بیرونِ تست زده می‌شوند. */
class FakeSocket implements HubSocket {
  readonly url: string;
  readyState = 0;
  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(String(data));
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  message(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  die(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

test('نشانیِ سوکت: http→ws، حذفِ اسلشِ آخر و بردنِ شناسهٔ کارمند', () => {
  assert.equal(hubSocketUrl('https://meraat.test', 12, 17102026), 'wss://meraat.test/ws?ids=12&dmy=17102026');
  assert.equal(hubSocketUrl('https://meraat.test/', 12, null), 'wss://meraat.test/ws?ids=12');
  assert.equal(hubSocketUrl('http://10.0.0.5:8090', 7, null), 'ws://10.0.0.5:8090/ws?ids=7');
});

test('پیامِ هاب: فقط changeِ خودِ کارمند «تغییر» است', () => {
  const change = JSON.stringify({ type: 'change', dmy: '17102026', id: 12, revision: '2:905' });

  assert.equal(hubIntent(change, 12), 'change');
  assert.equal(hubIntent(change, '12'), 'change', 'شناسه رشته‌ای هم بدل شود');
  assert.equal(hubIntent(change, 13), 'other', 'تغییرِ کارمندِ دیگر به ما ربطی ندارد');
  assert.equal(hubIntent(JSON.stringify({ type: 'ping' }), 12), 'ping');
  assert.equal(hubIntent(JSON.stringify({ type: 'ready', watching: 1 }), 12), 'other');
  assert.equal(hubIntent('{نامعتبر', 12), 'other', 'پیامِ ناخوانا کانال را نمی‌شکند');
  assert.equal(hubIntent(null, 12), 'other');
});

test('سوکتِ باز: تغییرِ پنل همان لحظه تازه‌سازی می‌دهد و پرسشِ پشتیبان خاموش می‌شود', async () => {
  const timers = fakeTimers();
  const sockets: FakeSocket[] = [];
  let changes = 0;
  let reads = 0;

  const stop = watchTimer({
    url: 'wss://meraat.test/ws?ids=12',
    customerId: 12,
    onChange: () => {
      changes += 1;
    },
    readRevision: async () => {
      reads += 1;
      return '1:900:-';
    },
    socketFactory: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    setIntervalFn: timers.setIntervalFn,
    clearIntervalFn: timers.clearIntervalFn,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  assert.equal(sockets.length, 1, 'یک سوکت ساخته می‌شود');
  assert.equal(timers.intervalCount(), 1, 'تا باز نشدنِ سوکت، پرسشِ پشتیبان روشن است');

  sockets[0].open();
  assert.equal(timers.intervalCount(), 0, 'سوکتِ باز یعنی پرسشِ دوره‌ای لازم نیست');

  sockets[0].message({ type: 'change', dmy: '17102026', id: 12, revision: '2:905' });
  assert.equal(changes, 1, 'تغییرِ همین کارمند باید فوراً گزارش شود');
  await flush();
  assert.equal(reads, 1, 'بعد از تغییر، خطِ مبنا تازه می‌شود تا پرسشِ بعدی الکی نزند');

  sockets[0].message({ type: 'change', dmy: '17102026', id: 99, revision: '1:1' });
  assert.equal(changes, 1, 'تغییرِ کارمندِ دیگر تازه‌سازی نمی‌خواهد');

  sockets[0].message({ type: 'ping' });
  assert.deepEqual(sockets[0].sent, ['{"type":"pong"}'], 'پینگِ هاب باید پاسخ بگیرد');

  await timers.runIntervals();
  assert.equal(reads, 1, 'با سوکتِ باز، پرسشِ دوره‌ای هیچ درخواستی نمی‌فرستد');

  stop();
  assert.equal(sockets[0].readyState, 3, 'پاک‌سازی سوکت را می‌بندد');
  assert.equal(timers.intervalCount(), 0);
});

test('بدونِ سوکت (هاب خاموش): پرسشِ پشتیبان فقط با تغییرِ انگشتِ تغییر تازه می‌کند', async () => {
  const timers = fakeTimers();
  let revision = '0:0:-';
  let changes = 0;

  const stop = watchTimer({
    url: 'wss://meraat.test/ws?ids=12',
    customerId: 12,
    onChange: () => {
      changes += 1;
    },
    readRevision: async () => revision,
    socketFactory: () => {
      throw new Error('سوکت در این شبکه بسته است');
    },
    setIntervalFn: timers.setIntervalFn,
    clearIntervalFn: timers.clearIntervalFn,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  assert.equal(timers.intervalCount(), 1, 'بدونِ سوکت، پرسشِ پشتیبان روشن است');

  await timers.runIntervals();
  assert.equal(changes, 0, 'اولین خواندن فقط خطِ مبنا را می‌کارد');

  revision = '1:950:-';
  await timers.runIntervals();
  assert.equal(changes, 1, 'ورودِ زده‌شده از پنل باید دیده شود');

  await timers.runIntervals();
  assert.equal(changes, 1, 'بدونِ تغییر تازه، تازه‌سازیِ اضافه نمی‌شود');

  // تأییدِ دستیِ مدیر هم فقط مُهرِ زمانی را عوض می‌کند و باید دیده شود.
  revision = '1:950:2026-10-17 09:12:00';
  await timers.runIntervals();
  assert.equal(changes, 2, 'تأییدِ دستیِ مدیر هم تغییر است');

  stop();
  assert.equal(timers.intervalCount(), 0, 'پاک‌سازی پرسشِ دوره‌ای را می‌بندد');
});

test('مرگِ سوکت: برگشت به پرسشِ دوره‌ای و تلاشِ دوباره برای سوکت', async () => {
  const timers = fakeTimers();
  const sockets: FakeSocket[] = [];
  const stop = watchTimer({
    url: 'wss://meraat.test/ws?ids=12',
    customerId: 12,
    onChange: () => undefined,
    readRevision: async () => '1:900:-',
    socketFactory: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    setIntervalFn: timers.setIntervalFn,
    clearIntervalFn: timers.clearIntervalFn,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  sockets[0].open();
  assert.equal(timers.intervalCount(), 0);

  sockets[0].die();
  assert.equal(timers.intervalCount(), 1, 'سوکتِ مرده یعنی برگشت به پرسشِ دوره‌ای');
  assert.equal(timers.timeoutCount(), 1, 'برای سوکتِ تازه هم وقت گذاشته می‌شود');

  timers.runTimeouts();
  assert.equal(sockets.length, 2, 'سوکتِ تازه ساخته می‌شود');
  assert.equal(timers.timeoutCount(), 0, 'تلاشِ دوباره دوباره‌کاری نمی‌کند');

  sockets[1].open();
  assert.equal(timers.intervalCount(), 0, 'سوکتِ تازه پرسش را خاموش می‌کند');

  stop();
});

test('قطعِ شبکه در پرسشِ پشتیبان «تغییر» حساب نمی‌شود', async () => {
  const timers = fakeTimers();
  let fail = true;
  let changes = 0;

  const stop = watchTimer({
    url: 'wss://meraat.test/ws?ids=12',
    customerId: 12,
    onChange: () => {
      changes += 1;
    },
    readRevision: async () => {
      if (fail) throw new Error('offline');
      return '1:900:-';
    },
    socketFactory: () => {
      throw new Error('no socket');
    },
    setIntervalFn: timers.setIntervalFn,
    clearIntervalFn: timers.clearIntervalFn,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  await timers.runIntervals();
  assert.equal(changes, 0, 'خطای شبکه تغییر نیست');

  fail = false;
  await timers.runIntervals();
  assert.equal(changes, 0, 'بعد از برگشتِ شبکه، اولین خواندن خطِ مبناست');

  stop();
});
