/*
 * تأییدِ حضور با کدِ QR — منطقِ خالص.
 *
 * داستان: ثبتِ ورود از گوشی از هر جایی ممکن است؛ برای همین صفحهٔ حضور روی
 * کارتِ هر کارمند یک QR می‌کشد و کارمند با دوربینِ همین اپ اسکنش می‌کند.
 * **کد ثابت است و مخصوصِ همان کارمند** (استراتژیِ قبلی، چرخشِ ۳۰ ثانیه‌ای،
 * کنار گذاشته شد)؛ پس قالبِ کد همان `v1.<id>.0.<امضا>` می‌ماند و اپِ فعلی
 * بدونِ تغییر آن را می‌شناسد. سرور کد را می‌سنجد و «تأیید شد» را ثبت می‌کند.
 * جریان: **اول تأیید، بعد ثبت** — تا تأییدِ همین ثبت نیامده، دکمهٔ ثبت
 * (ورود یا خروج) کار نمی‌کند و سرور هم همان درخواست را با `presence_required`
 * رد می‌کند (`presenceLocksPunch`). پس دکمهٔ قفل‌شده یک تصمیمِ ظاهری نیست؛ فقط
 * همان قاعده‌ای است که سرور اجرا می‌کند، کمی زودتر و روی صفحه.
 *
 * این فایل هیچ importی ندارد تا با `node --test` هم اجرا شود: قواعدی که
 * اشتباه شدنشان گران است (کِی باید اسکنر باز شود، کد از چه کسی است، چه پیامی
 * نشان داده شود) اینجا هستند و کارهای وابسته به دوربین/شبکه در
 * `PresenceScanSheet` و `session.tsx`.
 *
 * **هر ثبت یک تأیید — ورود و خروج یکسان‌اند:** تأییدِ صبح، ورودِ عصر یا
 * خروجِ عصر را باز نمی‌کند. سرور تأیید را با همان ثبت «مصرف» می‌کند و
 * `pending` را false برمی‌گرداند؛ پس هر بار که نوبتِ بعدیِ ثبت فرا برسد (چه
 * برای ورود چه برای خروج) یک اسکنِ تازه لازم است. این تصمیم را خودِ سرور در
 * فیلدِ `lock` می‌فرستد و اپ فقط همان را نشان می‌دهد.
 *
 * **تأیید مدت‌دار است (پیش‌فرض ۳۰ ثانیه):** `seconds_left` عمرِ باقی‌ماندهٔ
 * همان تأییدِ آماده است. اپ از آن یک مهلتِ محلی می‌سازد، ثانیه‌ها را نشان
 * می‌دهد و در پایان مهلت وضعیت را از سرور تازه می‌کند تا دکمه دوباره قفل شود
 * (سرور مستقل همین را enforce می‌کند، پس ساعتِ گوشی مرجع نیست).
 *
 * **مهلت که گذشت، خودِ اپ دوباره می‌پرسد:** اگر کارمند پیش از پایانِ ۳۰ ثانیه
 * اثرِ انگشت را نزند (مثلاً می‌خواست خروج بزند و وقت کم آورد)، تأیید می‌سوزد
 * و ثبت دوباره قفل می‌شود. صفحهٔ داشبورد همان لحظه شیتِ اسکن را با جملهٔ
 * «خروج ثبت نشد، دوباره تأیید کن» باز می‌کند (`presenceReaskNote`) تا کارمند
 * دنبالِ دکمه‌ای نگردد که چرا کار نمی‌کند.
 */

/** روشِ ثبتِ تأیید، همان چیزی که سرور می‌فرستد. */
export type PresenceMethod = 'qr' | 'manual';

export interface PresenceState {
  /** آیا اپ باید اسکنِ QR بخواهد؟ (`MOBILE_QR_REQUIRED` سمت سرور) */
  required: boolean;
  /** آیا کلیدِ امضا روی سرور گذاشته شده است؟ */
  enabled: boolean;
  /** امروز اصلاً تأییدی گرفته شده است؟ (نشانِ «تأیید شده») */
  confirmed: boolean;
  /**
   * تأییدی هست که هنوز برای هیچ ثبتی خرج نشده؟
   *
   * همان چیزی که ثبتِ بعدی را باز می‌کند. اگر تأیید با یک ورود مصرف شده
   * باشد، این جا `false` است حتی وقتی `confirmed` هنوز `true` است.
   */
  pending: boolean;
  /**
   * همین حالا ثبت قفل است؟ تصمیمِ سرور با توجه به نوبت (`start`/`pause`).
   * این تنها فیلدی است که UI باید به آن تکیه کند — چه نوبت ورود باشد چه خروج:
   * سرور برای هر دو یکسان قفل می‌کند و اپ تمایزی قائل نمی‌شود.
   */
  lock: boolean;
  /** کاری که در نوبت است، همان‌طور که سرور دیده است. */
  intent: PresenceIntent;
  method: PresenceMethod | null;
  /** زمانِ تأیید، همان‌طور که سرور نوشته است. */
  confirmedAt: string | null;
  /**
   * ثانیه‌های باقی‌ماندهٔ تأییدِ آماده (نه کد؛ کد ثابت است).
   *
   * صفر یعنی تأییدی برای خرج‌شدن نیست یا عمرش تمام شده است.
   */
  secondsLeft: number;
  /**
   * مهلتِ محلیِ همان تأیید (میلی‌ثانیهٔ `Date.now`)، یا `null`.
   *
   * از `seconds_left` و لحظهٔ رسیدنِ پاسخ ساخته می‌شود تا شمارشِ اپ به ساعتِ
   * گوشی وابسته نباشد، بلکه به همان عددی که سرور داده. `null`/نبود یعنی
   * مهلتی برای شمردن نیست (تأییدِ مصرف‌شده، یا سرورِ قدیمی).
   */
  expiresAt?: number | null;
}

/** نوعِ ثبتی که در نوبت است: ورودِ تازه یا بستنِ شیفت. */
export type PresenceIntent = 'start' | 'pause';

/**
 * مهلتِ تأیید به ثانیه — همان پیش‌فرضِ سرور (`MOBILE_QR_PUNCH_WINDOW`).
 *
 * فقط برای نوشتنِ جمله‌ها استفاده می‌شود؛ عددِ واقعی همیشه از `seconds_left`
 * می‌آید تا اگر مدیر روی سرور عوضش کرد، اپ همان را بشمارد.
 */
export const PRESENCE_WINDOW_SECONDS = 30;
/**
 * حالتِ پیش‌فرض: هیچ تأییدی لازم نیست.
 *
 * عمداً «خاموش» است و نه «لازم»: اگر سرورِ قدیمی این فیلد را نفرستد (یا پاسخ
 * ناقص بیاید)، اپ نباید کارمندی را پشتِ دوربینِ اجباری نگه دارد.
 */
export const NO_PRESENCE: PresenceState = {
  required: false,
  enabled: false,
  confirmed: false,
  pending: false,
  lock: false,
  intent: 'start',
  method: null,
  confirmedAt: null,
  secondsLeft: 0,
  expiresAt: null,
};

/**
 * قالبِ کد: `v1.<کارمند>.<۰>.<۱۶ کاراکترِ امضا>`.
 *
 * عددِ وسط از قاعدهٔ چرخان مانده و همیشه صفر است؛ نگه‌داشتنش عمدی است تا
 * اپِ نصب‌شده با یک regexِ تازه به buildِ جدید نیاز پیدا نکند.
 */
const CODE_PATTERN = /^v1\.(\d+)\.(\d+)\.([0-9a-f]{16})$/;

/** پاسخِ سرور (که ممکن است ناقص/قدیمی باشد) → حالتِ امن برای UI. */
export function presenceOf(value: unknown, now: number = Date.now()): PresenceState {
  if (!value || typeof value !== 'object') {
    return NO_PRESENCE;
  }

  const raw = value as Record<string, unknown>;
  const method = raw.method === 'qr' || raw.method === 'manual' ? raw.method : null;
  const secondsLeft = typeof raw.seconds_left === 'number' ? raw.seconds_left : 0;
  const required = raw.required === true;
  const enabled = raw.enabled === true;
  const confirmed = raw.confirmed === true;

  // سرورِ قدیمی `pending`/`lock` ندارد؛ در آن حالت «تأییدِ امروز» همان
  // QR را باز می‌کرد، پس همان معنیِ قدیمی را نگه می‌داریم.
  const pending = typeof raw.pending === 'boolean' ? raw.pending : confirmed;
  const lock =
    typeof raw.lock === 'boolean' ? raw.lock : required && enabled && !confirmed;
  const left = Number.isFinite(secondsLeft) ? Math.max(0, Math.round(secondsLeft)) : 0;

  return {
    required,
    enabled,
    confirmed,
    pending,
    lock,
    intent: raw.intent === 'pause' ? 'pause' : 'start',
    method,
    confirmedAt: typeof raw.confirmed_at === 'string' ? raw.confirmed_at : null,
    secondsLeft: left,
    // فقط وقتی تأییدی هست که ارزشِ شمردن داشته باشد.
    expiresAt: pending && left > 0 ? now + left * 1000 : null,
  };
}

/**
 * چند ثانیه از تأییدِ آماده باقی مانده؟ (۰ = تأییدِ قابل‌استفاده‌ای نیست)
 *
 * روی مهلتِ محلی حساب می‌شود؛ اگر سرور `seconds_left` نفرستد (نسخهٔ قدیمی)
 * صفر برمی‌گردد و UI فقط همان «تأیید شده» را نشان می‌دهد.
 */
export function presenceSecondsLeft(
  state: PresenceState | null | undefined,
  at: number = Date.now(),
): number {
  if (!state || !state.pending || state.expiresAt == null) {
    return 0;
  }

  return Math.max(0, Math.ceil((state.expiresAt - at) / 1000));
}

/**
 * عمرِ تأییدِ آماده تمام شده است؟
 *
 * «تمام شده» یعنی باید دوباره اسکن کند؛ صدازدنِ دوبارهٔ `today` هم قفل را از
 * سرور می‌گیرد، ولی تا آمدنِ پاسخ این تابع جلوی ثبتِ بی‌فایده را می‌گیرد.
 */
export function presenceExpired(
  state: PresenceState | null | undefined,
  at: number = Date.now(),
): boolean {
  if (!state || !state.pending || state.expiresAt == null) {
    return false;
  }

  return at >= state.expiresAt;
}

/**
 * باید اسکنر باز شود؟
 *
 * همان تصمیمِ سرور: `lock`. هر ثبتِ تازه تأییدِ تازه می‌خواهد (چه ورود، چه
 * خروج)، پس بعد از مصرفِ تأیید، `lock` دوباره true می‌شود — و این همان چیزی
 * است که تا حالا یک‌بار-در-روز بود.
 */
export function needsQrScan(state: PresenceState | null | undefined): boolean {
  if (!state || !state.required || !state.enabled) {
    return false;
  }

  return state.lock;
}

/**
 * دکمهٔ ثبتِ ورود/خروج قفل است؟
 *
 * عمداً تابعِ جدا (و نه استفادهٔ مستقیم از `needsQrScan`) چون این یک **قاعدهٔ
 * کسب‌وکار** است و آن یکی «کاری که UI باید بکند».
 *
 * همان شرطی که سرور در `MobilePresence::blocksPunch` می‌سنجد: وقتی سرور قفل
 * می‌کند، اپ هم همان لحظه قفل نشان می‌دهد تا کاربر درخواستِ بی‌فایده نزند.
 */
export function presenceLocksPunch(
  state: PresenceState | null | undefined,
  at: number = Date.now(),
): boolean {
  // تأییدِ منقضی هم قفل است، حتی اگر سرور هنوز نگفته باشد: `lock` فقط در
  // لحظهٔ پاسخ محاسبه شده و مهلت بعدش می‌گذرد.
  return needsQrScan(state) || presenceExpired(state, at);
}

/** جملهٔ زیرِ دکمهٔ ثبت وقتی قفل است — «چرا کار نمی‌کند و چه کنم». */
export const PUNCH_LOCK_NOTE =
  'برای هر ثبت (ورود یا خروج) باید اول حضور را تأیید کنید. با دکمهٔ زیر QR کارتِ خودت را در صفحهٔ حضور و غیاب اسکن کن؛ بعد اثرِ انگشت بزنید.';

/** جملهٔ کارتِ تأیید — «چه چیزی از من می‌خواهی و چرا». */
export function presenceNote(state: PresenceState, at: number = Date.now()): string {
  if (!state.enabled) {
    return '';
  }

  if (state.pending && presenceExpired(state, at)) {
    // مهم‌ترین جملهٔ این کارت: کارمند باید بفهمد چرا دکمه‌ای که همین حالا باز
    // بود دوباره بسته شد — «کارت را دوباره اسکن کن»، نه «خطا داد».
    return presenceReaskNote(state);
  }

  if (state.pending) {
    return state.method === 'manual'
      ? 'حضور را مدیر تأیید کرده است؛ همین تأیید برای ثبتِ بعدی کافی است.'
      : 'تأییدِ این ثبت آماده است؛ QR را با موفقیت اسکن کردی.';
  }

  // دو حالتِ متفاوت که قاطی‌شدنشان کارمند را دنبالِ مشکلِ اشتباهی می‌فرستد:
  // اگر تأیید اجباری باشد، ثبت واقعاً کار نمی‌کند و باید گفته شود؛ اگر فقط
  // نمایشی باشد، ثبت راه خودش را دارد و نباید ترسوند.
  //
  // نوبتِ ورود و خروج یکسان‌اند: سرور برای هر دو یکسان قفل می‌کند، پس جمله هم
  // برای هر دو همین است — با ذکرِ صریحِ «ورود یا خروج» تا کارمندِ پشتِ شیفت
  // فکر نکند این جمله فقط به ورود مربوط است و خروج رایگان است.
  return state.required
    ? 'هر ثبتِ تازه (ورود یا خروج) یک تأییدِ تازه لازم دارد. QR کارتِ خودت را در صفحهٔ حضور و غیاب با دوربینِ همین اپ اسکن کن تا ثبت باز شود؛ بعد اثرِ انگشت بزن.'
    : 'برای تأییدِ حضور، QR کارتِ خودت را در صفحهٔ حضور و غیاب با دوربینِ همین اپ اسکن کن.';
}

/**
 * جملهٔ «مهلت تمام شد» — هم زیرِ کارتِ تأیید می‌نشیند و هم داخلِ شیتِ اسکن
 * که اپ خودش باز می‌کند.
 *
 * چرا نوبت در جمله می‌آید: کارمندی که می‌خواست خروج بزند باید بداند **خروج**
 * ثبت نشده و همان کار را ادامه بدهد؛ جملهٔ کلیِ «ثبت انجام نشد» او را وادار
 * می‌کند فکر کند ورودش هم مشکل دارد.
 */
export function presenceReaskNote(state: PresenceState): string {
  // رقمِ مهلت فارسی نوشته می‌شود تا با بقیهٔ جمله‌ها یک‌دست باشد؛ این فایل
  // عمداً import ندارد، پس تبدیل همین‌جا انجام می‌شود.
  const seconds = String(PRESENCE_WINDOW_SECONDS).replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)],
  );

  return state.intent === 'pause'
    ? `زمانِ تأیید (${seconds} ثانیه) تمام شد و خروج ثبت نشد؛ برای ثبتِ خروج دوباره QR کارتِ خودت را اسکن کن، بعد اثرِ انگشت بزن.`
    : `زمانِ تأیید (${seconds} ثانیه) تمام شد و ثبت انجام نشد؛ دوباره QR کارتِ خودت را اسکن کن، بعد اثرِ انگشت بزن.`;
}

/** رشتهٔ خوانده‌شده قالبِ کدِ سرور را دارد؟ (پیش از زدن به شبکه) */
export function looksLikeCode(text: string): boolean {
  return CODE_PATTERN.test(text.trim());
}

/**
 * شناسهٔ کارمندی که کد برایش ساخته شده، یا `null`.
 *
 * استفاده: اگر کارمند QR همکارش را اسکن کند، اپ **پیش از** درخواست می‌فهمد و
 * پیامِ روشن می‌دهد، به‌جای یک خطای شبکه‌ای بی‌ربط. سرور هم مستقل همین را
 * می‌سنجد (این تنها یک میان‌برِ تجربهٔ کاربری است، نه مرزِ امنیتی).
 */
export function codeCustomerId(code: string): number | null {
  const match = CODE_PATTERN.exec(code.trim());

  if (!match) {
    return null;
  }

  const id = Number(match[1]);

  return Number.isFinite(id) && id > 0 ? id : null;
}

/** متنِ فارسیِ نتیجهٔ بررسیِ محلیِ کد (پیش از درخواست به سرور). */
export function localCodeProblem(code: string, employeeId: number): string | null {
  const trimmed = code.trim();

  if (trimmed === '') {
    return 'کدی خوانده نشد؛ دوباره QR را در قاب بگیر.';
  }

  if (!looksLikeCode(trimmed)) {
    return 'این کدِ مِرآت نیست؛ QR روی کارتِ خودت در پنل را اسکن کن.';
  }

  const owner = codeCustomerId(trimmed);

  if (owner !== null && owner !== employeeId) {
    return 'این QR مالِ یکی دیگر است؛ QR خودت را اسکن کن.';
  }

  return null;
}
