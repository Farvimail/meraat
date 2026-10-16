/*
 * تایمرِ زندهٔ اپ — «شروع/توقف از داخلِ سایت، همان لحظه روی گوشی».
 *
 * مسئله: تا امروز اپ فقط با ورود، ضربهٔ خودِ کاربر و کشیدنِ دستیِ صفحه تازه
 * می‌شد. اگر مدیر از داخلِ سایت دکمهٔ شروع یا توقف را می‌زد، روی گوشی تا
 * تازه‌سازیِ بعدی هیچ عوض نمی‌شد. پنلِ وب این را با هابِ WebSocket حل کرده
 * (`ws/timer-hub.mjs` + `public/js/timer.js`)؛ همان کانال برای اپ هم باز است و
 * اینجا کلاینتش نوشته شده.
 *
 * دو مسیر، عمداً:
 *
 *   ۱) **سوکتِ زنده.** اپ به `wss://<دامنه>/ws?ids=<کارمند>` وصل می‌شود؛ هاب
 *      همان لحظه‌ای که رکوردِ این کارمند عوض شود پیامِ `change` می‌فرستد. صفر
 *      درخواست، صفر تأخیر.
 *   ۲) **پرسشِ پشتیبان.** اگر سوکت وصل نشود (هاب خاموش، nginx مسیر `/ws` را
 *      نداشته باشد، اینترنتِ سختگیر)، اپ هر چند ثانیه فقط «انگشتِ تغییر» را
 *      می‌پرسد (`GET /api/v1/revision`) و تنها وقتی عوض شد `today` را کامل
 *      می‌گیرد. اینطور هیچ‌وقت از هیچ مسیری عقب نمی‌مانیم و بدترین حالت چند
 *      ثانیه تأخیر است، نه «تا کشیدنِ دستیِ صفحه».
 *
 * چرا بدونِ وابستگی و بدونِ import از `react-native`: همین فایل با
 * `node --test` هم اجرا می‌شود؛ سوکت و تایمرها تزریق‌شدنی‌اند و مقصدِ سوکت هم
 * در `session.tsx` ساخته می‌شود.
 */

/** فاصلهٔ پرسشِ پشتیبان (میلی‌ثانیه) — همان مقیاسِ پنل، نه سنگین‌تر. */
export const TIMER_POLL_MS = 5000;

/** فاصلهٔ تلاشِ دوباره برای سوکتِ مرده؛ کوتاه تا بازگشتِ شبکه دیر نشود. */
export const TIMER_RECONNECT_MS = 15000;

/** کمینهٔ چیزی که از یک سوکتِ WebSocket لازم داریم. */
export interface HubSocket {
  readyState?: number;
  send(data: string): void;
  close(): void;
  onopen?: (() => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onclose?: (() => void) | null;
  onerror?: (() => void) | null;
}

/**
 * نشانیِ سوکتِ هاب برای همین کارمند.
 *
 * `dmy` (روزِ کاری) هم فرستاده می‌شود تا پیامِ `ready` هاب با همان روزِ اپ
 * بخواند؛ تصمیمِ تازه‌سازی ولی به آن گره نخورده — هاب هر تغییری را برای همان
 * کارت می‌فرستد و خودِ اپ می‌داند امروز کدام است.
 */
export function hubSocketUrl(origin: string, customerId: number, dmy: number | null): string {
  const base = origin.replace(/\/+$/, '').replace(/^http/i, 'ws');
  const query = [`ids=${encodeURIComponent(String(customerId))}`];

  if (dmy) {
    query.push(`dmy=${encodeURIComponent(String(dmy))}`);
  }

  return `${base}/ws?${query.join('&')}`;
}

/**
 * پیامِ هاب چه می‌گوید؟ (`change` مالِ همین کارمند، `ping` برای نگه‌داشتنِ
 * اتصال، یا هر چیزِ بی‌ربط.)
 *
 * جدا و خالص است تا بشود بدونِ سوکت هم سنجیدش: قطعِ کانال نباید به‌خاطرِ یک
 * پیامِ ناخوانا یا مالِ کارمندِ دیگر اتفاق بیفتد.
 */
export function hubIntent(raw: unknown, customerId: number | string): 'change' | 'ping' | 'other' {
  if (typeof raw !== 'string') {
    return 'other';
  }

  let message: unknown;

  try {
    message = JSON.parse(raw);
  } catch {
    return 'other';
  }

  if (!message || typeof message !== 'object') {
    return 'other';
  }

  const record = message as { type?: unknown; id?: unknown };

  if (record.type === 'ping') {
    return 'ping';
  }

  if (record.type === 'change' && Number(record.id) === Number(customerId)) {
    return 'change';
  }

  return 'other';
}

export interface WatchTimerOptions {
  /** نشانیِ سوکتِ هاب (`hubSocketUrl`). */
  url: string;
  customerId: number;
  /** یک بار در هر تغییرِ واقعی؛ تازه‌سازیِ وضعیت اینجاست. */
  onChange: () => void;
  /** پرسشِ سبکِ پشتیبان؛ باید «انگشتِ تغییر» را برگرداند. */
  readRevision: () => Promise<string>;
  pollMs?: number;
  reconnectMs?: number;
  socketFactory?: (url: string) => HubSocket;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

/**
 * نگهبانِ تایمر: تا وقتی `stop()` صدا زده نشود، هر تغییرِ همین کارمند را
 * گزارش می‌کند. خروجی، تابعِ پاک‌سازی است (مناسبِ `useEffect`).
 */
export function watchTimer(options: WatchTimerOptions): () => void {
  const pollMs = options.pollMs ?? TIMER_POLL_MS;
  const reconnectMs = options.reconnectMs ?? TIMER_RECONNECT_MS;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  let stopped = false;
  let live = false;
  let baseline: string | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let socket: HubSocket | null = null;

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearIntervalFn(pollTimer);
      pollTimer = null;
    }
  }

  /** خطِ مبنا را بی‌صدا تازه کن (بعد از یک تغییرِ اعلام‌شده با سوکت). */
  async function readBaseline(): Promise<void> {
    try {
      const value = await options.readRevision();

      if (!stopped) {
        baseline = value;
      }
    } catch {
      // شبکه قطع است؛ خطِ مبنا کهنه می‌ماند و پرسشِ بعدی جبرانش می‌کند.
    }
  }

  async function tick(): Promise<void> {
    if (stopped || live) {
      return;
    }

    let value: string;

    try {
      value = await options.readRevision();
    } catch {
      // قطع بودنِ شبکه «تغییر» نیست؛ فقط این نوبت رد می‌شود.
      return;
    }

    if (stopped || live) {
      return;
    }

    if (baseline === null) {
      // اولین خواندن فقط خطِ مبنا را می‌کارد؛ وگرنه هر ورودِ تازه به اپ یک
      // تازه‌سازیِ بی‌دلیل می‌داد.
      baseline = value;
      return;
    }

    if (value !== baseline) {
      baseline = value;
      options.onChange();
    }
  }

  function startPolling(): void {
    if (stopped || live || pollTimer !== null) {
      return;
    }

    pollTimer = setIntervalFn(() => {
      void tick();
    }, pollMs);
  }

  /** سوکت مرد یا خطا داد: به مسیرِ پرسشی برگرد و برای وصل شدنِ دوباره وقت بگذار. */
  function fallBack(): void {
    live = false;
    socket = null;
    startPolling();

    if (retryTimer !== null || stopped) {
      return;
    }

    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      connect();
    }, reconnectMs);
  }

  function connect(): void {
    if (stopped || live) {
      return;
    }

    const factory =
      options.socketFactory ?? ((url: string) => new WebSocket(url) as unknown as HubSocket);

    let created: HubSocket;

    try {
      created = factory(options.url);
    } catch {
      // محیطی که سوکت ندارد (یا آدرسش غلط است): فقط پرسشِ پشتیبان می‌ماند.
      startPolling();
      return;
    }

    socket = created;

    created.onopen = () => {
      if (stopped) {
        return;
      }

      // سوکتِ باز یعنی رسیدنِ تغییر بدونِ هیچ درخواستی؛ پرسش خاموش می‌شود.
      live = true;
      stopPolling();
    };

    created.onmessage = (event) => {
      if (stopped) {
        return;
      }

      const intent = hubIntent(event ? event.data : null, options.customerId);

      if (intent === 'change') {
        options.onChange();
        void readBaseline();
        return;
      }

      if (intent === 'ping') {
        try {
          created.send('{"type":"pong"}');
        } catch {
          // سوکتی که نمی‌نویسد همان‌جا می‌میرد و `onclose` مسیرِ پرسشی را
          // روشن می‌کند.
        }
      }
    };

    created.onclose = () => {
      if (socket === created) {
        fallBack();
      }
    };

    created.onerror = () => {
      if (socket === created) {
        fallBack();
      }
    };
  }

  connect();
  startPolling();

  return function stop(): void {
    stopped = true;
    stopPolling();

    if (retryTimer !== null) {
      clearTimeoutFn(retryTimer);
      retryTimer = null;
    }

    const current = socket;
    socket = null;

    if (current) {
      try {
        current.close();
      } catch {
        // سوکتِ مرده؛ کاری نیست.
      }
    }
  };
}
