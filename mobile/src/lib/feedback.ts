import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { PermissionsAndroid, Platform, Vibration } from 'react-native';
import type { Permission } from 'react-native';

import type { PunchIntent } from './punch';

/**
 * بازخوردِ ثبت: صدا و لرزش.
 *
 * چرا این ماژول جدا است: ثبت حضور یک کارِ «کورکورانه» است — کاربر گوشی را در
 * دست دارد، انگشت می‌گذارد و منتظر می‌ماند. اگر فقط صفحه عوض شود، معلوم نیست
 * ثبت انجام شد یا نه؛ صدا و لرزش همان لحظه جواب می‌دهند. ورود و خروج دو صدای
 * متفاوت دارند تا بدون نگاه‌کردن هم بشود تشخیص داد کدام یکی ثبت شد.
 *
 * قاعدهٔ مهم: این ماژول **هرگز نباید خطا پرت کند**. اگر گوشی روی حالت بی‌صدا
 * باشد، پخش صدا در دسترس نباشد یا مرورگر اجازه ندهد، ثبتِ حضور باید بی‌هیچ
 * مشکلی انجام شود. پس همه‌جا خطا بلعیده می‌شود — ولی فقط خطای همین بازخورد.
 */

export type PunchSoundStyle = 'chime' | 'bell' | 'marimba' | 'soft';

/**
 * سبکِ صدا. برای عوض کردن، فقط همین یک خط را تغییر دهید:
 *
 *   chime    — زنگِ گرم و کم‌درخشش، نرم و «شیک» (پیش‌فرض)
 *   bell     — زنگِ روشن‌تر با هم‌سازهای ناساده؛ روی بلندگوی گوشی تیزتر است
 *   marimba  — کوبشی و کوتاه، شبیه ماریمبا
 *   soft     — کم‌حجم و خیلی کوتاه، مناسب محیط ساکت
 *
 * فایل‌ها با `node tools/make-sounds.mjs` ساخته می‌شوند.
 */
const PUNCH_STYLE: PunchSoundStyle = 'chime';

const SOURCES: Record<PunchSoundStyle, Record<PunchIntent, number>> = {
  chime: {
    start: require('../../assets/sounds/punch-in-chime.wav') as number,
    pause: require('../../assets/sounds/punch-out-chime.wav') as number,
  },
  bell: {
    start: require('../../assets/sounds/punch-in-bell.wav') as number,
    pause: require('../../assets/sounds/punch-out-bell.wav') as number,
  },
  marimba: {
    start: require('../../assets/sounds/punch-in-marimba.wav') as number,
    pause: require('../../assets/sounds/punch-out-marimba.wav') as number,
  },
  soft: {
    start: require('../../assets/sounds/punch-in-soft.wav') as number,
    pause: require('../../assets/sounds/punch-out-soft.wav') as number,
  },
};

/** هر صدا یک پخش‌کنندهٔ تنبل‌ساز دارد که بین ثبت‌ها بازاستفاده می‌شود. */
const players: Partial<Record<string, AudioPlayer>> = {};
let audioMode: Promise<void> | null = null;

/**
 * حالت صدا یک بار و به‌صورت تنبل آماده می‌شود.
 *
 * `mixWithOthers` عمدی است: صدای ثبت یک افکت کوتاه است و نباید موسیقی یا
 * پادکستی که کاربر گوش می‌دهد را قطع کند. `playsInSilentMode` هم روشن است تا
 * روی کلید بی‌صدای آیفون، ثبت بی‌صدا نشود.
 */
function prepareAudioMode(): Promise<void> {
  audioMode ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  }).then(
    () => undefined,
    () => undefined,
  );

  return audioMode;
}

/** صدای ثبتِ ورود یا خروج. بی‌صدا شکست می‌خورد، بلند نمی‌شود. */
export function playPunchSound(intent: PunchIntent): void {
  void (async () => {
    try {
      await prepareAudioMode();

      const key = `${PUNCH_STYLE}:${intent}`;
      const player = players[key] ?? (players[key] = createAudioPlayer(SOURCES[PUNCH_STYLE][intent]));

      // ثبت‌های پشت‌سرهم: پخش‌کننده از وسط صدا شروع نشود.
      if (player.currentTime > 0) {
        await player.seekTo(0);
      }

      player.play();
    } catch {
      // بی‌صدا شدن اپ هرگز نباید ثبت را ناموفق کند.
    }
  })();
}

/**
 * «حسِ ثبت» — چرا دو موتور و چرا جدا برای هر پلتفرم.
 *
 * هپتیکِ اکسپو (expo-haptics) روی گوشی‌هایی که موتورِ هپتیک ندارند یا خاموش
 * است، بی‌صدا و بی‌اثر برمی‌گردد و هیچ خطایی هم نمی‌دهد؛ نتیجه این بود که ثبت
 * انجام می‌شد ولی کاربر هیچ لرزشی حس نمی‌کرد. پس:
 *
 *   • روی اندروید `performAndroidHapticsAsync` از خودِ هپتیکِ سیستم استفاده
 *     می‌کند و **به مجوزِ VIBRATE نیاز ندارد** (پس روی اپ‌های قبلی هم کار
 *     می‌کند)، و `Vibration` هم کنارش می‌ماند تا وقتی مجوز هست لرزشِ
 *     محسوس‌تری بیاید. ۱۲۰ms برای ورود و ۹۰ms برای
 *     خروج انتخاب شده: ۶۰ms روی خیلی از گوشی‌ها فقط یک «تپشِ محو» است.
 *   • روی iOS فقط هپتیک می‌آید، چون `Vibration` آی‌اواس مدت را نادیده
 *     می‌گیرد و یک لرزشِ ۴۰۰ میلی‌ثانیه‌ای می‌زند که آزاردهنده است.
 *   • روی وب هر دو بی‌اثرند (لرزش در دسکتاپ وجود ندارد) و چیزی نمی‌شکند.
 */
function vibrateSystem(duration: number): void {
  if (Platform.OS === 'ios') return;

  // اندروید: لرزشِ موتورِ گوشی (نیازمندِ مجوزِ VIBRATE).
  //
  // وب: `Vibration` خودِ React Native وب به `navigator.vibrate` وصل است، پس اگر
  // اپ در مرورگر گوشی باز شده باشد هم لرزش می‌دهد (کرومِ اندروید پشتیبانی
  // می‌کند؛ سافاری iOS نه). پیش‌تر روی وب هیچ کاری نمی‌شد و کسی که اپ را در
  // مرورگر گوشی باز کرده بود، «ویبره کار نمی‌کند» می‌دید.
  try {
    Vibration.vibrate(duration);
  } catch {
    // پشتیبانی‌نشدنِ لرزش در مرورگر نباید صدای ثبت را هم از کار بیندازد.
  }
}

/**
 * هپتیکِ مخصوصِ اندروید — بدون نیاز به مجوزِ VIBRATE.
 *
 * تفاوتش با `Vibration` همین است: مسیرِ هپتیکِ خودِ اندروید
 * (`View.performHapticFeedback`) است و به مجوزِ سیستمیِ لرزش کار ندارد. اگر
 * اپِ نصب‌شده پیش از اضافه‌شدنِ `android.permission.VIBRATE` ساخته شده باشد،
 * `Vibration` بی‌صدا هیچ‌کاری نمی‌کند و کاربر فکر می‌کند «ویبره کار نمی‌کند»؛
 * این مسیر همان‌جا هم جواب می‌دهد.
 *
 * روی iOS و وب بی‌صدا برمی‌گردد؛ آن دو مسیرِ خودشان را دارند.
 */
function androidHaptic(type: Haptics.AndroidHaptics): void {
  if (Platform.OS !== 'android') return;

  void Haptics.performAndroidHapticsAsync(type).catch(() => undefined);
}

/**
 * لرزشِ کوتاهِ «دکمه را گرفتم».
 *
 * دقیقاً لحظهٔ فشردن دکمه زده می‌شود، نه بعد از جوابِ سرور: تأییدِ اثر انگشت و
 * رفت‌وبرگشتِ شبکه ممکن است چند ثانیه طول بکشد و تا آن موقع کاربر فکر می‌کند
 * ضربه‌اش ثبت نشده.
 */
export function punchPressHaptic(): void {
  androidHaptic(Haptics.AndroidHaptics.Gesture_Start);
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => undefined);
  // ۶۰ms و نه کمتر: روی گوشی‌هایی با موتورِ لرزشِ ساده (ERM)، تپش‌های
  // کوتاه‌ترِ ۵۰ میلی‌ثانیه‌ای موتور را روشن نمی‌کنند و کاربر حسشان نمی‌کند.
  vibrateSystem(60);
}

/** لرزشِ تأییدِ ثبت (بعد از ثبتِ موفقِ سرور). */
export function punchHaptic(intent: PunchIntent): void {
  const style = intent === 'start' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

  androidHaptic(Haptics.AndroidHaptics.Confirm);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  void Haptics.impactAsync(style).catch(() => undefined);
  vibrateSystem(intent === 'start' ? 150 : 110);
}

/** لرزشِ «نشد»: دو ضربهٔ پشت‌سرهم تا از لرزشِ ثبتِ موفق قابل‌تشخیص باشد. */
export function punchFailureHaptic(): void {
  androidHaptic(Haptics.AndroidHaptics.Reject);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);

  if (Platform.OS === 'android') Vibration.vibrate([0, 70, 110, 70]);
}

/** بازخورد کامل ثبتِ موفق. */
export function notifyPunchRecorded(intent: PunchIntent): void {
  playPunchSound(intent);
  punchHaptic(intent);
}

/* ------------------------------------------------------- آزمایش و تشخیص */

/**
 * الگوی «آزمایش لرزش»: سه تپشِ بلند و بی‌ابهام.
 *
 * عمداً بلند است (۲۵۰ms با ۱۴۰ms فاصله): هدفِ این الگو «دیدنِ لرزش» نیست،
 * «حس‌کردنِ قطعیِ آن» است. اگر این هم حس نشود، مسئله در کدِ اپ نیست.
 */
const BUZZ_TEST_PATTERN = [0, 250, 140, 250, 140, 250];

/** مجوزِ نصب‌شدهٔ لرزش — هم‌نامِ رشتهٔ اندروید. */
const VIBRATE_PERMISSION: string = 'android.permission.VIBRATE';

/**
 * نتیجهٔ آزمایشِ لرزش — برای نشان‌دادن به کاربر، نه برای لاگ.
 *
 * چرا گزارش لازم شد: «ویبره کار نمی‌کند» سه علتِ کاملاً متفاوت دارد و از
 * بیرون نمی‌شود تشخیص داد کدام است:
 *
 *   ۱) کدِ اپ هرگز صدا نمی‌زند (باگ) → گزارش می‌گوید چند موتور اجرا شد.
 *   ۲) اپِ در حالِ اجرا مجوزِ لرزش ندارد (نصبِ قدیمی) → گزارش `denied` می‌دهد.
 *   ۳) موتورِ گوشی نیست یا لرزشِ گوشی در تنظیمات خاموش است → مجوز `granted`
 *      است، هر سه موتور اجرا شده‌اند، ولی هیچ‌چیز حس نمی‌شود.
 *
 * حالت سوم را اپ نمی‌تواند درست کند، ولی کاربر باید بداند که باید سراغِ
 * تنظیماتِ گوشی برود — نه اینکه دوباره منتظرِ نسخهٔ بعدیِ اپ بماند.
 */
export interface BuzzReport {
  platform: string;
  /** سطحِ API اندروید؛ روی iOS و وب `null`. */
  apiLevel: number | null;
  /** وضعیتِ مجوزِ VIBRATE در همین نصب. */
  vibrate: 'granted' | 'denied' | 'unknown';
  /** موتورهایی که واقعاً اجرا شدند. */
  engines: string[];
}

async function vibratePermission(): Promise<BuzzReport['vibrate']> {
  if (Platform.OS !== 'android') return 'unknown';

  try {
    // رشتهٔ مجوز عمداً دستی داده شده: `VIBRATE` در فهرستِ تایپ‌شدهٔ React
    // Native نیست (آن فهرست فقط مجوزهای *درخواستنی* است؛ این یکی هنگامِ نصب
    // داده می‌شود) ولی خودِ API هر رشتهٔ مجوزی را می‌پذیرد.
    const granted = await PermissionsAndroid.check(VIBRATE_PERMISSION as Permission);

    return granted ? 'granted' : 'denied';
  } catch {
    // مجوزِ اعلام‌نشده در مانیفستِ همین نصب: `check` خطا می‌دهد، نه `false`.
    return 'denied';
  }
}

/**
 * همهٔ موتورهای لرزش را یکی‌یکی امتحان می‌کند و می‌گوید کدام‌ها اجرا شدند.
 *
 * ترتیب عمدی است: اول مسیری که «مجوز نمی‌خواهد» (`performAndroidHapticsAsync`
 * که از موتورِ هپتیکِ خودِ سیستم استفاده می‌کند)، بعد موتورِ لرزش، و آخر
 * `navigator.vibrate` روی وب. اگر مسیری در دسترس نباشد، فقط همان یکی خطا
 * می‌دهد و بقیه اجرا می‌شوند.
 */
export async function buzzTest(): Promise<BuzzReport> {
  const engines: string[] = [];

  if (Platform.OS === 'android') {
    try {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
      engines.push('سیستم');
    } catch {
      // روی گوشی‌های قدیمی‌تر از اندروید ۱۱ این مسیر وجود ندارد.
    }
  }

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    engines.push('هپتیک');
  } catch {
    // بی‌اثر؛ موتورِ بعدی امتحان می‌شود.
  }

  try {
    if (Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      engines.push('اعلان');
    } else {
      Vibration.vibrate(BUZZ_TEST_PATTERN);
      engines.push('لرزش');
    }
  } catch {
    // بی‌اثر.
  }

  return {
    platform: Platform.OS,
    apiLevel: Platform.OS === 'android' ? Number(Platform.Version) || null : null,
    vibrate: await vibratePermission(),
    engines,
  };
}

/**
 * جملهٔ فارسیِ نتیجهٔ آزمایش — همان که کاربر روی صفحه می‌خواند.
 *
 * «حس نشد» را اپ نمی‌تواند بفهمد (هیچ API‌ای نمی‌گوید موتور لرزید یا نه)، پس
 * جمله عمداً دو شاخه دارد و شاخهٔ سوم را به عهدهٔ کاربر می‌گذارد: اگر مجوز
 * هست و موتورها اجرا شده‌اند، سراغِ تنظیماتِ گوشی برود.
 */
export function buzzAdvice(report: BuzzReport): string {
  const tried = report.engines.length
    ? `موتورهای اجراشده: ${report.engines.join('، ')}.`
    : 'هیچ موتور لرزشی در دسترس نبود.';

  const device =
    report.apiLevel === null ? report.platform : `${report.platform} — API ${report.apiLevel}`;

  if (report.vibrate === 'denied') {
    return `لرزش در این نصب مجوز ندارد (${device}). ${tried} برای فعال‌شدن باید اپ با نسخهٔ جدید یک‌بار نصب شود.`;
  }

  return `هر سه مسیر لرزش اجرا شد (${device}). ${tried} اگر حس نشد، لرزشِ گوشی یا «بازخورد لمسی» در تنظیمات صدای گوشی خاموش است.`;
}
