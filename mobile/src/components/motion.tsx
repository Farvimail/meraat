import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import { GLOW_MAX, pushGlows } from '../lib/glow';
import type { Box, Point } from '../lib/glow';
import { motion } from '../theme';

/**
 * حرکت‌های اپ — عمداً کم و ساده.
 *
 * چرا با `Animated` خودِ React Native و بدون هیچ کتابخانه‌ای: این ماژول بخشی از
 * خود فریم‌ورک است، روی همهٔ پلتفرم‌ها یک رفتار دارد و هیچ وابستگی‌ای به باندل
 * اضافه نمی‌کند. حرکت اینجا تزئین نیست: کارت‌ها با یک ورودِ نرم می‌آیند تا چشم
 * ترتیب خواندن را بفهمد، و حلقهٔ آرام دور دکمهٔ ثبت می‌گوید «کار بعدی اینجاست».
 *
 * نکتهٔ مهم: روی وب ماژول بومیِ انیمیشن وجود ندارد، پس `useNativeDriver` آنجا
 * خاموش است — وگرنه هر اجرا یک هشدار بی‌فایده در کنسول می‌گذارد.
 */
const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * چند پیکسل جابه‌جایی انگشت یعنی «کشیدن»، نه «ضربه».
 *
 * ۱۰ پیکسل انتخاب شده چون ضربهٔ معمولیِ انگشت روی گوشی تا حدود ۵ پیکسل اریب
 * می‌رود و یک کشیدنِ عمدی خیلی زودتر از ۱۰ پیکسل رد می‌شود؛ عددِ کمتر دکمه‌ها
 * را دوباره کور می‌کند و عددِ بیشتر، کشیدنِ لکه‌ها را کند می‌کند.
 *
 * همین آستانه چیزی است که `ScrollView` خودِ ری‌اکت‌نیتیو هم برای جدا کردن
 * «ضربه» از «اسکرول» استفاده می‌کند؛ پس رفتارش برای کاربر آشناست.
 */
const GLOW_DRAG_THRESHOLD = 10;

export function FadeInView({
  children,
  delay = 0,
  offset = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  /** چند پیکسل از پایین بیاید؛ صفر یعنی فقط محو شود. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });

    animation.start();

    // اگر صفحه وسط انیمیشن بسته شود، تایمر معلق نمی‌ماند.
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * حلقهٔ تپنده دور آیکون انگشت.
 *
 * یک دایره که از اندازهٔ اصلی بزرگ‌تر می‌شود و هم‌زمان محو می‌شود؛ بعد از هر
 * تکرار `Animated.loop` خودش مقدار را صفر می‌کند. اندازهٔ جعبه ثابت است تا
 * بزرگ‌شدن حلقه چیدمان را جابه‌جا نکند.
 */
export function PulseHalo({
  size = 44,
  children,
  color = 'rgba(255, 255, 255, 0.55)',
  duration = motion.pulse,
}: {
  size?: number;
  children?: ReactNode;
  color?: string;
  /**
   * یک تپشِ کامل چقدر طول بکشد. دکمهٔ ثبت وقتی مشغول است این را کوتاه‌تر
   * می‌کند تا حلقه تندتر بزند و «در حال انجام» را برساند؛ در حالت عادی
   * همان تپش آرام است که می‌گوید «اینجا کار بعدی است».
   */
  duration?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }),
    );

    loop.start();

    return () => loop.stop();
  }, [progress, duration]);

  return (
    <View style={[styles.haloBox, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) },
            ],
          },
        ]}
      />
      {children}
    </View>
  );
}

/**
 * لکهٔ نوری که آرام داخل کادر می‌چرخد.
 *
 * سرصفحهٔ اپ دو لکهٔ محو دارد که عمداً تزئینی‌اند؛ ایستا که باشند، صفحه مرده
 * به نظر می‌رسد. حرکتِ آرامِ آن‌ها (چند پیکسل در ده ثانیه) همان حسِ «زنده بودن»
 * را می‌دهد، بدون آنکه چشم را بدواند: دامنهٔ حرکت کوچک و مدت طولانی است.
 */
export function DriftGlow({
  style,
  drift = { x: 28, y: 18 },
  duration = 12000,
  delay = 0,
}: {
  style?: StyleProp<ViewStyle>;
  /** بیشترین جابه‌جایی افقی/عمودی به پیکسل. */
  drift?: { x: number; y: number };
  /** مدتِ یک رفت‌وبرگشت کامل. */
  duration?: number;
  delay?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const leg = (toValue: number) =>
      Animated.timing(progress, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: NATIVE_DRIVER,
      });

    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));

    // تأخیر فقط برای شروع است؛ داخل حلقه نیست تا حرکت یک‌نواخت بماند.
    const starter = Animated.delay(delay);
    const sequence = Animated.sequence([starter, loop]);
    sequence.start();

    return () => sequence.stop();
  }, [progress, duration, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift.x] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift.y] }) },
          ],
        },
      ]}
    />
  );
}

/**
 * لکه‌های سرصفحه را با انگشت هل می‌دهد.
 *
 * سه چیز باید کنار هم باشند و اینجا جمع شده‌اند:
 *
 * ۱. **جای کادر روی صفحه.** `locationX` هر رویداد لمسی نسبت به عمیق‌ترین
 *    ویویی حساب می‌شود که لمس رویش افتاده، نه نسبت به کادرِ سرصفحه. پس یک بار
 *    با `measureInWindow` جعبهٔ خودِ کادر را می‌گیریم و موقعیت انگشت را از
 *    `pageX/pageY` به مختصات کادر ترجمه می‌کنیم.
 * ۲. **نقطهٔ شروعِ لمس.** مبنای جابه‌جایی همان جاست، نه سرعتِ لحظه‌ای؛ وگرنه
 *    رفتار روی گوشیِ ۶۰ و ۱۲۰ هرتز دو چیز می‌شد.
 * ۳. **حسابِ خالص.** چه کسی و چقدر جابه‌جا شود کارِ `pushGlows` است؛ اینجا
 *    فقط آن عدد روی `Animated` می‌نشیند و رهای انگشت با یک `spring` نرم
 *    برمی‌گردد.
 *
 * حرکتِ هل‌دادن عمداً با درایورِ JS اجرا می‌شود (`useNativeDriver: false`):
 * مقدارش از رویدادهای لمسی می‌آید و ترکیب‌کردن این مقدار با انیمیشنِ بومیِ
 * گشت‌وگذار روی همان ویو دردسر دارد. دو مقدار کوچک روی نخِ رابط کاربری هیچ
 * هزینهٔ دیدنی ندارند.
 */
export function useGlowPush(
  centers: readonly Point[],
  max = GLOW_MAX,
  /** ضخامتِ نوارِ بالای کادر که کشیدن در آن ممنوع است (پیکسل). */
  deadTop = 0,
) {
  const box = useRef<View>(null);
  const frame = useRef<Box & Point>({ x: 0, y: 0, width: 0, height: 0 });
  const origin = useRef<Point | null>(null);
  /** نقطهٔ اولِ لمس — مبنای تشخیصِ «ضربه» از «کشیدن». */
  const touchStart = useRef<Point | null>(null);
  const offsets = useRef(
    centers.map(() => ({ x: new Animated.Value(0), y: new Animated.Value(0) })),
  ).current;

  /** جای کادرِ سرصفحه روی صفحه؛ با هر چیدمان دوباره خوانده می‌شود. */
  const measure = () => {
    box.current?.measureInWindow((x, y, width, height) => {
      frame.current = { x, y, width, height };
    });
  };

  /** موقعیت انگشت در دستگاه مختصاتِ خودِ کادر. */
  const local = (event: GestureResponderEvent): Point => ({
    x: event.nativeEvent.pageX - frame.current.x,
    y: event.nativeEvent.pageY - frame.current.y,
  });

  const release = () => {
    origin.current = null;

    for (const offset of offsets) {
      for (const value of [offset.x, offset.y]) {
        Animated.spring(value, {
          toValue: 0,
          speed: 18,
          bounciness: 11,
          useNativeDriver: false,
        }).start();
      }
    }
  };

  /**
   * آیا انگشت به‌قدرِ «کشیدن» از نقطهٔ شروع دور شده؟
   *
   * روی گوشی هر ضربهٔ ساده چند پیکسل جابه‌جایی انگشت دارد. اگر کادرِ سرصفحه
   * همان جابه‌جاییِ کم را «کشیدن» حساب کند، لمس را از دکمه‌های داخلش می‌قاپد و
   * `onPress`ِ آن‌ها هیچ‌وقت اجرا نمی‌شود — همان چیزی که باعث می‌شد دکمهٔ سه‌خط
   * روی گوشی هیچ واکنشی نداشته باشد.
   *
   * نکتهٔ دیگر: اگر `onTouchStart` روی این ویو صدا زده نشود (ممکن است وقتی
   * بچه‌ای لمس را می‌گیرد)، خودِ اولین رویدادِ حرکت مبنای سنجش می‌شود — پس
   * همیشه یکی از دو راه کار می‌کند.
   */
  const beyondDragThreshold = (event: GestureResponderEvent): boolean => {
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };

    if (!touchStart.current) {
      touchStart.current = point;
    }

    /*
     * نوارِ دکمه‌ها: از نوارِ بالای سرصفحه (نشان و دکمهٔ منو) هیچ‌وقت کشیدن
     * نمی‌سازیم.
     *
     * آستانه‌ی بالا برای ضربهٔ معمولی کافی است، ولی گوشیِ دستِ عجول تا بیش از
     * ۱۰ پیکسل هم اریب می‌رود؛ این نوار تضمین می‌کند دکمه‌های آن بالا در هر
     * حالتی کار کنند. ضخامتش از خودِ کادر خوانده می‌شود، پس روی همهٔ صفحه‌ها
     * درست می‌ماند.
     */
    if (
      deadTop > 0 &&
      frame.current.height > 0 &&
      touchStart.current.y - frame.current.y <= deadTop
    )
      return false;

    return (
      Math.abs(point.x - touchStart.current.x) > GLOW_DRAG_THRESHOLD ||
      Math.abs(point.y - touchStart.current.y) > GLOW_DRAG_THRESHOLD
    );
  };

  const endTouch = () => {
    touchStart.current = null;
  };

  return {
    /** روی همان ویویی می‌خورد که `handlers` رویش پخش می‌شود. */
    ref: box,
    offsets,
    handlers: {
      onLayout: measure,
      onTouchStart: (event: GestureResponderEvent) => {
        touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      },
      // فقط کشیدنِ واقعی گرفته می‌شود؛ ضربه روی دکمه‌ها مالِ خودِ دکمه‌هاست.
      onMoveShouldSetResponder: beyondDragThreshold,
      onResponderGrant: (event: GestureResponderEvent) => {
        measure();
        origin.current = local(event);
      },
      onResponderMove: (event: GestureResponderEvent) => {
        if (!origin.current) return;

        const next = pushGlows(local(event), origin.current, frame.current, centers, max);

        next.forEach((value, index) => {
          offsets[index].x.setValue(value.x);
          offsets[index].y.setValue(value.y);
        });
      },
      onResponderRelease: () => {
        endTouch();
        release();
      },
      onResponderTerminate: () => {
        endTouch();
        release();
      },
      // ضربه‌ای که هیچ‌وقت به «کشیدن» تبدیل نشد: مبنا پاک شود تا لمسِ بعدی
      // از نقطهٔ خودش حساب شود.
      onTouchEnd: endTouch,
      onTouchCancel: endTouch,
    },
  };
}

const styles = StyleSheet.create({
  haloBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1.5,
  },
});
