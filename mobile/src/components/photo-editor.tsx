/*
 * ویرایشگرِ عکسِ پروفایل — چرخش، بزرگ‌نمایی، جابه‌جایی، قابِ مربع.
 *
 * چرا مودالِ تمام‌صفحه و نه یک کارتِ داخلِ کارتِ پروفایل:
 *   ۱) قابِ مربع باید آن‌قدر بزرگ باشد که کاربر ببیند دقیقاً چه چیزی
 *      ذخیره می‌شود (WYSIWYG — همان قراردادِ `photo-edit.ts`).
 *   ۲) لایهٔ `ProfileSheet` دکمه‌هایش را داخلِ یک `Pressable`ِ بزرگ می‌نشاند؛
 *      یک مودالِ تمام‌صفحهٔ دیگر این تودرتو را تکرار نمی‌کند و مثل
 *      `PresenceScanSheet` از همان ابتدای باز شدن روی مودالِ قبلی می‌نشیند.
 *
 * قراردادهایی که اینجا رعایت شده‌اند:
 *   - همهٔ حساب‌ها در `lib/photo-edit.ts` است؛ این فایل فقط رندر و رویداد
 *     است. پس پیش‌نمایش و خروجیِ نهایی هیچ‌وقت از هم فاصله نمی‌گیرند.
 *   - زاویه از دو بخش ساخته می‌شود: `quarter` (۰ تا ۳ چرخشِ ۹۰ درجه‌ای) و
 *     `tilt` (کجیِ آزاد از −۹۰ تا ۹۰ روی لغزنده). با این دو، هر زاویه‌ای
 *     ممکن است ولی لغزنده همیشه همان بازهٔ ثابت را نشان می‌دهد و از دستِ
 *     کاربر در نمی‌رود.
 *   - `quarter` در لغزنده نشان داده نمی‌شود چون «چرخشِ ۹۰ درجه» دکمهٔ خودش
 *     را دارد؛ لغزنده برای همان کجیِ ظریف است (افقِ کجِ عکسِ گرفته‌شده).
 *   - همهٔ جابه‌جایی‌ها با `pageX` حساب می‌شوند نه `locationX`: عکس از قاب
 *     بیرون می‌زند و `locationX` ممکن است به خودِ عکس بگوید، نه به قاب.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toPersianDigits } from '../lib/jalali';
import type { Point } from '../lib/photo-edit';
import { ZOOM_MAX, ZOOM_MIN, clampPan, displaySize, normalizeAngle, panLimit } from '../lib/photo-edit';
import { renderSquarePhoto } from '../lib/photo-render';
import type { PickedPhoto } from '../lib/profile-photo';
import { colors, radius, spacing } from '../theme';

/**
 * متنِ کوتاهِ دلیلِ شکست — برای نمایش روی صفحه.
 *
 * چرا خالی برنمی‌گردد: خطاهای موتورِ ویرایش (نبودنِ ماژولِ نیتیو، نبودنِ
 * اندازهٔ تصویر، اجازهٔ فایل) تنها جایی که دیده می‌شوند همین متن است؛ بدونِ
 * آن، کاربر فقط «کار نکرد» می‌بیند و هیچ سرنخی روی گوشی نمی‌ماند.
 */
function smallReason(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const flat = raw.replace(/\s+/g, ' ').trim();

  if (flat === '') return 'دلیلِ فنی روی این گوشی گزارش نشد.';

  return flat.length > 140 ? `${flat.slice(0, 137)}…` : flat;
}

/** گامِ لغزندهٔ زاویه (درجه) و بزرگ‌نمایی. */
const TILT_STEP = 1;
const ZOOM_STEP = 0.1;
const TILT_MIN = -90;
const TILT_MAX = 90;

export function PhotoEditorSheet({
  photo,
  onCancel,
  onConfirm,
}: {
  /** عکسِ انتخاب‌شده؛ `null` یعنی مودال بسته است. */
  photo: PickedPhoto | null;
  onCancel: () => void;
  /** عکسِ نهایی (چرخیده و بریده) — آمادهٔ همان `setPhoto`ِ قبلی. */
  onConfirm: (photo: PickedPhoto) => void;
}) {
  const [quarter, setQuarter] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [rendering, setRendering] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /**
   * دلیلِ فنیِ شکستِ ویرایش — فقط وقتی پُر می‌شود که `renderSquarePhoto`
   * خطا داده باشد.
   *
   * دو کار می‌کند: (۱) به کاربر راهِ دومی می‌دهد — فرستادنِ همان عکسِ
   * انتخاب‌شده بدون چرخش/برش، تا عکسش را از دست ندهد (اگر موتورِ ویرایشِ
   * همان دستگاه کار نکند، تنها راهِ رسیدن به نتیجه همین است)؛ (۲) متنِ خطا
   * را روی صفحه می‌آورد، چون خطای ماژولِ نیتیو فقط در همین متن دیده می‌شود
   * و بدونِ آن هیچ سرنخی از خودِ گوشی بیرون نمی‌آید.
   */
  const [problemDetail, setProblemDetail] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // قاب عمداً سقف دارد: بزرگ‌تر از این دیگر « جزئیات » نیست، فقط فضا می‌سوزاند.
  const frame = Math.min(screenWidth - spacing.lg * 2, 320);

  const angle = normalizeAngle(quarter * 90 + tilt);

  const source = {
    width: photo?.width ?? 0,
    height: photo?.height ?? 0,
  };
  const hasSize = source.width > 0 && source.height > 0;

  const shown = hasSize
    ? displaySize(source, angle, zoom, frame)
    : { width: frame, height: frame };

  /*
   * هر بار که عکسِ تازه‌ای می‌آید، وضعیت پاک شود — وگرنه زاویهٔ عکسِ قبلی
   * روی عکس بعدی می‌نشیند. `token` هم نگهبانِ همان تلاشِ «در حال ذخیره» است:
   * اگر کاربر وسطِ آماده‌سازی مودال را ببندد، جوابِ آن تلاش بی‌اعتبار می‌شود
   * و عکسِ لغو‌شده روی سرور نمی‌رود.
   */
  const token = useRef(0);

  useEffect(() => {
    token.current += 1;
    setQuarter(0);
    setTilt(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRendering(false);
    setProblem(null);
    setProblemDetail(null);
  }, [photo?.uri]);

  /*
   * جابه‌جایی با کشیدنِ انگشت روی قاب. مبنا در `grant` گرفته می‌شود و در
   * `move` فقط اختلاف اضافه می‌شود؛ هر بار هم دوباره داخلِ حدِ مجازِ همان
   * `zoom` فشرده می‌شود تا عکس هرگز قاب را خالی نگذارد.
   */
  const drag = useRef<{ start: Point; base: Point } | null>(null);
  const live = useRef({ zoom, pan, frame });
  live.current = { zoom, pan, frame };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // کشیدنِ شروع‌شده باید تا آخر مالِ همین قاب بماند.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const current = live.current;
          drag.current = {
            start: { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY },
            base: clampPan(current.pan, current.zoom, current.frame),
          };
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          if (!drag.current) return;

          const current = live.current;
          const next = clampPan(
            {
              x: drag.current.base.x + (event.nativeEvent.pageX - drag.current.start.x),
              y: drag.current.base.y + (event.nativeEvent.pageY - drag.current.start.y),
            },
            current.zoom,
            current.frame,
          );

          setPan(next);
        },
        onPanResponderRelease: () => {
          drag.current = null;
        },
        onPanResponderTerminate: () => {
          drag.current = null;
        },
      }),
    [],
  );

  const apply = async () => {
    if (!photo || rendering || !hasSize) return;

    const attempt = ++token.current;
    setProblem(null);
    setProblemDetail(null);
    setRendering(true);

    try {
      const result = await renderSquarePhoto(photo, { angle, zoom, pan, frame });

      // مودال بسته شده (یا عکسِ دیگری باز شده) — جوابِ این تلاش دیگر مهم نیست.
      if (attempt !== token.current) return;

      onConfirm(result);
    } catch (error) {
      if (attempt !== token.current) return;
      setProblem('عکس آماده نشد؛ دوباره تلاش کنید یا عکس را بدون ویرایش بفرستید.');
      setProblemDetail(smallReason(error));
    } finally {
      if (attempt === token.current) setRendering(false);
    }
  };

  const reset = () => {
    setQuarter(0);
    setTilt(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setProblem(null);
    setProblemDetail(null);
  };

  /** مقدارِ زاویه پس از فشردنِ دکمهٔ ۹۰ درجه. */
  const rotateQuarter = () => setQuarter((value) => (value + 1) % 4);

  /** بزرگ‌نماییِ کوچک‌تر، جایی برای جابه‌جایی باقی نمی‌گذارد؛ pan باید همراهش جمع شود. */
  const changeZoom = (value: number) => {
    setZoom(value);
    setPan((current) => clampPan(current, value, frame));
  };

  return (
    <Modal
      visible={photo !== null}
      animationType="slide"
      onRequestClose={onCancel}
      transparent={false}
    >
      {/*
       * محتوای مودال روی همهٔ صفحه‌ها باید اسکرول شود: قابِ ۳۲۰ پیکسلی به
       * اضافهٔ لغزنده‌ها و دکمهٔ «استفاده از عکس» روی گوشی‌های کوتاه (یا
       * پنلِ وبِ تنگ) از ارتفاعِ صفحه بلندتر می‌شود و بدون اسکرول، دکمهٔ
       * تأیید زیرِ خطِ دید می‌ماند. `flexGrow: 1` هم می‌گذارد وقتی محتوا
       * کوتاه است، دکمهٔ تأیید به پایینِ صفحه بچسبد (همان `marginTop:auto`).
       */}
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <View style={styles.header}>
          <Text style={styles.title}>ویرایش عکس</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="لغو ویرایش"
            disabled={rendering}
            onPress={onCancel}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>لغو</Text>
          </Pressable>
        </View>

        {/* ---------------- قابِ مربع (پیش‌نمایشِ دقیقِ خروجی) ---------------- */}
        <View style={styles.stage}>
          <View
            {...responder.panHandlers}
            style={[styles.frame, { width: frame, height: frame }]}
          >
            {hasSize ? (
              // چپ/بالا از هندسهٔ `photo-edit` می‌آید: عکس دقیقاً طوری چیده
              // می‌شود که داخلِ این قاب همان ناحیه‌ای دیده شود که برشِ نهایی
              // برمی‌دارد. چرخش هم روی همین جعبه می‌نشیند. عکس خودش
              // responder نیست، پس لمسِ رویش مثل لمسِ قاب به زیرِ آن می‌رود.
              <Image
                source={{ uri: photo?.uri ?? '' }}
                resizeMode="cover"
                style={{
                  position: 'absolute',
                  left: (frame - shown.width) / 2 + pan.x,
                  top: (frame - shown.height) / 2 + pan.y,
                  width: shown.width,
                  height: shown.height,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            ) : (
              <Text style={styles.frameProblem}>اندازهٔ عکس در دسترس نیست.</Text>
            )}

            {/* راهنمای دایره: همان چیزی که در پنل وب و آواتار دیده می‌شود. */}
            <View pointerEvents="none" style={[styles.circle, { borderRadius: frame / 2 }]} />
          </View>

          <Text style={styles.stageHint}>
            عکس را داخلِ قاب بکشید تا جابه‌جا شود؛ دایره همان چیزی است که در پنل وب دیده
            می‌شود.
          </Text>
        </View>

        {/* ---------------- لغزنده‌ها و دکمه‌ها ---------------- */}
        <View style={styles.controls}>
          <EditorSlider
            label="زاویه"
            value={tilt}
            min={TILT_MIN}
            max={TILT_MAX}
            step={TILT_STEP}
            format={(value) => `${toPersianDigits(Math.round(value))}°`}
            onChange={setTilt}
          />

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="چرخش نود درجه"
              onPress={rotateQuarter}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="rotate-right" size={18} color={colors.brand} />
              <Text style={styles.actionLabel}>چرخش ۹۰°</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="بازگشت به حالت اولیه"
              onPress={reset}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="restart" size={18} color={colors.muted} />
              <Text style={[styles.actionLabel, styles.actionLabelMuted]}>حالت اولیه</Text>
            </Pressable>
          </View>

          <EditorSlider
            label="بزرگ‌نمایی"
            value={zoom}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            format={(value) => `${toPersianDigits(value.toFixed(1))}×`}
            onChange={changeZoom}
          />
        </View>

        {/* ---------------- پیام و تأیید ---------------- */}
        <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}

          {problemDetail ? <Text style={styles.problemDetail}>{problemDetail}</Text> : null}

          {rendering ? (
            <View style={styles.rendering}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.renderingLabel}>در حال آماده‌سازی عکس…</Text>
            </View>
          ) : (
            <>
              {/* وقتی ویرایش شکست خورده، همان عکسِ انتخاب‌شده هم راهِ
                  درست دارد: سرور و پنل هر نسبتِ تصویری را می‌پذیرند و
                  «عکسِ نابریده» خیلی بهتر از «عکسِ نرفتە» است. */}
              {problemDetail !== null && photo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="فرستادن عکس بدون ویرایش"
                  onPress={() => onConfirm(photo)}
                  style={({ pressed }) => [styles.sendRaw, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name="image-outline" size={18} color={colors.white} />
                  <Text style={styles.sendRawLabel}>فرستادن عکس بدون ویرایش</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="استفاده از عکس"
                disabled={!hasSize}
                onPress={() => void apply()}
                style={({ pressed }) => [
                  styles.confirm,
                  !hasSize && styles.confirmDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons name="check" size={19} color={colors.white} />
                <Text style={styles.confirmLabel}>استفاده از عکس</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

/**
 * لغزندهٔ دستی (بی‌وابستگی): پروژه اسلایدرِ جدا ندارد و اضافه کردنِ
 * `@react-native-community/slider` فقط برای دو لغزنده سربارِ نتیو است.
 * با همان ابزارِ همه‌جا — `PanResponder` — ساخته می‌شود و روی وب هم کار
 * می‌کند. مقدار از **اختلافِ** `pageX` نسبت به نقطهٔ شروع حساب می‌شود، نه
 * از `locationX` و نه از مختصاتِ پنجره: نه به فرزندِ زیر انگشت وابسته است،
 * نه به اندازه‌گیریِ ناهم‌زمان، و در چیدمانِ RTL هم همان معنی را می‌دهد.
 */
function EditorSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const drag = useRef<{ startX: number; base: number } | null>(null);

  // تازه‌ترین مقدارها برای پاسخ‌گوییِ داخلِ `PanResponder`؛ آن کlosure فقط
  // یک بار ساخته می‌شود و اگر props را مستقیم بخواند، همان نسخهٔ اولِ
  // رندر را نگه می‌دارد — با ref همیشه آخرین را می‌بیند.
  const live = useRef({ value, min, max, step, trackWidth, onChange });
  live.current = { value, min, max, step, trackWidth, onChange };

  const responder = useMemo(() => {
    /** تبدیلِ موقعیتِ انگشت به مقدارِ گام‌خورده — فقط با propsِ تازه. */
    const update = (pageX: number) => {
      const current = live.current;
      const started = drag.current;

      if (!started || current.trackWidth <= 0) return;

      const span = current.max - current.min;
      if (span <= 0) return;

      const baseRatio = (started.base - current.min) / span;
      const moved = (pageX - started.startX) / current.trackWidth;
      const ratio = Math.min(1, Math.max(0, baseRatio + moved));
      const raw = current.min + ratio * span;
      const stepped = Math.round((raw - current.min) / current.step) * current.step + current.min;
      // گِردِ اعشاریِ `۰٫۱ + ۰٫۲` را می‌گیرد، وگرنه `۰٫۳۰۰۰۰۰۰۰۰۰۰۰۰۴` روی صفحه می‌آید.
      const next = Number(
        Math.min(current.max, Math.max(current.min, Number(stepped.toFixed(6)))).toFixed(6),
      );

      if (next !== current.value) current.onChange(next);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        drag.current = { startX: event.nativeEvent.pageX, base: live.current.value };
        update(event.nativeEvent.pageX);
      },
      onPanResponderMove: (event: GestureResponderEvent) => update(event.nativeEvent.pageX),
      onPanResponderRelease: () => {
        drag.current = null;
      },
      onPanResponderTerminate: () => {
        drag.current = null;
      },
    });
  }, []);

  const ratio = max > min ? (value - min) / (max - min) : 0;

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHead}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{format(value)}</Text>
      </View>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`لغزندهٔ ${label}`}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + step));
          if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - step));
        }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
        style={styles.sliderTouch}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>

        <View
          pointerEvents="none"
          style={[styles.sliderThumb, { left: `${Math.round(ratio * 100)}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#0b1a12',
  },
  sheetContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.xl + spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  cancel: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  cancelLabel: {
    color: colors.white,
    fontSize: 13,
  },
  stage: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.85)',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameProblem: {
    color: 'rgba(255,255,255,.7)',
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.55)',
  },
  stageHint: {
    color: 'rgba(255,255,255,.66)',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  sliderBlock: {
    gap: 6,
  },
  sliderHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  sliderValue: {
    color: 'rgba(255,255,255,.75)',
    fontSize: 13,
    // عددِ لغزنده عمداً با چیدمانِ بین‌المللی چپ‌چین می‌ماند؛ لغزنده در
    // همهٔ زبان‌ها از چپ به راست رشد می‌کند و برعکس کردنش فقط گیج می‌کند.
    textAlign: 'left',
  },
  sliderTouch: {
    height: 40,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,.18)',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    marginLeft: -11,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  action: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  actionLabel: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  actionLabelMuted: {
    color: 'rgba(255,255,255,.75)',
    fontWeight: '400',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  problem: {
    color: '#ffd9d2',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 21,
  },
  problemDetail: {
    color: 'rgba(255,255,255,.55)',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 18,
  },
  sendRaw: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  sendRawLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  rendering: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  renderingLabel: {
    color: 'rgba(255,255,255,.8)',
    fontSize: 14,
  },
  confirm: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
