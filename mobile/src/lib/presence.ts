/*
 * تأییدِ حضور با کدِ چرخانِ QR — منطقِ خالص.
 *
 * داستان: ثبتِ ورود از گوشی از هر جایی ممکن است؛ برای همین پنل روی کارتِ هر
 * کارمند یک QR می‌کشد که هر ۳۰ ثانیه عوض می‌شود و کارمند همان لحظه با دوربینِ
 * همین اپ اسکنش می‌کند. سرور کد را می‌سنجد و «حضورِ امروز تأیید شد» را ثبت
 * می‌کند. جریان: **اول تأیید، بعد ثبت** — تا تأییدِ امروز نیامده، دکمهٔ ثبتِ
 * ورود/خروج کار نمی‌کند و سرور هم همان درخواست را با `presence_required` رد
 * می‌کند (`presenceLocksPunch`). پس دکمهٔ قفل‌شده یک تصمیمِ ظاهری نیست؛ فقط
 * همان قاعده‌ای است که سرور اجرا می‌کند، کمی زودتر و روی صفحه.
 *
 * این فایل هیچ importی ندارد تا با `node --test` هم اجرا شود: قواعدی که
 * اشتباه شدنشان گران است (کِی باید اسکنر باز شود، کد از چه کسی است، چه پیامی
 * نشان داده شود) اینجا هستند و کارهای وابسته به دوربین/شبکه در
 * `PresenceScanSheet` و `session.tsx`.
 */

/** روشِ ثبتِ تأیید، همان چیزی که سرور می‌فرستد. */
export type PresenceMethod = 'qr' | 'manual';

export interface PresenceState {
  /** آیا اپ باید اسکنِ QR بخواهد؟ (`MOBILE_QR_REQUIRED` سمت سرور) */
  required: boolean;
  /** آیا کلیدِ امضا روی سرور گذاشته شده است؟ */
  enabled: boolean;
  /** آیا حضورِ امروز تأیید شده است؟ */
  confirmed: boolean;
  method: PresenceMethod | null;
  /** زمانِ تأیید، همان‌طور که سرور نوشته است. */
  confirmedAt: string | null;
  /** ثانیه‌های باقی‌مانده تا کدِ روی صفحه عوض شود. */
  secondsLeft: number;
}

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
  method: null,
  confirmedAt: null,
  secondsLeft: 0,
};

/** قالبِ کد: `v1.<کارمند>.<پنجره>.<۱۶ کاراکترِ امضا>`. */
const CODE_PATTERN = /^v1\.(\d+)\.(\d+)\.([0-9a-f]{16})$/;

/** پاسخِ سرور (که ممکن است ناقص/قدیمی باشد) → حالتِ امن برای UI. */
export function presenceOf(value: unknown): PresenceState {
  if (!value || typeof value !== 'object') {
    return NO_PRESENCE;
  }

  const raw = value as Record<string, unknown>;
  const method = raw.method === 'qr' || raw.method === 'manual' ? raw.method : null;
  const secondsLeft = typeof raw.seconds_left === 'number' ? raw.seconds_left : 0;

  return {
    required: raw.required === true,
    enabled: raw.enabled === true,
    confirmed: raw.confirmed === true,
    method,
    confirmedAt: typeof raw.confirmed_at === 'string' ? raw.confirmed_at : null,
    secondsLeft: Number.isFinite(secondsLeft) ? Math.max(0, Math.round(secondsLeft)) : 0,
  };
}

/**
 * باید اسکنر باز شود؟
 *
 * سه شرط: کلید روی سرور باشد، تأیید اجباری باشد، و امروز تأیید نشده باشد.
 */
export function needsQrScan(state: PresenceState | null | undefined): boolean {
  if (!state || !state.required || !state.enabled) {
    return false;
  }

  return !state.confirmed;
}

/**
 * دکمهٔ ثبتِ ورود/خروج قفل است؟
 *
 * عمداً تابعِ جدا (و نه استفادهٔ مستقیم از `needsQrScan`) چون این یک **قاعدهٔ
 * کسب‌وکار** است و آن یکی «کاری که UI باید بکند». امروز هر دو یک شرط دارند،
 * ولی اگر مثلاً روزی اجازه داده شود ورود بدونِ تأیید ثبت شود و فقط خروج قفل
 * باشد، این دو از هم جدا می‌شوند.
 *
 * همان شرطی که سرور در `MobilePresence::blocksPunch` می‌سنجد: وقتی سرور قفل
 * می‌کند، اپ هم همان لحظه قفل نشان می‌دهد تا کاربر درخواستِ بی‌فایده نزند.
 */
export function presenceLocksPunch(state: PresenceState | null | undefined): boolean {
  return needsQrScan(state);
}

/** جملهٔ زیرِ دکمهٔ ثبت وقتی قفل است — «چرا کار نمی‌کند و چه کنم». */
export const PUNCH_LOCK_NOTE =
  'تا حضورِ امروز تأیید نشود، ثبتِ ورود و خروج کار نمی‌کند. با دکمهٔ زیر QR روی کارتِ خودت در پنل را اسکن کن.';

/** جملهٔ کارتِ تأیید — «چه چیزی از من می‌خواهی و چرا». */
export function presenceNote(state: PresenceState): string {
  if (!state.enabled) {
    return '';
  }

  if (state.confirmed) {
    return state.method === 'manual'
      ? 'حضورِ امروز را مدیر تأیید کرده است.'
      : 'حضورِ امروز با اسکنِ QR تأیید شده است.';
  }

  // دو حالتِ متفاوت که قاطی‌شدنشان کارمند را دنبالِ مشکلِ اشتباهی می‌فرستد:
  // اگر تأیید اجباری باشد، ثبت واقعاً کار نمی‌کند و باید گفته شود؛ اگر فقط
  // نمایشی باشد، ثبت راه خودش را دارد و نباید ترسوند.
  return state.required
    ? 'تا حضورِ امروز تأیید نشود، ثبتِ ورود و خروج کار نمی‌کند. QR روی کارتِ خودت در پنل را با دوربینِ همین اپ اسکن کن.'
    : 'برای تأییدِ حضور، QR روی کارتِ خودت در پنل را با دوربینِ همین اپ اسکن کن.';
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
