/*
 * عکس پروفایل — منطقِ خالصِ انتخاب و فرستادن.
 *
 * چرا جدا از پیکر: این فایل هیچ importی از Expo یا React ندارد، پس هم در
 * حافظهٔ گوشی و هم در `node --test` (بدون شبیه‌ساز) اجرا می‌شود. کارهایی که
 * واقعاً به دستگاه وابسته‌اند (اجازهٔ دوربین، باز شدنِ گالری، Fetchِ فایل) در
 * `photo-picker.ts` و `api.ts` مانده‌اند.
 *
 * قاعدهٔ کلی: سرور هم همین محدودیت‌ها را دارد (نوعِ تصویر از محتوا و سقفِ
 * ۸ مگابایت). اینجا پیش از فرستادن بررسی می‌کنیم تا کاربر پیامِ روشن و فوری
 * ببیند، نه خطای شبکه پس از آپلودِ فایلی که آخرش رد می‌شود.
 */

export type PhotoSource = 'library' | 'camera';

/** یک عکسِ انتخاب‌شده — فقط همان چند فیلدی که برای فرستادن لازم است. */
export interface PickedPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

/** دلیلِ رد شدنِ عکس پیش از فرستادن. */
export type PhotoRejection = 'missing' | 'too_large' | 'not_image';

/**
 * برشِ مربع، هم‌اندازهٔ دایرهٔ پروفایل.
 *
 * `allowsEditing` پیکرِ برشِ خودِ سیستم‌عامل را باز می‌کند (روی iOS با
 * بزرگ‌نمایی، روی اندروید با گالریِ برش)؛ همان گامِ «ویرایش پیش از تنظیم» که
 * کاربر می‌خواهد. اگر `aspect` ندهیم، برش آزاد می‌شود و عکسِ افقی در دایره
 * کشیده و قیچی‌شده دیده می‌شود.
 */
export const PHOTO_ASPECT: [number, number] = [1, 1];

/** کیفیتِ فشرده‌سازی پیش از فرستادن: ۰٫۷ حجم را چند برابر کم می‌کند و روی دایرهٔ کوچکِ پروفایل تفاوتی دیده نمی‌شود. */
export const PHOTO_QUALITY = 0.7;

/** همان سقفی که سرور هم اعمال می‌کند. */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** نوع‌های مجاز، با پسوندِ متناظر. */
export const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * گزینه‌های پیکر برای هر منبع.
 *
 * دوربین عمداً پیش‌فرضِ جلویی است: این عکسِ پروفایلِ یک کارمند است و عکسِ
 * پشتِ دوربین از داخل جیب هم گرفته می‌شود؛ کاربر می‌تواند در پیکر عوضش کند.
 * حذفِ EXIF و base64 عمدی است: حجمِ بار و داده‌های اضافه (محلِ عکس‌برداری)
 * را نمی‌فرستیم.
 */
export function pickerOptions(source: PhotoSource) {
  return {
    mediaTypes: 'images' as const,
    allowsEditing: true,
    aspect: PHOTO_ASPECT,
    quality: PHOTO_QUALITY,
    exif: false,
    base64: false,
    cameraType: source === 'camera' ? ('front' as const) : ('back' as const),
  };
}

/** نبودِ عکس، حجمِ زیاد، یا فایلِ غیرتصویری؟ `null` یعنی سالم است. */
export function checkPhoto(photo: PickedPhoto | null | undefined): PhotoRejection | null {
  if (!photo || typeof photo.uri !== 'string' || photo.uri.trim() === '') {
    return 'missing';
  }

  if (typeof photo.fileSize === 'number' && photo.fileSize > PHOTO_MAX_BYTES) {
    return 'too_large';
  }

  const mime = typeof photo.mimeType === 'string' ? photo.mimeType.toLowerCase() : '';

  // نوعِ نامعلوم رد نمی‌شود: بعضی گالری‌های اندروید `mimeType` نمی‌دهند و
  // سرور خودش نوع را از محتوا می‌خواند.
  if (mime !== '' && !mime.startsWith('image/')) {
    return 'not_image';
  }

  return null;
}

/** نوعِ MIME برای فرستادن: از خودِ asset، وگرنه از پسوند فایل. */
export function photoMimeType(photo: PickedPhoto): string {
  const mime = typeof photo.mimeType === 'string' ? photo.mimeType.toLowerCase() : '';

  if (mime !== '' && mime.startsWith('image/')) {
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }

  const extension = extensionOf(photo.fileName);

  return EXTENSION_TO_MIME[extension] ?? 'image/jpeg';
}

/**
 * نامِ فایلِ ارسالی.
 *
 * سرور نامِ نهایی را خودش می‌سازد؛ این نام فقط برای `multipart` لازم است.
 * پسوند مهم است: بعضی سرورها/کلاینت‌ها نوع را از آن می‌خوانند.
 */
export function photoFileName(photo: PickedPhoto, fallbackExtension = 'jpg'): string {
  const mime = photoMimeType(photo);
  const extension = PHOTO_TYPES[mime] ?? fallbackExtension;
  const raw = typeof photo.fileName === 'string' ? photo.fileName.trim() : '';
  const safe = raw.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[.-]+/, '');

  if (safe === '') {
    return `avatar.${extension}`;
  }

  return extensionOf(safe) === '' ? `${safe}.${extension}` : safe;
}

/**
 * نشانی‌ای که در **وب** باید اول به Blob تبدیل شود.
 *
 * در نسخهٔ وبِ Expo، پیکر یک `blob:` (یا `data:`) می‌دهد؛ شکلِ
 * `{ uri, name, type }` که React Native می‌فهمد، در مرورگر به فایل تبدیل
 * نمی‌شود و سرور بدنهٔ خالی می‌گیرد.
 */
export function isWebPhotoUri(uri: string): boolean {
  return uri.startsWith('blob:') || uri.startsWith('data:');
}

/** پیامِ فارسیِ هر دلیلِ رد شدن. */
export function photoRejectionMessage(rejection: PhotoRejection): string {
  switch (rejection) {
    case 'missing':
      return 'عکسی انتخاب نشد.';
    case 'too_large':
      return 'حجم عکس بیش از ۸ مگابایت است. عکس کوچک‌تری انتخاب کنید.';
    case 'not_image':
      return 'فایل انتخاب‌شده عکس نیست.';
    default:
      return 'عکس انتخاب‌شده قابل استفاده نیست.';
  }
}

/** پسوندِ کوچک‌شدهٔ یک نامِ فایل، یا رشتهٔ خالی. */
function extensionOf(name: string | null | undefined): string {
  if (typeof name !== 'string') return '';

  const dot = name.lastIndexOf('.');

  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}
