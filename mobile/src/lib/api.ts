/* پسوندِ `.ts` عمدی است: همین فایل با `node --test` هم اجرا می‌شود و آن‌جا
   نشانیِ بی‌پسوند حل نمی‌شود (مترو هر دو را می‌خواند). */
import { isWebPhotoUri } from './profile-photo.ts';
import type { PresenceState } from './presence';
import type {
  DeviceInfo,
  Employee,
  HistoryResponse,
  LoginResponse,
  PunchResponse,
  ServerTime,
  TimerRevision,
  TodayPayload,
} from './types';

/**
 * کلاینت HTTP اپ.
 *
 * قرارداد کاملش در `docs/API.md` است. نکتهٔ مهم: اپ **هرگز** ساعت گوشی را
 * به‌عنوان زمان حضور نمی‌فرستد؛ سرور خودش زمان را تعیین می‌کند.
 */

export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'device_already_bound'
  | 'device_mismatch'
  | 'outside_office_network'
  | 'presence_required'
  | 'duplicate_punch'
  | 'biometric_required'
  | 'gps_required'
  | 'photo_rejected'
  | 'photo_too_large'
  | 'qr_invalid'
  | 'qr_expired'
  | 'qr_foreign'
  | 'qr_required'
  | 'qr_disabled'
  | 'qr_confirm_failed'
  | 'server'
  | 'bad_response';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly detail: string | null;

  constructor(code: ApiErrorCode, message: string, status: number | null = null, detail: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** کد خطایی که سرور برمی‌گرداند → کد داخلی اپ. */
const CODE_BY_SERVER_ERROR: Record<string, ApiErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  device_already_bound: 'device_already_bound',
  device_mismatch: 'device_mismatch',
  outside_office_network: 'outside_office_network',
  presence_required: 'presence_required',
  duplicate_punch: 'duplicate_punch',
  biometric_required: 'biometric_required',
  gps_required: 'gps_required',
  photo_required: 'photo_rejected',
  photo_empty: 'photo_rejected',
  photo_not_image: 'photo_rejected',
  photo_upload_failed: 'photo_rejected',
  photo_save_failed: 'photo_rejected',
  photo_delete_failed: 'photo_rejected',
  photo_too_large: 'photo_too_large',
  qr_invalid: 'qr_invalid',
  qr_expired: 'qr_expired',
  qr_foreign: 'qr_foreign',
  qr_required: 'qr_required',
  qr_disabled: 'qr_disabled',
  qr_confirm_failed: 'qr_confirm_failed',
  unauthenticated: 'unauthorized',
  unauthorized: 'unauthorized',
  token_expired: 'unauthorized',
};



function codeFromResponse(status: number, serverError: unknown): ApiErrorCode {
  if (typeof serverError === 'string' && CODE_BY_SERVER_ERROR[serverError]) {
    return CODE_BY_SERVER_ERROR[serverError];
  }

  if (status === 401) return 'unauthorized';
  if (status >= 500) return 'server';

  return 'bad_response';
}

/**
 * خطای `ApiError` از پاسخِ ناموفق سرور.
 *
 * هر دو مسیر — `fetch` (درخواست‌های متنی) و `XHR` (آپلودِ عکس) — از همین
 * یک جا استفاده می‌کنند تا کدِ خطا و پیامِ سرور در هر دو یکسان ترجمه
 * شوند؛ وگرنه همان خطای سرور دو شکلِ متفاوت به کاربر می‌داد.
 */
function apiErrorFromResponse(status: number, raw: string): ApiError {
  let parsed: unknown = null;

  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  const record = (parsed ?? {}) as Record<string, unknown>;
  const serverMessage = typeof record.message === 'string' ? record.message : null;

  // پیامِ سرور اولویت دارد: برای عکس (نوع/حجم) دقیق‌تر از ترجمهٔ عمومی اپ است.
  return new ApiError(
    codeFromResponse(status, record.error),
    serverMessage ?? `خطای سرور (${status})`,
    status,
    typeof record.error === 'string' ? record.error : raw.slice(0, 200),
  );
}

export interface PunchRequestBody {
  device_id: string;
  intent: 'start' | 'pause';
  /**
  * زمان تأیید اثر انگشت روی گوشی. فقط برای رد کردن درخواست‌های بدون تأیید
  * است و **مدرک امنیتی نیست**: API سیستم‌عامل نمی‌گوید کدام انگشت تطبیق خورد.
  * سرور به آن به‌عنوان ادعای کلاینت نگاه می‌کند، نه اثبات.
  */
  biometric_verified_at: number | null;
  biometric_kind: string | null;
}

export interface LoginRequestBody {
  email: string;
  password: string;
  device_id: string;
  device_name: string;
  platform: string;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** مهلتِ آپلودِ عکس؛ پیش‌فرض ۲ دقیقه (بیشتر از `timeoutMs`، عمداً). */
  uploadTimeoutMs?: number;
}

export interface MeResponse {
  employee: Employee;
  device: DeviceInfo;
  server_time: ServerTime;
}

export interface ApiClient {
  readonly baseUrl: string;
  login(body: LoginRequestBody): Promise<LoginResponse>;
  logout(): Promise<void>;
  me(): Promise<MeResponse>;
  today(): Promise<TodayPayload>;
  /**
   * «انگشتِ تغییرِ» امروز — یک رشتهٔ کوتاه و ارزان.
   *
   * تایمرِ زندهٔ اپ همان‌جوری که پنل دارد (`/read/timer-revision`) به یک
   * پرسشِ سبک نیاز دارد: اگر سوکتِ هاب وصل نشود، اپ با این می‌فهمد مدیر از
   * داخل سایت شروع/توقف زده و فقط همان لحظه `today` را کامل می‌گیرد.
   */
  revision(): Promise<TimerRevision>;
  punch(body: PunchRequestBody): Promise<PunchResponse>;
  history(page?: number): Promise<HistoryResponse>;
  /**
   * فرستادنِ عکس پروفایل (مربع، برش‌خورده روی گوشی). سرور خودش عکس را در
   * همان جدولِ پنل ذخیره می‌کند و کارمندِ تازه‌شده را برمی‌گرداند.
   *
   * `onProgress` صعودِ صفر تا یک را حینِ آپلود گزارش می‌کند (ممکن است
   * اصلاً صدا زده نشود اگر مرورگر/گوشی طولِ کل را نداند). آپلود مهلتِ
   * خودش را دارد (`uploadTimeoutMs`، چند دقیقه)، نه مهلتِ کوتاهِ
   * درخواست‌های متنی — عکس روی اینترنتِ ضعیف به‌سادگی از آن رد می‌شود.
   */
  uploadPhoto(part: PhotoPart, onProgress?: (fraction: number) => void): Promise<PhotoResponse>;
  /** حذفِ عکس؛ بعدش سرور `avatar: null` می‌دهد و اپ به عکسِ پیش‌فرض برمی‌گردد. */
  deletePhoto(): Promise<PhotoResponse>;
  /**
   * تأییدِ حضور با کدِ QR خوانده‌شده از کارتِ همان کارمند در پنل.
   *
   * کد از خودِ صفحهٔ پنل خوانده می‌شود و سرور آن را با پنجرهٔ زمانیِ جاری
   * می‌سنجد؛ اپ هیچ چیزی از خودش نمی‌سازد و ساعتِ گوشی هم در این مسیر نقشی
   * ندارد.
   */
  confirmPresence(code: string): Promise<QrConfirmResponse>;
  /**
   * «کارتِ من را روی صفحهٔ پنل بزرگ نشان بده».
   *
   * وقتی اسکنر باز می‌شود صدا زده می‌شود تا کارمند بین سی کارتِ صفحهٔ دفتر
   * نگردد و کدِ ۳۰ ثانیه‌ای پیش از رسیدنش عوض نشود. قراردادش بهترین‌تلاش است:
   * `sent: false` یعنی هابِ پنل تنظیم/روشن نیست و اسکن معمولی سر جایش است.
   */
  spotlightPresence(close?: boolean): Promise<SpotlightResponse>;
}

/** پاسخِ «نشانم بده» — `sent` یعنی هابِ پنل خبر را پذیرفت. */
export interface SpotlightResponse {
  sent: boolean;
}

/** یک فایلِ عکس برای `multipart/form-data`. */
export interface PhotoPart {
  uri: string;
  name: string;
  type: string;
}

export interface PhotoResponse {
  avatar: string | null;
  employee: Employee;
}

/** پاسخِ تأییدِ حضور با QR. */
export interface QrConfirmResponse {
  confirmed: boolean;
  qr: PresenceState;
  employee: Employee;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 120_000;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    token?: string | null,
    timeoutOverrideMs?: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutOverrideMs ?? timeoutMs);
    const authToken = token ?? options.getToken?.();

    /*
     * روی بدنهٔ `FormData` نباید `Content-Type` دستی گذاشت: مرورگر و
     * React Native برای هر درخواست یک `boundary` تصادفی می‌سازند و اگر
     * نوعِ دستی بنشیند، سرور نمی‌تواند بخش‌ها را از هم جدا کند و فایل
     * خالی می‌رسد.
     */
    const multipart =
      typeof FormData !== 'undefined' && (init.body as unknown) instanceof FormData;

    let response: Response;

    try {
      response = await doFetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(multipart ? {} : { 'Content-Type': 'application/json' }),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ApiError(
        aborted ? 'timeout' : 'network',
        aborted ? 'پاسخی از سرور نگرفتیم.' : 'به سرور وصل نشدیم.',
        null,
        error instanceof Error ? error.message : null,
      );
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let body: unknown = null;

    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      throw apiErrorFromResponse(response.status, raw);
    }

    if (body === null) {
      // ۲۰۴ بدون بدنه، مثل خروج از حساب.
      if (response.status === 204) return undefined as T;

      throw new ApiError('bad_response', 'پاسخ سرور خوانا نبود.', response.status, raw.slice(0, 200));
    }

    return body as T;
  }

  /**
   * بدنهٔ `multipart` برای عکس.
   *
   * دو مسیرِ متفاوت داریم و هر دو لازمند: در گوشی، شیءِ
   * `{ uri, name, type }` را خودِ React Native می‌خواند و بدنه را می‌سازد؛
   * در مرورگر چنین چیزی فایل نمی‌شود و باید اول نشانیِ `blob:` را به
   * `Blob` تبدیل کنیم.
   */
  async function photoForm(part: PhotoPart): Promise<FormData> {
    const form = new FormData();

    if (isWebPhotoUri(part.uri)) {
      const fetched = await doFetch(part.uri, { method: 'GET' });
      form.append('photo', await fetched.blob(), part.name);

      return form;
    }

    // @ts-expect-error — React Native در `FormData` شیءِ فایلِ بومی را می‌پذیرد.
    form.append('photo', { uri: part.uri, name: part.name, type: part.type });

    return form;
  }

  /**
   * آپلودِ عکس با `XMLHttpRequest` تا درصدِ پیشرفت ممکن باشد.
   *
   * چرا `fetch` نه: نه در React Native و نه در مرورگر، `fetch` رویدادِ
   * پیشرفتِ آپلود ندارد؛ کاربر فقط «در حال ذخیره…» می‌دید بی‌آنکه بفهمد
   * عکس دارد می‌رود یا وسطِ راه گیر کرده. مهلت هم مالِ خودش است: چند
   * صد کیلوبایت عکس روی اینترنتِ ضعیف به‌سادگی از مهلتِ ۱۵ ثانیهٔ
   * درخواست‌های متنی رد می‌شد و آپلود وسطِ راه قطع می‌شد — یعنی همان
   * «عکس اعمال نشده» بدونِ هیچ خطای قابل‌فهمی.
   *
   * بدونِ `XMLHttpRequest` (تست‌های `node --test`) همان مسیرِ `fetch`
   * می‌رود؛ فقط پیشرفتِ زنده در آن محیط‌ها افتاده است.
   */
  async function uploadPhotoRequest(
    part: PhotoPart,
    onProgress?: (fraction: number) => void,
  ): Promise<PhotoResponse> {
    const form = await photoForm(part);

    if (typeof XMLHttpRequest === 'undefined') {
      return request<PhotoResponse>(
        '/profile/photo',
        { method: 'POST', body: form },
        undefined,
        uploadTimeoutMs,
      );
    }

    return new Promise<PhotoResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        action();
      };

      xhr.open('POST', `${baseUrl}/profile/photo`);
      xhr.setRequestHeader('Accept', 'application/json');

      const token = options.getToken?.();

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event: { lengthComputable?: boolean; loaded: number; total: number }) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.min(1, event.loaded / event.total));
          }
        };
      }

      xhr.onload = () => {
        const loadedRaw = typeof xhr.responseText === 'string' ? xhr.responseText : '';

        finish(() => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(loadedRaw) as PhotoResponse);
            } catch {
              reject(
                new ApiError('bad_response', 'پاسخ سرور خوانا نبود.', xhr.status, loadedRaw.slice(0, 200)),
              );
            }
            return;
          }

          reject(apiErrorFromResponse(xhr.status, loadedRaw));
        });
      };

      xhr.onerror = () => finish(() => reject(new ApiError('network', 'به سرور وصل نشدیم.')));

      /*
       * تایمر دستی، نه خاصیتِ `xhr.timeout`: آن خاصیت در بعضی نسخه‌های
       * اندرویدِ React Native کار نمی‌کند. `abort` فقط از همین تایمر
       * زده می‌شود، پس هر abortی یعنی «مهلت تمام شد» نه لغوِ کاربر.
       */
      xhr.onabort = () => finish(() => reject(new ApiError('timeout', 'پاسخی از سرور نگرفتیم.')));

      timer = setTimeout(() => {
        try {
          xhr.abort();
        } catch {
          finish(() => reject(new ApiError('timeout', 'پاسخی از سرور نگرفتیم.')));
        }
      }, uploadTimeoutMs);

      xhr.send(form);
    });
  }

  return {
    baseUrl,

    login: (body) => request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify(body) }),

    logout: () => request<void>('/logout', { method: 'POST' }),

    me: () => request<MeResponse>('/me'),

    today: () => request<TodayPayload>('/today'),

    revision: () => request<TimerRevision>('/revision'),

    punch: (body) => request<PunchResponse>('/punch', { method: 'POST', body: JSON.stringify(body) }),

    history: (page = 1) => request<HistoryResponse>(`/history?page=${page}`),

    uploadPhoto: (part, onProgress) => uploadPhotoRequest(part, onProgress),

    deletePhoto: () => request<PhotoResponse>('/profile/photo', { method: 'DELETE' }),

    confirmPresence: (code) =>
      request<QrConfirmResponse>('/qr/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    spotlightPresence: (close) =>
      request<SpotlightResponse>('/qr/spotlight', {
        method: 'POST',
        body: JSON.stringify({ state: close ? 'close' : 'open' }),
      }),
  };
}
