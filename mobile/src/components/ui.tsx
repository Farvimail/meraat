import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GLOW_MAX } from '../lib/glow';
import type { Point } from '../lib/glow';
import { toPersianDigits } from '../lib/jalali';
import type { PhotoSource } from '../lib/profile-photo';
import { colors, motion, radius, shadow, spacing } from '../theme';
import { DriftGlow, PulseHalo, useGlowPush } from './motion';

/**
 * اجزای مشترک رابط کاربری.
 *
 * راست‌به‌چپ عمداً با استایل صریح (`row-reverse` و `textAlign: 'right'`)
 * نوشته شده و به `I18nManager.forceRTL` تکیه نمی‌کند؛ چون آن یک تنظیم نیتیو
 * است که با هر نصب اپ و هر بار ساخت باید از نو اعمال شود و اگر جا بماند،
 * چیدمان بی‌سروصدا برعکس می‌شود.
 */

/** مسیر ثابت و نسبی لازم است تا Metro تصویر را در زمان باندل پیدا کند. */
const LOGO_MARK = require('../../assets/logo.png');

/**
 * مرکزِ دو لکهٔ نوریِ سرصفحه، در مختصات نرمالِ کادر (۰ تا ۱).
 *
 * عددها عمداً از خودِ استایلِ لکه‌ها جدا شده‌اند: حسابِ «کدام لکه به انگشت
 * نزدیک‌تر است» به پیکسلِ گوشی کاری ندارد. این مراکز بیرونِ ۰..۱ هم می‌توانند
 * باشند — نیمی از هر لکه بیرونِ کادر است.
 */
const GLOW_CENTERS: Point[] = [
  { x: 0.88, y: 0 },
  { x: 0.12, y: 1 },
];

/**
 * ضخامتِ نوارِ بالای سرصفحه که کشیدنِ لکه‌ها در آن ممنوع است (پیکسل).
 *
 * ارتفاعِ یک ردیفِ دکمه (۳۸) به‌علاوهٔ فاصله‌های بالا و پایینش؛ کافی است که
 * دکمهٔ منو و نشانِ اپ کامل داخلش باشند.
 */
const HERO_ACTIONS_BAND = 64;

/**
 * گشت‌وگذارِ آرامِ هر لکه: دامنه و مدتِ یک رفت‌وبرگشت.
 *
 * مدت‌ها متفاوت‌اند تا دو لکه هرگز هم‌زمان به هم نرسند؛ یک‌نواخت حرکت‌کردن
 * وقتی توی چشم می‌زند که مثل مترونوم هم‌زمان باشد.
 */
const GLOW_DRIFT = [
  { drift: { x: 52, y: 36 }, duration: 11000, delay: 0 },
  { drift: { x: -46, y: -32 }, duration: 14000, delay: 1200 },
];

type GlowPush = (index: number) => {
  transform: ({ translateX: Animated.Value } | { translateY: Animated.Value })[];
};

/**
 * انگشتِ روی سرصفحه: مرجع، رویدادها و ترنسفورمِ هل‌دادنِ هر لکه.
 *
 * هر سرصفحه‌ای که `HeroGlows` دارد با همین یک قطعه زنده می‌شود — صفحهٔ اصلی،
 * سابقه و ورود — تا واکنش به کشیدنِ انگشت یک‌دست بماند و در جایی فراموش
 * نشود. والد باید هم `ref` را بگیرد و هم `handlers` را پخش کند و لکه‌ها را با
 * `push={pushed}` به `HeroGlows` بدهد.
 *
 * `HERO_ACTIONS_BAND` یعنی «این نوارِ بالا مالِ دکمه‌هاست»: نشان، نام اپ و
 * دکمهٔ منو/بازگشت هرگز لمسِ خود را به کشیدنِ لکه‌ها نمی‌دهند — روی گوشی،
 * ضربهٔ انگشت چند پیکسل اریب می‌رود و بدونِ این نوار، دکمهٔ گوشهٔ بالا بعضی
 * وقت‌ها بی‌واکنش می‌ماند.
 *
 * ترنسفورمِ برگشتی روی ویویِ بیرونیِ هر لکه می‌نشیند؛ دو لایه چرا: ویویِ
 * بیرونی جابه‌جاییِ «هل‌دادن با انگشت» را می‌برد و لکهٔ داخلی گشت‌وگذارِ آرامِ
 * خودش را — دو انیمیشن مستقل روی یک ترنسفورم قاطی نمی‌شوند.
 */
export function useHeroGlow() {
  const glows = useGlowPush(GLOW_CENTERS, GLOW_MAX, HERO_ACTIONS_BAND);

  const pushed: GlowPush = (index) => ({
    transform: [
      { translateX: glows.offsets[index].x },
      { translateY: glows.offsets[index].y },
    ],
  });

  return { ref: glows.ref, handlers: glows.handlers, pushed };
}

/**
 * دو لکهٔ نوریِ سرصفحه — همان‌هایی که صفحهٔ اصلی دارد.
 *
 * چرا جدا شد: بالای صفحهٔ ورود هم باید همان حسِ صفحهٔ اصلی را بدهد وگرنه اپ
 * دو چهره پیدا می‌کند. حالا هر دو سرصفحه همین یک قطعه را می‌گذارند، پس رنگ،
 * اندازه و سرعتشان هیچ‌وقت از هم جدا نمی‌شود.
 *
 * `push` اختیاری است: هر سرصفحه‌ای که بخواهد انگشت به لکه‌ها برسد آن را از
 * `useHeroGlow` می‌گیرد (همهٔ سرصفحه‌های اپ همین‌طور می‌کنند). والدِ این قطعه
 * باید `overflow: hidden` داشته باشد، وگرنه لکه از کادر می‌زند بیرون.
 */
export function HeroGlows({ push }: { push?: GlowPush }) {
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.heroGlowTop, push?.(0)]}>
        <DriftGlow style={styles.heroGlowTopPaint} {...GLOW_DRIFT[0]} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.heroGlowBottom, push?.(1)]}>
        <DriftGlow style={styles.heroGlowBottomPaint} {...GLOW_DRIFT[1]} />
      </Animated.View>
    </>
  );
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * قالب صفحه.
 *
 * نوار وضعیت بالای صفحه با `topColor` رنگ می‌شود تا صفحهٔ داشبورد سبز یکدست
 * باشد و بالای صفحهٔ ورود با پس‌زمینهٔ روشن. اگر فقط `SafeAreaView` را سبز
 * می‌کردیم، بالای صفحهٔ ورود هم سبز می‌شد.
 */
export function Screen({
  children,
  topColor = colors.bg,
  backgroundColor,
}: {
  children: ReactNode;
  topColor?: string;
  /** رنگ زمینهٔ محتوا؛ پیش‌فرض خاکستریِ پالت است. */
  backgroundColor?: string;
}) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: topColor }]} edges={['top']}>
      <View style={[styles.screenContent, backgroundColor ? { backgroundColor } : null]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

/** نشان اپ: لوگو داخل یک مربع گرد سفید تا روی زمینهٔ تیره هم خوانا باشد. */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.3 },
      ]}
    >
      <Image
        source={LOGO_MARK}
        style={{ width: size * 0.8, height: size * 0.8 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * تصویر پروفایل، دایره‌ای — بالای کارتِ کارکرد امروز.
 *
 * `uris` یک فهرستِ اولویت‌دار است (اول عکسِ خودِ کارمند، بعد عکسِ پیش‌فرضِ
 * سرور — از `avatarSources`). هر نشانی که باز نشود به بعدی نوبت می‌دهد، و
 * اگر هیچ‌کدام نیامد (آفلاین) حروفِ اوّلِ نام روی همان دایره می‌نشیند تا
 * چیدمان نلغزد.
 *
 * رد شدن بر اساسِ **خودِ نشانی** نگه داشته می‌شود، نه یک پرچمِ ساده: اگر بعد
 * از رفرش، سرور عکسِ تازه‌ای بدهد، نشانیِ نو در فهرستِ رد‌شده‌ها نیست و بلافاصله
 * نشان داده می‌شود (با یک پرچمِ ساده، تا ری‌استارتِ اپ، حروف می‌ماند).
 */
export function Avatar({
  name,
  uris = [],
  size = 92,
}: {
  name: string;
  /**
   * نشانی‌های کاملِ تصویر به ترتیبِ اولویت. اگر کارمند عکسی ندارد باید
   * عکسِ پیش‌فرضِ سرور در فهرست باشد (نه `null`)، وگرنه فقط حروف دیده
   * می‌شود. حروف اوّل آخرین پشتوانه است.
   */
  uris?: (string | null | undefined)[];
  size?: number;
}) {
  /** نشانی‌هایی که باز نشده‌اند — به همین ترتیب از فهرست رد می‌شوند. */
  const [skipped, setSkipped] = useState<string[]>([]);
  const current = uris.find((uri) => Boolean(uri) && !skipped.includes(uri as string)) || null;
  const showImage = Boolean(current);

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? '؟'
      : parts.length === 1
        ? parts[0].slice(0, 2)
        : `${parts[0][0]}${parts[parts.length - 1][0]}`;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {showImage ? (
        <Image
          source={{ uri: current as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setSkipped((prev) => [...prev, current as string])}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.avatarInitials, { fontSize: Math.round(size * 0.34) }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

/**
 * سرصفحهٔ صفحهٔ اصلی.
 *
 * جای «داشبورد» سه چیزِ به‌درد‌بخور نشسته است: نام کارمند، ساعتِ مرجع، و
 * اطمینانِ «این ساعت از سرور می‌آید نه از گوشی». برای اپ حضور و غیاب، ساعتِ
 * مرجع مهم‌ترین اطلاعاتِ بالای صفحه است.
 *
 * ساعت عمداً **بدون ثانیه** نشان داده می‌شود: ثانیه‌شمار چیزی به تصمیم کاربر
 * اضافه نمی‌کند و فقط باعث می‌شود چشم هر ثانیه به سرصفحه بپرد. حسِ زنده‌بودن
 * را دو لکهٔ نورِ محو می‌دهند که آرام داخل کادر همین سرصفحه می‌چرخند.
 *
 * همان دو لکه به انگشت هم جواب می‌دهند: انگشت را روی کادر بکشید، هر لکه
 * خلافِ کشیدنِ انگشت جابه‌جا می‌شود و لکهٔ نزدیک‌تر بیشتر؛ انگشت که برداشته
 * شود، هر دو با فنر به جای خودشان برمی‌گردند. کارِ حسابش در `useGlowPush` و
 * `lib/glow.ts` است.
 */
export function HeroHeader({
  clock,
  date,
  clockNote,
  onMenu,
}: {
  /** ساعت زندهٔ سرور به شکل `۰۸:۳۲:۰۵`. */
  clock: string;
  date: string;
  clockNote: string;
  /** منوی سه‌خطِ گوشهٔ بالا-چپ: «سابقهٔ روزها» و «خروج» داخلش می‌نشیند. */
  onMenu: () => void;
}) {
  const { ref, handlers, pushed } = useHeroGlow();

  return (
    <View ref={ref} style={styles.hero} {...handlers}>
      <HeroGlows push={pushed} />

      {/* نام و سمتِ کارمند دیگر اینجا نیست — همان پایین، زیر عکس پروفایل،
          بزرگ‌تر و کامل‌تر نوشته می‌شود. جای این کادر، هویتِ اپ می‌نشیند تا
          سرصفحه در همهٔ صفحه‌ها یک چهره داشته باشد. */}
      <View style={styles.heroTop}>
        <View style={styles.heroBrand}>
          <BrandMark size={34} />

          <View style={styles.heroWho}>
            <Text style={styles.heroName} numberOfLines={1}>
              مِرآت
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              حضور و غیاب کارکنان
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="منوی صفحه"
          onPress={onMenu}
          hitSlop={12}
          style={({ pressed }) => [styles.heroAction, pressed && styles.pressedSoft]}
        >
          <MaterialCommunityIcons name="menu" size={22} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.clockBlock}>
        <Text style={styles.heroClock} allowFontScaling={false}>
          {clock}
        </Text>
        <Text style={styles.heroDate}>{date}</Text>

        <View style={styles.clockTag}>
          <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.onDark} />
          <Text style={styles.clockTagText}>{clockNote}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * سرصفحهٔ صفحه‌های داخلی (سابقه).
 *
 * عمداً همان سرصفحهٔ سبزِ صفحهٔ اصلی است — با همان دو لکهٔ نور و همان هویت
 * («مِرآت» / «حضور و غیاب کارکنان») — و فقط دو چیز به آن اضافه شده: دکمهٔ
 * بازگشت و یک سطر جمعِ بسته. صفحهٔ سابقه نباید یک صفحهٔ جدا و بی‌ربط به اپ
 * به نظر برسد؛ کاربر با زدن یک دکمه واردش می‌شود و باید حس کند در همان اپ
 * مانده است.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { ref, handlers, pushed } = useHeroGlow();

  return (
    <View ref={ref} style={styles.appHero} {...handlers}>
      <HeroGlows push={pushed} />

      <View style={styles.heroTop}>
        <View style={styles.heroBrand}>
          <BrandMark size={34} />

          <View style={styles.heroWho}>
            <Text style={styles.heroName} numberOfLines={1}>
              مِرآت
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              حضور و غیاب کارکنان
            </Text>
          </View>
        </View>

        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بازگشت"
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.heroAction, pressed && styles.pressedSoft]}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.appHeroFoot}>
        <Text style={styles.appHeroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.appHeroSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
  flat = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * بدون سایه. صفحه‌های سفیدِ اپ (اصلی و سابقه) با خطِ نازکِ دور کارت از هم
   * جدا می‌شوند، نه با سایه؛ سایه روی زمینهٔ سفید فقط کادر را «شناور» و
   * کدر نشان می‌دهد.
   */
  flat?: boolean;
}) {
  return <View style={[styles.card, flat && styles.cardFlat, style]}>{children}</View>;
}

export function Banner({
  text,
  tone = 'error',
}: {
  text: string;
  tone?: 'error' | 'info' | 'success';
}) {
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle-outline' as const },
    info: { bg: colors.brandSoft, fg: colors.brand, icon: 'information-outline' as const },
    success: { bg: colors.brandSoft, fg: colors.brand, icon: 'check-circle-outline' as const },
  }[tone];

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <MaterialCommunityIcons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function Field({
  label,
  icon,
  trailing,
  style,
  ...inputProps
}: {
  label: string;
  icon?: IconName;
  /** چیزی که داخل کادر و در سمت چپ می‌نشیند (مثل دکمهٔ نمایش رمز). */
  trailing?: ReactNode;
} & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.inputShell}>
        <TextInput
          placeholderTextColor={colors.muted}
          {...inputProps}
          style={[styles.input, style]}
        />

        {icon ? (
          <MaterialCommunityIcons name={icon} size={19} color={colors.muted} style={styles.inputIcon} />
        ) : null}

        {trailing}
      </View>
    </View>
  );
}

/**
 * دکمهٔ اصلی.
 *
 * شکلش عمداً همان دکمهٔ ثبتِ صفحهٔ اصلی است (شعاع `lg` و سایهٔ `raised`)، چون
 * در هر دو صفحه این دکمه «کارِ بعدی» است؛ یکی ثبت حضور، یکی ورود. `md` و
 * سایهٔ کارت، دکمهٔ ورود را کنارِ فیلدها یک دکمهٔ معمولی نشان می‌داد.
 */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        inactive && styles.buttonInactive,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.primaryButtonLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

/**
 * دکمهٔ کارت‌شکل — برای کارهای فرعی، مثل «سابقهٔ روزها».
 *
 * چرا پوسته‌اش همان `card` است: دکمهٔ قاب‌دارِ قبلی از زبانِ بصریِ صفحه بیرون
 * می‌زد و شبیه یک فرم وب بود. این یکی همان کارتِ سفیدِ گوشه‌گرد و سایه‌دارِ
 * کارتِ کارکرد را می‌پوشد، پس در یک نگاه از همان خانواده دیده می‌شود؛ چیزی که
 * آن را «رفتنی» نشان می‌دهد فلشِ سمت چپ و جای خالیِ وسط سطر است، نه رنگ.
 */
export function CardButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardButton, pressed && styles.cardPressed]}
    >
      {icon ? (
        <View style={styles.cardButtonIcon}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.brand} />
        </View>
      ) : null}

      <Text style={styles.cardButtonLabel}>{label}</Text>

      <MaterialCommunityIcons name="chevron-left" size={20} color={colors.muted} />
    </Pressable>
  );
}

/**
 * دکمهٔ اصلیِ ثبت.
 *
 * آیکون انگشت عمداً بخشی از دکمه است تا کاربر بفهمد برای ثبت باید انگشت بگذارد،
 * نه فقط ضربه بزند. ارتفاعش اندازهٔ استاندارد دکمهٔ اصلی است (۵۶) — نه یک بلوکِ
 * بزرگ؛ توجه را همان حلقهٔ آرامِ دور آیکون جلب می‌کند.
 *
 * رنگ دو حالت عمداً متفاوت است: «ورود» سبز و «خروج» سرمه‌ای، تا در یک نگاهِ
 * سرسری، خروج به‌جای ورود زده نشود.
 *
 * در حال ثبت، حلقهٔ دور انگشت **تندتر** می‌زند و برچسب به «در حال ثبت…» عوض
 * می‌شود؛ قبلاً جای انگشت یک اسپینر می‌آمد و انگشت ناپدید می‌شد — همان لحظه‌ای
 * که کاربر باید بداند انگشتش خوانده شده است.
 */
export function PunchButton({
  label,
  tone = 'start',
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  tone?: 'start' | 'pause';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  const background = tone === 'start' ? colors.brand : colors.slate;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.punchButton,
        { backgroundColor: background },
        shadow.raised,
        inactive && styles.buttonInactive,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      <PulseHalo size={34} duration={loading ? motion.fast : motion.pulse}>
        <MaterialCommunityIcons name="fingerprint" size={26} color={colors.white} />
      </PulseHalo>

      <Text style={styles.punchLabel}>{loading ? 'در حال ثبت…' : label}</Text>
    </Pressable>
  );
}

/**
 * نشان وضعیت، داخلِ یک **کادرِ مشخص**: «وضعیت: حاضر» یا «وضعیت: توقف».
 *
 * کادرِ قاب‌دار عمداً جایگزینِ نشانِ بدونِ مرزِ قبلی شده است: کاربر باید در
 * یک نگاه ببیند این یک وضعیتِ زنده از سرور است، نه متنِ تزئینیِ عنوان.
 */
export function StatusBox({ present }: { present: boolean }) {
  /**
   * چشمک‌زدنِ دایره فقط در حالتِ «حاضر»: دایرهٔ سبز خاموش و روشن می‌شود تا
   * زنده بودنِ شیفت از همان نگاهِ اول معلوم باشد. حالتِ «توقف» عمداً
   * بی‌حرکت و روشن می‌ماند تا «شیفت باز نیست» با «داریم ولی قطع است»
   * اشتباه گرفته نشود.
   *
   * فقط `opacity` عوض می‌شود — تغییرِ اندازه روی این نقطهٔ کوچک لرزشِ
   * ناخوشایند می‌سازد — و روی درایور بومی اجرا می‌شود پس چشمک بدونِ پرشِ
   * فریم می‌آید؛ حلقه با unmount یا عوض شدنِ وضعیت متوقف می‌شود.
   */
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // توقف: نقطه روشن و ثابت — هیچ حلقه‌ای در کار نیست.
    if (!present) {
      blink.stopAnimation();
      blink.setValue(1);
      return;
    }

    // حاضر: همیشه از روشن شروع شود، هر بار که وضعیت عوض شده باشد.
    blink.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, present]);

  return (
    <View style={[styles.statusBox, present ? styles.statusBoxOn : styles.statusBoxOff]}>
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: present ? colors.accent : colors.muted,
            opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.18] }),
          },
        ]}
      />
      <Text style={[styles.statusBoxText, present && styles.statusBoxTextOn]}>
        وضعیت: {present ? 'حاضر' : 'توقف'}
      </Text>
    </View>
  );
}

export function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} allowFontScaling={false}>
        {value}
      </Text>
    </View>
  );
}

/**
 * نمایشگر کارکرد امروز.
 *
 * رقم‌ها `tabular-nums` هستند تا با هر ثانیه پهنای متن تغییر نکند و تایمر
 * نلرزد؛ عرض ثابت یکی از تفاوت‌های «حساب‌شده» و «لرزان» است.
 */
export function TimerDisplay({
  value,
  running,
  caption,
}: {
  /** مثل `۰۲:۱۷:۴۳` */
  value: string;
  running: boolean;
  caption: string;
}) {
  return (
    <View style={styles.timer}>
      <Text
        style={[styles.timerValue, !running && styles.timerValueIdle]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.timerCaption}>{caption}</Text>
    </View>
  );
}

/** یک ردیف از نوار «امنیت» — آیکون، عنوان و وضعیت. */
export function InfoRow({
  icon,
  label,
  value,
  tone = 'ok',
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  const fg = tone === 'ok' ? colors.brand : colors.warning;

  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={17} color={fg} />
      <Text style={styles.infoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function FullScreenLoader({ text }: { text: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
}

/**
 * پیش‌بارگذاریِ برندشده — لحظه‌ای که کاربر بعد از باز شدن یک صفحه می‌بیند.
 *
 * چرا نشان + اسپینر + یک جملهٔ کوتاه، و نه فقط اسپینر: این لحظه در اپ
 * حضور‌وغیاب همیشه هست (داده از سرور می‌آید) و اگر صفحه یک‌باره از سفیدی به
 * محتوا بپرد، کاربر فکر می‌کند خطا شد و صفحه را می‌بندد. پس همان کادر سبزِ
 * سرصفحه پر می‌شود، نشان اپ وسط می‌نشیند و اسپینر کار می‌کند.
 */
export function BrandBoot({
  text,
  tone = 'dark',
}: {
  text: string;
  /**
   * `dark` یعنی تمام‌صفحه روی همان سبزِ سرصفحه (پیش‌بارگذاریِ اولِ اپ)،
   * `light` یعنی داخلِ بدنهٔ صفحهٔ سفید که سرصفحه‌اش همان بالا هست — مثل
   * صفحهٔ سابقه که دادهٔ فهرستش دیرتر می‌رسد.
   */
  tone?: 'dark' | 'light';
}) {
  return (
    <View style={[styles.boot, tone === 'light' && styles.bootLight]}>
      <BrandMark size={tone === 'light' ? 56 : 68} />
      <ActivityIndicator size="large" color={tone === 'light' ? colors.brand : colors.accent} />
      <Text style={[styles.bootText, tone === 'light' && styles.bootTextLight]}>{text}</Text>
    </View>
  );
}

/** یک سطرِ منوی سه‌خط. */
export type MenuItem = {
  key: string;
  label: string;
  icon: IconName;
  /** رنگ و معنا: کارهای عادی سبز، کارهای برگشت‌ناپذیر (خروج) قرمز. */
  tone?: 'brand' | 'danger';
  onPress: () => void;
};

/**
 * منوی کشوییِ گوشهٔ بالا-چپ (زیر همان دکمهٔ سه‌خطِ سرصفحه).
 *
 * چرا داخل مودال: منو باید بیرون از جریانِ صفحه بنشیند؛ اگر داخل کادرِ
 * سرصفحه رندر شود، ارتفاع کادر با باز و بسته شدن منو می‌پرد و لکه‌های نور
 * جابه‌جا می‌شوند. اینجا پس‌زمینهٔ تیره همهٔ صفحه را می‌پوشاند، کارتِ منو زیر
 * همان دکمه باز می‌شود، و یک ضربه روی جای دیگرِ صفحه منو را می‌بندد.
 *
 * «سابقهٔ روزها» و «خروج از حساب» عمداً از بدنهٔ صفحهٔ اصلی برداشته و اینجا
 * جمع شده‌اند: بالای صفحه اول باید همان چیزی باشد که کاربر هر روز لازم دارد
 * (ساعت و وضعیت)، نه دکمه‌های جانبی.
 */
export function MenuSheet({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: MenuItem[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="بستن منو"
        onPress={onClose}
        style={styles.menuBackdrop}
      >
        {/* کارتِ منو خودش Pressable است تا ضربهٔ روی سطرها به پس‌زمینه نرسد. */}
        <Pressable style={styles.menuCard} onPress={() => undefined}>
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuRow,
                index > 0 && styles.menuRowDivided,
                pressed && styles.menuRowPressed,
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={19}
                color={item.tone === 'danger' ? colors.danger : colors.brand}
              />
              <Text style={[styles.menuLabel, item.tone === 'danger' && styles.menuLabelDanger]}>
                {item.label}
              </Text>
              <MaterialCommunityIcons name="chevron-left" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * کارتِ پروفایل: عکسِ فعلی و راه‌های عوض کردنش.
 *
 * چرا مودال و نه صفحهٔ جدا: کارِ این کارت یک انتخاب و یک آپلود است و برگشتن
 * از یک صفحهٔ کامل، مسیرِ پرتی بود که تایمرِ کارکرد را هم از چشم دور
 * می‌کرد. اینجا همان چیزی که کاربر قبلاً دیده (عکس و نام) می‌ماند و فقط
 * چند کار کنارش می‌آید.
 *
 * برشِ عکس در خودِ پیکرِ سیستم انجام می‌شود (`pickerOptions` → قابِ مربع)،
 * پس این کارت فقط پیش‌نمایش می‌گذارد و همان قاب را توضیح می‌دهد؛ آپلود هم
 * پیش از فرستادن حجم را کم می‌کند.
 */
export function ProfileSheet({
  visible,
  name,
  role,
  uris,
  hasPhoto,
  busy,
  progress,
  note,
  onPick,
  onRemove,
  onClose,
}: {
  visible: boolean;
  name: string;
  role?: string | null;
  /** فهرستِ اولویت‌دارِ تصویر، مثل همان که به `Avatar` می‌رود. */
  uris: (string | null | undefined)[];
  /** عکسِ خودِ کارمند روی سرور هست؟ (اگر نه، «حذف» بی‌معنی است) */
  hasPhoto: boolean;
  /** در حال آپلود یا حذف. */
  busy: boolean;
  /**
   * پیشرفتِ آپلود (صفر تا یک). عدد باشد یعنی دارد آپلود می‌شود و نوارِ
   * درصد نشان می‌رود؛ `null` یعنی کارِ دیگری در جریان است (مثلاً حذف)
   * و همان چرخندهٔ قبلی کافی است. کلیدِ اصلیِ این نوار همین تفکیک است:
   * «ذخیره روی سرور» برای کاربرِ اینترنتِ ضعیف معنایش «شاید هیچ‌وقت» بود.
   */
  progress?: number | null;
  /** پیامِ وضعیت/خطای همین کارت — جدا از خطای بالای صفحهٔ اصلی. */
  note?: string | null;
  onPick: (source: PhotoSource) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const rows: Array<{
    key: string;
    label: string;
    icon: IconName;
    danger?: boolean;
    onPress: () => void;
  }> = [
    {
      key: 'library',
      label: 'انتخاب از گالری',
      icon: 'image-multiple-outline',
      onPress: () => onPick('library'),
    },
    {
      key: 'camera',
      label: 'گرفتن عکس با دوربین',
      icon: 'camera-outline',
      onPress: () => onPick('camera'),
    },
  ];

  if (hasPhoto) {
    rows.push({
      key: 'remove',
      label: 'حذف عکس و بازگشت به پیش‌فرض',
      icon: 'trash-can-outline',
      danger: true,
      onPress: onRemove,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        چیدمان عمدی: یک لایهٔ تمام‌صفحه که خودش دکمه است (ضربه روی بیرونِ کارت
        = بستن) و کارتی که **کنارش** نشسته، نه داخلش.

        چرا: اگر کارت داخلِ همان دکمه باشد، در نسخهٔ وب دکمه‌های داخل کارت
        داخل یک `<button>` می‌نشینند (`<button>` تودرتو) — HTML نامعتبر و
        برای صفحه‌خوان گیج‌کننده؛ مرورگر هم همان را در کنسول هشدار می‌دهد.
      */}
      <View style={[styles.menuBackdrop, styles.sheetBackdrop]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="بستن پروفایل"
          onPress={onClose}
          style={styles.sheetDismiss}
        />

        <View style={styles.profileCard}>
          <Avatar name={name} size={112} uris={uris} />

          <Text style={styles.profileName}>{name.trim() === '' ? '—' : name}</Text>
          {role ? <Text style={styles.profileRole}>{role}</Text> : null}

          <Text style={styles.profileHint}>
            عکس بعد از انتخاب در ویرایشگر باز می‌شود: زاویه و بزرگ‌نمایی را تنظیم کنید تا
            داخلِ قابِ مربع بنشیند — همان قاب در پنل وب هم دیده می‌شود.
          </Text>

          {note ? <Text style={styles.profileNote}>{note}</Text> : null}

          {busy ? (
            <View style={styles.profileBusy}>
              {typeof progress === 'number' ? (
                <View style={styles.profileProgressWrap}>
                  <View style={styles.profileProgressTrack}>
                    <View
                      style={[
                        styles.profileProgressFill,
                        { width: `${Math.min(100, Math.max(0, Math.round(progress * 100)))}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.profileHint}>
                    {`در حال آپلود عکس… ${toPersianDigits(Math.round(progress * 100))}٪`}
                  </Text>
                </View>
              ) : (
                <>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.profileHint}>در حال ذخیره روی سرور…</Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.profileActions}>
              {rows.map((row, index) => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={row.onPress}
                  style={({ pressed }) => [
                    styles.profileAction,
                    index > 0 && styles.profileActionDivided,
                    pressed && styles.menuRowPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={row.icon}
                    size={19}
                    color={row.danger ? colors.danger : colors.brand}
                  />
                  <Text style={[styles.profileActionLabel, row.danger && styles.menuLabelDanger]}>
                    {row.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بستن"
            onPress={onClose}
            style={({ pressed }) => [styles.profileClose, pressed && styles.menuRowPressed]}
          >
            <Text style={styles.profileCloseLabel}>بستن</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  mark: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  avatar: {
    // زمینهٔ سبزِ ملایم + حلقهٔ نازک: روی زمینهٔ سفیدِ صفحه هم مرزش مشخص
    // بماند، و اگر عکس نبود حروف اول روی همین دایره بنشیند.
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    color: colors.brand,
    fontWeight: '700',
  },

  hero: {
    backgroundColor: colors.brandDeep,
    paddingHorizontal: spacing.lg,
    /* ارتفاع سرصفحه عمداً حدود ۳۰٪ کمتر از قبل است: عددها و ترتیبِ خودش
       (نشان + ساعت) عوض نشده، فقط فاصله‌های خالی جمع شده‌اند. کادرِ بلند،
       محتوا را به پایینِ صفحه هل می‌داد و کاربر اول باید اسکرول می‌کرد. */
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    gap: spacing.md,
    ...shadow.header,
  },
  // لکه‌ها دو لایه دارند: این‌ها فقط جای نشستن‌اند (ویوی بیرونی، همان که با
  // انگشت هل داده می‌شود) و رنگ و گردی روی لایهٔ داخلی است (`heroGlow*Paint`).
  // لکه‌ها هم به نسبتِ کادرِ کوتاه‌ترِ سرصفحه کوچک شده‌اند (۲۴۰→۱۸۰ و
  // ۲۲۰→۱۶۰)؛ اگر همان اندازهٔ قبل می‌ماند، نسبتِ خالی/پر به‌هم می‌خورد و
  // سرصفحه به‌جای «آرام» شلوغ دیده می‌شد.
  heroGlowTop: {
    position: 'absolute',
    top: -92,
    right: -54,
    width: 180,
    height: 180,
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -104,
    left: -46,
    width: 160,
    height: 160,
  },
  heroGlowTopPaint: {
    flex: 1,
    borderRadius: 90,
    backgroundColor: 'rgba(30, 158, 90, 0.30)',
  },
  heroGlowBottomPaint: {
    flex: 1,
    borderRadius: 80,
    backgroundColor: colors.veil,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroBrand: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroWho: {
    alignItems: 'flex-end',
    gap: 1,
  },
  heroName: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  heroMeta: {
    color: colors.onDark,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  heroAction: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.veil,
  },

  clockBlock: {
    alignItems: 'center',
    gap: 2,
  },
  heroClock: {
    color: colors.white,
    // همان بزرگ‌ترین عددِ سرصفحه می‌ماند (۴۴→۳۸) ولی به همان نسبتِ کم‌شدنِ
    // ارتفاع کادر کوچک شده تا کادرِ کوتاه‌تر، بالا و پایینِ ساعت خالی نماند.
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  heroDate: {
    color: colors.onDark,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  clockTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.veil,
  },
  clockTagText: {
    color: colors.onDark,
    fontSize: 11.5,
    writingDirection: 'rtl',
  },

  appHero: {
    // همان قالبِ سرصفحهٔ اصلی — فقط دو سطرِ هویت/جمع در پایینش هست.
    backgroundColor: colors.brandDeep,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    gap: spacing.md,
    ...shadow.header,
  },
  appHeroFoot: {
    alignItems: 'center',
    gap: 2,
  },
  appHeroTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  appHeroSubtitle: {
    color: colors.onDark,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  headerSide: {
    width: 38,
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  headerSubtitle: {
    color: colors.onDark,
    fontSize: 12,
    marginTop: 2,
    writingDirection: 'rtl',
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardFlat: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  boot: {
    flex: 1,
    backgroundColor: colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  bootLight: {
    backgroundColor: 'transparent',
  },
  bootText: {
    color: colors.onDark,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  bootTextLight: {
    color: colors.muted,
  },

  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 22, 14, 0.55)',
  },
  menuCard: {
    // جای ثابت و فیزیکی (`top`/`left`) عمدی است: در چیدمانِ راست‌به‌چپ،
    // `alignItems: 'flex-start'` جای دکمهٔ سه‌خط (گوشهٔ چپ) را نمی‌دهد.
    position: 'absolute',
    top: 76,
    left: spacing.lg,
    minWidth: 236,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.xs,
    ...shadow.raised,
  },
  menuRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  menuRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  menuRowPressed: {
    backgroundColor: colors.slateSoft,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.ink,
    writingDirection: 'rtl',
  },
  menuLabelDanger: {
    color: colors.danger,
  },

  banner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  field: {
    gap: spacing.xs + 2,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputShell: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 6,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputIcon: {
    opacity: 0.9,
  },

  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...shadow.raised,
  },
  primaryButtonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  buttonInactive: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  pressedSoft: {
    opacity: 0.7,
  },

  cardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    // از پدینگِ کارت کمی کم می‌شود تا دکمه قدِ یک کارتِ محتوا را نگیرد.
    paddingVertical: spacing.md + 2,
    // سایهٔ کارت برای این دکمه عمداً خاموش است: صفحهٔ اصلی زمینهٔ سفید
    // دارد و کنارِ کارتِ بدونِ سایهٔ تایمر، دو سایهٔ کم‌رنگ فقط چشم را
    // خسته می‌کند؛ مرزِ کادر خودش برای «رفتنی» بودن کافی است.
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardPressed: {
    backgroundColor: colors.slateSoft,
  },
  cardButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  cardButtonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  punchButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  punchLabel: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    writingDirection: 'rtl',
  },

  statusBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  statusBoxOn: {
    backgroundColor: colors.brandSoft,
    borderColor: '#CBE5D7',
  },
  statusBoxOff: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBoxText: {
    fontSize: 13,
    color: colors.muted,
    writingDirection: 'rtl',
  },
  statusBoxTextOn: {
    color: colors.brand,
    fontWeight: '700',
  },

  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: 12.5,
    color: colors.muted,
    writingDirection: 'rtl',
  },
  statValue: {
    // بزرگ‌تر از قبل (۲۰ → ۲۶): ساعت ورود/خروج یکی از دو عددی است که کاربر
    // دنبالش می‌گردد و باید بدون خم‌شدن به صفحه خوانده شود.
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  timer: {
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  timerValue: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  timerValueIdle: {
    color: colors.muted,
  },
  timerCaption: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    writingDirection: 'rtl',
  },
  infoValue: {
    // مقدار کوتاه است و باید یک‌خطی بماند؛ اگر جایی جا نشد، کوتاه می‌شود نه خط‌شکن.
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    writingDirection: 'rtl',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loaderText: {
    color: colors.muted,
    fontSize: 14,
    writingDirection: 'rtl',
  },

  /* ------------------------------------------------------ کارتِ پروفایل */
  sheetBackdrop: {
    // پس‌زمینهٔ منو بالا‌چسب است؛ کارتِ پروفایل وسطِ صفحه می‌نشیند.
    justifyContent: 'center',
    padding: spacing.lg,
  },
  /** لایهٔ شفافِ بستن؛ تمام صفحه را می‌پوشاند و کارت رویش می‌نشیند. */
  sheetDismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  profileCard: {
    // `zIndex` تا کارت روی لایهٔ تمام‌صفحهٔ بستن بنشیند و ضربه‌های داخلش به
    // آن لایه نرسد.
    zIndex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow.raised,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  profileRole: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  profileHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  profileNote: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  profileBusy: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  profileProgressWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileProgressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    overflow: 'hidden',
  },
  profileProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  profileActions: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  profileAction: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  profileActionDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  profileActionLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  profileClose: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  profileCloseLabel: {
    color: colors.muted,
    fontSize: 13,
    writingDirection: 'rtl',
  },
});
