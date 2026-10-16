/* پسوندِ `.ts` عمدی است: همین فایل با `node --test` هم اجرا می‌شود و آن‌جا
   نشانیِ بی‌پسوند حل نمی‌شود (مترو هر دو را می‌خواند). */
import { isWebPhotoUri } from './profile-photo.ts';
import type {
  DeviceInfo,
  Employee,
  HistoryResponse,
  LoginResponse,
  PunchResponse,
  ServerTime,
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
  | 'duplicate_punch'
  | 'biometric_required'
  | 'gps_required'
  | 'photo_rejected'
  | 'photo_too_large'
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
  punch(body: PunchRequestBody): Promise<PunchResponse>;
  history(page?: number): Promise<HistoryResponse>;
  /**
   * فرستادنِ عکس پروفایل (مربع، برش‌خورده روی گوشی). سرور خودش عکس را در
   * همان جدولِ پنل ذخیره می‌کند و کارمندِ تازه‌شده را برمی‌گرداند.
   */
  uploadPhoto(part: PhotoPart): Promise<PhotoResponse>;
  /** حذفِ عکس؛ بعدش سرور `avatar: null` می‌دهد و اپ به عکسِ پیش‌فرض برمی‌گردد. */
  deletePhoto(): Promise<PhotoResponse>;
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

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15000;

  async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      const record = (body ?? {}) as Record<string, unknown>;
      const code = codeFromResponse(response.status, record.error);
      const serverMessage = typeof record.message === 'string' ? record.message : null;

      // پیامِ سرور اولویت دارد: برای عکس (نوع/حجم) دقیق‌تر از ترجمهٔ عمومی اپ است.
      throw new ApiError(
        code,
        serverMessage ?? `خطای سرور (${response.status})`,
        response.status,
        typeof record.error === 'string' ? record.error : raw.slice(0, 200),
      );
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

  return {
    baseUrl,

    login: (body) => request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify(body) }),

    logout: () => request<void>('/logout', { method: 'POST' }),

    me: () => request<MeResponse>('/me'),

    today: () => request<TodayPayload>('/today'),

    punch: (body) => request<PunchResponse>('/punch', { method: 'POST', body: JSON.stringify(body) }),

    history: (page = 1) => request<HistoryResponse>(`/history?page=${page}`),

    uploadPhoto: async (part) =>
      request<PhotoResponse>('/profile/photo', {
        method: 'POST',
        body: await photoForm(part),
      }),

    deletePhoto: () => request<PhotoResponse>('/profile/photo', { method: 'DELETE' }),
  };
}
