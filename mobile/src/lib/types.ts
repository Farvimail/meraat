/**
 * شکل داده‌هایی که اپ با آن کار می‌کند.
 *
 * این‌ها همان ستون‌های واقعی سامانهٔ meraat هستند:
 *   tbl_saved_time (time, start, pause)  →  هر رکورد یک «رد شدن کارت» است
 *   tbl_timer      (calendar_id, customer_id, ...)  →  پیوند رکورد به کارمند و روز
 */

/** یک ردیف حضور. `start=1,pause=0` یعنی ورود، `start=0,pause=1` یعنی خروج. */
export interface PunchRow {
  /** ساعت به شکل `H:i:s` که سرور ذخیره کرده است. */
  time: string;
  start: number;
  pause: number;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  national_code: string;
  /**
   * عنوان شغلی. اختیاری است: سرور آن را از `tbl_customer_roles` پر می‌کند و
   * اگر نبود، اپ ایمیل را نشان می‌دهد.
   */
  role?: string | null;
  /**
   * نام فایل عکس پروفایل روی سرور (`public/images/users/…`). اختیاری است:
   * اگر سرور عکسی نداشته باشد یا عکس بارگذاری نشود، صفحهٔ اصلی به‌جای آن
   * حروف اول نام را داخل دایره می‌کشد.
   */
  avatar?: string | null;
}

/** ساعت سرور. اپ هرگز ساعت گوشی را مبنا نمی‌گیرد. */
export interface ServerTime {
  /** ISO 8601 با ناحیهٔ زمانی، برای محاسبات. */
  iso: string;
  /** `dmy` سامانه: `date('dmY')` میلادی، مثل `13102026`. */
  dmy: number;
  /** امروز واقعی به شکل `H:i:s`. */
  clock: string;
}

export interface DeviceInfo {
  id: string;
  /** اگر دستگاه آزاد نشده باشد، زمان بسته‌شدن به این کارمند. */
  bound_at: string | null;
}

export interface TodayPayload {
  /** `dmy` روزِ کاری که این رکوردها به آن تعلق دارند. */
  dmy: number;
  punches: PunchRow[];
  server_time: ServerTime;
}

export interface LoginResponse {
  token: string;
  employee: Employee;
  device: DeviceInfo;
  today: TodayPayload;
}

export interface PunchResponse {
  /** کاری که سرور واقعاً ثبت کرد (نه لزوماً آنچه اپ درخواست کرده بود). */
  action: 'start' | 'pause';
  punch: PunchRow;
  today: TodayPayload;
}

export interface HistoryDay {
  dmy: number;
  entry: string | null;
  exit: string | null;
  /** جمع دقیقه‌های کارکرد آن روز. */
  minutes: number | null;
  /**
   * همهٔ تیک‌های آن روز به ترتیب. اختیاری است تا اپ با سروری که هنوز این
   * فیلد را نمی‌فرستد هم کار کند؛ در آن حالت فقط خلاصهٔ روز نشان داده می‌شود.
   */
  punches?: PunchRow[];
}

export interface HistoryResponse {
  days: HistoryDay[];
  server_time: ServerTime;
}
