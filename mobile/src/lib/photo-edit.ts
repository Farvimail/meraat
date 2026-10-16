/*
 * ریاضِ ویرایشِ عکس — چرخش، بزرگ‌نمایی، جابه‌جایی و برشِ مربع.
 *
 * چرا جدا از پیکر: این فایل هیچ importی از Expo یا React ندارد، پس هم در
 * حافظهٔ گوشی و هم در `node --test` (بدون شبیه‌ساز) اجرا می‌شود. کارِ
 * دستگاه (باز کردن پیکر، نوشتن فایلِ چرخیده) در `photo-picker.ts` و
 * `photo-render.ts` مانده است؛ اینجا فقط «چشمِ کاربر» و «عددِ برش» به هم
 * وصل می‌شوند.
 *
 * سه تصمیمِ هندسی که کل این فایل را می‌سازند:
 *
 * ۱) برش همیشه **درونِ محتوای عکس** می‌ماند، نه روی کلِ بومِ چرخیده.
 *    وقتی عکسِ W×H چرخد، کتابخانه آن را روی بومِ بسته‌بندی‌شده (bounding
 *    box) می‌نشاند که گوشه‌هایش خالی‌اند. اگر برش را از همان بوم برداریم،
 *    گوشه‌های خالی داخل عکس پروفایل می‌افتد. پس ضلعِ برش از بزرگ‌ترین
 *    مربعِ متمرکزی حساب می‌شود که کاملاً داخلِ مستطیلِ چرخیده می‌نشیند:
 *
 *        side = min(W, H) / (|cos θ| + |sin θ|)
 *
 *    (گوشهٔ مربعِ متمرکزِ ضلعِ s پس از چرخشِ −θ باید داخلِ W×H بماند؛
 *     بیشترین جابه‌جاییِ گوشه exactly s·(|cos|+|sin|)/2 است.)
 *
 *    در θ=۰ و هر مضربِ ۹۰، ‌|cos|+|sin| = ۱ می‌شود و برش همان
 *    `min(W,H)` است — یعنی عکسِ صاف هیچ‌چیزِ اضافه نمی‌خورد.
 *
 * ۲) پیش‌نمایش باید **دقیقاً** همان خروجی باشد، نه تقریبِ آن. عکس با
 *    مقیاس k در قاب نشان داده می‌شود طوری که ناحیهٔ برشِ نهایی دقیقاً
 *    اندازهٔ قاب (S پیکسل) شود: k = S / side. اگر کاربر چیزی را داخلِ
 *    قاب دید، همان در فایلِ ذخیره‌شده است.
 *
 * ۳) جابه‌جایی فقط با بزرگ‌نمایی معنا دارد. در zoom=۱ برش تا لبهٔ محتوا
 *    باز شده و جایی برای جابه‌جایی نمانده؛ با بزرگ‌نمایی z هر محور
 *    `S·(z−۱)/۲` پیکسل جا می‌گیرد (از همان رابطهٔ بالا، بسته‌شده در
 *    مربعِ امن). پس pan هرگز عکس را از قابِ مربع بیرون نمی‌برد.
 *
 * نکتهٔ اجرایی: بومِ چرخیده را خودِ کتابخانه می‌سازد و اندازهٔ واقعی‌اش
 * را برمی‌گرداند؛ `cropRect` آن اندازهٔ واقعی را می‌گیرد و فقط «کجای آن»
 * را حساب می‌کند. پس این فایل به گِردِ اعداد در پیاده‌سازیِ اندروید/iOS/وب
 * وابسته نیست و تست‌پذیر می‌ماند.
 */

/** اندازهٔ تصویر بر حسب پیکسل. */
export interface Size {
  width: number;
  height: number;
}

/** نقطه روی صفحه — محورها مثل همیشه: x راست، y پایین. */
export interface Point {
  x: number;
  y: number;
}

/** مستطیلِ برش — همان قراردادِ `crop` در expo-image-manipulator. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** دامنهٔ بزرگ‌نماییِ ویرایشگر. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** گِرد کردنِ زاویه به بازهٔ [۱۸۰−، ۱۸۰]. ۱۸۰ و −۱۸۰ یکی‌اند (همان نیم‌دایره). */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;

  const wrapped = ((deg % 360) + 360) % 360;

  return wrapped >= 180 ? wrapped - 360 : wrapped;
}

/** ضریبِ کشیدگیِ بوم: ‌|cos θ| + |sin θ| — از ۱ تا √۲. */
export function tiltFactor(angle: number): number {
  const rad = (normalizeAngle(angle) * Math.PI) / 180;

  return Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
}

/** ضلعِ بزرگ‌ترین مربعِ متمرکزِ داخلِ عکسِ چرخیده (بخش ۱ بالا). */
export function safeSide(size: Size, angle: number): number {
  const smallest = Math.min(size.width, size.height);

  if (!(smallest > 0)) return 1;

  return smallest / tiltFactor(angle);
}

/**
 * حاشیهٔ ایمنیِ گِردی — فقط برای زاویه‌هایی که بومِ چرخیده گِرد می‌شود.
 *
 * در مضربِ ۹۰ (و ۰ که چرخشش اصلاً اجرا نمی‌شود) بوم و محتوا دقیقاً یکی
 *‌اند: عدد صحیح، بدونِ کسری، پس برشِ داخلِ بوم همیشه داخلِ محتوا است و
 * این حاشیه لازم نیست — عکسِ صاف باید همان `min(W,H)` تمام بریده شود.
 *
 * ولی در زاویهٔ کج، پلتفرم‌ها بوم را با `ceil` می‌سازند و مرکزِ محتوا تا
 * نیم‌پیکسل با مرکزِ عددیِ بوم فرق می‌کند؛ `floor`ِ مبدأ هم تا یک پیکسل
 * گوشه را بیرون می‌برد. بدونِ این حاشیه، آزمونِ «گوشهٔ برش داخلِ عکس» روی
 * ۴۵ درجه ۱٫۳ پیکسل بیرون می‌زد — نامرئی در نمایشِ دایره‌ای، ولی نشانهٔ
 * این بود که عددِ برش به مرزِ خالی چسبیده است. ۲ پیکسل هر دو خطای گِردی
 * را می‌پوشاند و در بدترین حالت کمتر از یک درصدِ عکسِ کوچک است.
 */
const BOUNDS_MARGIN = 2;

/** آیا این زاویه دقیقاً مضربِ ۹۰ است؟ (۰، ±۹۰، ±۱۸۰) */
function isQuarterTurn(angle: number): boolean {
  return normalizeAngle(angle) % 90 === 0;
}

/** مربعِ امنِ قابلِ استفاده برای برش: مربعِ هندسی منهای حاشیهٔ گِردی. */
function cropSafeSide(size: Size, angle: number): number {
  const safe = safeSide(size, angle);

  return isQuarterTurn(angle) ? safe : Math.max(1, safe - BOUNDS_MARGIN);
}

/** بزرگ‌نماییِ داخلِ دامنه — مبنای همهٔ حساب‌ها، تا جایی که UI و ریاض یک عدد ببینند. */
function boundedZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;

  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** ضلعِ نهاییِ برش: مربعِ امنِ قابلِ استفاده تقسیم‌شده بر بزرگ‌نمایی. */
function cropSide(size: Size, angle: number, zoom: number): number {
  return cropSafeSide(size, angle) / boundedZoom(zoom);
}

/**
 * اندازهٔ عکسِ نمایش‌داده‌شده داخلِ قاب.
 *
 * این همان مقیاس k در بخش ۲ بالا است: طوری بزرگ می‌شود که ناحیهٔ برش
 * دقیقاً هم‌اندازهٔ قاب درآید. `ceil` عمدی است — یک پیکسل بیشتر دیده
 * نمی‌شود ولی یک پیکسلِ کمتر می‌توانست لبهٔ قاب را خالی بگذارد.
 */
export function displaySize(size: Size, angle: number, zoom: number, frame: number): Size {
  const side = cropSide(size, angle, zoom);

  if (!(side > 0) || !(frame > 0)) {
    return { width: Math.max(1, size.width), height: Math.max(1, size.height) };
  }

  const scale = frame / side;

  return {
    width: Math.ceil(size.width * scale),
    height: Math.ceil(size.height * scale),
  };
}

/**
 * بیشترین جابه‌جاییِ مجاز در هر محور، بر حسب پیکسلِ قاب.
 *
 * از بخش ۳: حدِ مجازِ جابه‌جایی نیمِ فاصلهٔ بینِ ضلعِ برش و مربعِ امن
 * است؛ بعد از تبدیل به مختصاتِ صفحه می‌شود `S·(z−۱)/۲`. در zoom=۱ صفر
 * است — درست جایی که برش خودش تا لبهٔ محتوا باز شده.
 */
export function panLimit(zoom: number, frame: number): number {
  if (!(frame > 0)) return 0;

  return (frame * (boundedZoom(zoom) - 1)) / 2;
}

/** نگه‌داشتنِ pan داخلِ همان حد (بخش ۳). */
export function clampPan(pan: Point, zoom: number, frame: number): Point {
  const limit = panLimit(zoom, frame);
  const x = Number.isFinite(pan.x) ? pan.x : 0;
  const y = Number.isFinite(pan.y) ? pan.y : 0;

  return {
    x: Math.min(limit, Math.max(-limit, x)),
    y: Math.min(limit, Math.max(-limit, y)),
  };
}

/**
 * مستطیلِ برش روی بومِ چرخیده — عددِ نهایی که به کتابخانه می‌رود.
 *
 * ورودی‌ها:
 *   source   اندازهٔ عکسِ اصلی (مبنای مربعِ امن)
 *   rotated  اندازهٔ **واقعی** بومِ چرخیده — همان که کتابخانه برگرداند،
 *            نه چیزی که اینجا حدس زده باشیم
 *   pan      جابه‌جاییِ قاب روی صفحه (پیکسل، با نشانه: + راست/پایین)
 *   frame    اندازهٔ قابِ مربع روی صفحه (پیکسل)
 *
 * تضمین‌ها (در test هم هستند): خروجی مربع است، داخل بوم می‌ماند، و
 * گوشه‌هایش پس از برگرداندنِ چرخش داخلِ عکسِ اصلی‌اند — یعنی نه گوشهٔ
 * خالی، نه بیرونِ عکس.
 */
export function cropRect(
  source: Size,
  rotated: Size,
  angle: number,
  zoom: number,
  pan: Point,
  frame: number,
): CropRect {
  const safe = cropSafeSide(source, angle);
  const sideMax = Math.max(1, Math.min(rotated.width || 1, rotated.height || 1));
  const side = Math.min(Math.max(cropSide(source, angle, zoom), 1), sideMax);
  const frameSafe = Number.isFinite(frame) && frame > 0 ? frame : 1;
  const px = Number.isFinite(pan.x) ? pan.x : 0;
  const py = Number.isFinite(pan.y) ? pan.y : 0;

  // مرکز برش خواسته‌شده: مرکزِ بوم، جابه‌جاییِ صفحه که به مختصاتِ بوم
  // برگردد (k = frame/side پس معکوسش side/frame است).
  const wantX = rotated.width / 2 - (px * side) / frameSafe;
  const wantY = rotated.height / 2 - (py * side) / frameSafe;

  // جابه‌جایی تا جایی مجاز است که کلِ برش داخلِ مربعِ امن بماند؛ اینجا
  // همان حد است، نه حدِ بوم — بوم گوشه‌های خالی دارد و مربعِ امن نه.
  const limit = Math.max(0, (safe - side) / 2);
  const cx = Math.min(rotated.width / 2 + limit, Math.max(rotated.width / 2 - limit, wantX));
  const cy = Math.min(rotated.height / 2 + limit, Math.max(rotated.height / 2 - limit, wantY));

  const edge = Math.max(1, Math.floor(side));

  // floorِ عمدی: کوچک‌کردنِ برش هرگز از بوم بیرون نمی‌زند، ولی floor
  // نکردنِ سرِ دیگر (ceil) می‌توانست یک پیکسل از کتابخانه خطای مرز بگیرد.
  const originX = Math.min(
    Math.max(0, Math.floor(cx - side / 2)),
    Math.max(0, rotated.width - edge),
  );
  const originY = Math.min(
    Math.max(0, Math.floor(cy - side / 2)),
    Math.max(0, rotated.height - edge),
  );

  return { originX, originY, width: edge, height: edge };
}
