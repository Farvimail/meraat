import type { ApiError, ApiErrorCode } from './api';

/**
 * پیام‌های فارسی خطا.
 *
 * جدا نگه داشته شده تا متنِ قابل‌نمایش در یک جا باشد و کد شبکه/منطق به آن
 * وابسته نباشد.
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  network: 'اینترنت وصل نیست. ثبت حضور فقط از شبکهٔ محل کار ممکن است.',
  timeout: 'سرور جواب نداد. یک بار دیگر تلاش کنید.',
  unauthorized: 'نشست شما بسته شده است. دوباره وارد شوید.',
  invalid_credentials: 'پست الکترونیک یا رمزعبور درست نیست.',
  device_already_bound: 'این گوشی به کارمند دیگری بسته شده است. با مدیر تماس بگیرید.',
  device_mismatch: 'حساب شما روی گوشی دیگری فعال است. با مدیر تماس بگیرید.',
  outside_office_network: 'ثبت حضور فقط از اینترنت محل کار انجام می‌شود.',
  duplicate_punch: 'این ثبت قبلاً انجام شده است. وضعیت از سرور تازه شد؛ دکمهٔ پایین کار بعدی را نشان می‌دهد.',
  biometric_required: 'برای ثبت، اثر انگشت خود را تأیید کنید.',
  gps_required: 'برای ثبت، دسترسی موقعیت مکانی را روشن کنید.',
  photo_rejected: 'عکس ذخیره نشد. یک عکسِ دیگر انتخاب کنید.',
  photo_too_large: 'حجم عکس بیش از حد مجاز است. عکس کوچک‌تری انتخاب کنید.',
  server: 'خطای سرور. لطفاً به مدیر سامانه اطلاع دهید.',
  bad_response: 'پاسخ سرور خوانا نبود.',
};

/** پیام بی‌طرف وقتی خطا کد شناخته‌شده ندارد. */
export const UNKNOWN_ERROR_MESSAGE = 'انجام نشد. یک بار دیگر تلاش کنید.';

export function messageForError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as ApiError).code;

    if (code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[code];
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return UNKNOWN_ERROR_MESSAGE;
}

export const BIOMETRIC_MESSAGES = {
  unavailable: 'این گوشی اثر انگشت ندارد یا قفل صفحه برایش تنظیم نشده است.',
  not_enrolled: 'روی این گوشی اثر انگشتی ثبت نشده است. اول در تنظیمات گوشی ثبت کنید.',
  cancelled: 'تأیید اثر انگشت لغو شد.',
  lockout: 'تلاش‌های ناموفق زیاد بود. چند لحظه صبر کنید و دوباره امتحان کنید.',
  failed: 'اثر انگشت تشخیص داده نشد. دوباره امتحان کنید.',
} as const;
