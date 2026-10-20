/**
 * شکلِ «آخرین خطای مرگبار» — بدونِ هیچ import.
 *
 * چرا جدا از ذخیره‌سازی: این فایل با `node --test` هم اجرا می‌شود، ولی
 * `crash-log.ts` به `expo-secure-store` وابسته است و در نود بالا نمی‌آید. قاعده‌های
 * کوچکِ همین‌جا (کوتاه‌کردنِ پیام، نبودِ خطا، خطای غیرِ `Error`) همان‌هایی‌اند که
 * خراب‌شدنشان یعنی گزارشِ خطا خودش خطا می‌دهد.
 */

export interface CrashRecord {
  /** `render` یعنی یک صفحه هنگامِ نمایش ترکید؛ `global` یعنی خطای رهاشده. */
  where: 'render' | 'global';
  message: string;
  stack: string | null;
  /** زمانِ خطا، ISO — ساعتِ گوشی کافی است؛ این فقط یک سرنخ است. */
  at: string;
}

const MESSAGE_LIMIT = 300;
const STACK_LIMIT = 600;

function clip(value: unknown, limit: number): string {
  const text = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * هر چیزی که پرت شده (`Error`، رشته، شیء، `undefined`) → یک رکوردِ قابل‌ذخیره.
 *
 * سقفِ طول عمدی است: `SecureStore` روی اندروید اندازهٔ محدودی دارد و یک
 * stackِ بلند می‌تواند ذخیره را بی‌صدا رد کند — آن‌وقت هیچ گزارشی نمی‌ماند.
 */
export function toCrashRecord(where: CrashRecord['where'], error: unknown, at: Date = new Date()): CrashRecord {
  const asError = error instanceof Error ? error : null;
  const message = asError?.message ?? (typeof error === 'string' ? error : '');

  return {
    where,
    message: clip(message.trim() === '' ? 'خطای نامشخص' : message, MESSAGE_LIMIT),
    stack: asError?.stack ? clip(asError.stack, STACK_LIMIT) : null,
    at: at.toISOString(),
  };
}
