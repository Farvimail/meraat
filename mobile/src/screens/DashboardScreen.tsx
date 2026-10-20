import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '../components/motion';
import { PhotoEditorSheet } from '../components/photo-editor';
import {
  Avatar,
  Banner,
  BrandBoot,
  Card,
  HERO_ACTION_SIZE,
  HeroHeader,
  MenuSheet,
  ProfileSheet,
  PunchButton,
  Screen,
  StatBlock,
  StatusBox,
  TimerDisplay,
} from '../components/ui';
import { avatarSources } from '../lib/avatar';
import { pickProfilePhoto } from '../lib/photo-picker';
import type { PhotoSource, PickedPhoto } from '../lib/profile-photo';
import {
  formatClock,
  formatDmyFull,
  formatJalaliShort,
  formatStopwatch,
  toPersianDigits,
} from '../lib/jalali';
import { PUNCH_LABEL, workedSeconds } from '../lib/punch';
import { PresenceScanSheet } from '../components/presence-scan';
import {
  PUNCH_LOCK_NOTE,
  needsQrScan,
  presenceExpired,
  presenceLocksPunch,
  presenceNote,
  presenceReaskNote,
  presenceSecondsLeft,
} from '../lib/presence';
import { useSession } from '../session';
import { colors, radius, spacing } from '../theme';
import HistoryScreen from './HistoryScreen';

export default function DashboardScreen() {
  const {
    employee,
    today,
    error,
    clearError,
    busy,
    punch,
    refresh,
    signOut,
    liveClock,
    photoBusy,
    presence,
    presenceBusy,
    confirmPresence,
    spotlightPresence,
    setPhoto,
    photoProgress,
    removePhoto,
  } = useSession();
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  /** پیامِ وضعیتِ کارتِ پروفایل (موفق/ناموفق) — جدا از پیامِ خطای بالای صفحه. */
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  /** عکسِ در حالِ ویرایش (چرخش/قاب مربع)؛ `null` یعنی ویرایشگر بسته است. */
  const [editing, setEditing] = useState<PickedPhoto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** شیتِ اسکنِ QR تأییدِ حضور و پیامِ نتیجهٔ همین شیت. */
  const [scanOpen, setScanOpen] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /**
   * آیا این اسکن برای ثبت است (از دکمهٔ پایین) یا فقط تأییدِ حضور (از کارت)؟
   *
   * فرقشان مهم است: اگر کارمند روی «خروج» زده و بعد اسکن کرده، بعد از تأیید
   * مستقیماً اثرِ انگشت را هم می‌پرسیم تا در همان ۳۰ ثانیه ثبت تمام شود؛ ولی
   * اگر از کارتِ تأیید اسکن کرده، ثبتی نمی‌سازیم — او فقط تأیید خواسته است.
   *
   * ref است و نه state: این تصمیم باید حتی بعد از بستنِ شیت (و باز شدنِ دوبارهٔ
   * آن پس از پایانِ مهلت) پایدار بماند و خواندنش در callbackِ اسکن هم نباید به
   * رندرِ قبل گیر کند.
   */
  const punchFlowRef = useRef(false);
  /**
   * آینهٔ آخرین خطا برای استفادهٔ داخلِ callback.
   *
   * چرا ref و نه خودِ `error`: در بدنهٔ onCode ورودی از رندر قبل بسته شده
   * است، پس همان مقدارِ کهنه برمی‌گردد. این آینه دقیقاً همان چیزی را می‌دهد
   * که `confirmPresence` همین لحظه ست کرده است.
   */
  const errorRef = useRef<string | null>(null);
  errorRef.current = error;
  const [ready, setReady] = useState(false);
  const insets = useSafeAreaInsets();

  /**
   * پیش‌بارگذاریِ صفحه: یک مکثِ کوتاهِ برندشده تا محتوا با محو شدن ظاهر
   * شود، نه اینکه اجزا یکهو جهش کنند. خودِ داده آماده است (پیش از ورود
   * گرفته شده)؛ این فقط لحظهٔ «بارگذاری» است که کاربر هنگام باز شدن صفحه
   * می‌بیند، و رنگش عمداً همان سبزِ سرصفحه است تا به هدرِ سبزِ صفحهٔ اصلی
   * بربخورد.
   */
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  if (showHistory) {
    return <HistoryScreen onBack={() => setShowHistory(false)} />;
  }

  if (!ready) {
    return (
      <Screen topColor={colors.brandDeep}>
        <StatusBar style="light" />
        <BrandBoot text="در حال آماده‌سازی…" />
      </Screen>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  /**
   * انتخابِ عکس از گالری یا دوربین و فرستادنش.
   *
   * دلیلِ اینکه منوی انتخاب اینجاست و نه داخلِ کامپوننتِ کارت: همان‌جا است
   * که به وضعیتِ نشست (`setPhoto`) دسترسی داریم و پیامِ نتیجه هم روی همین
   * کارت می‌نشیند — نه پشتِ آن.
   *
   * بستنِ پیکر با «لغو» خطا نیست: هیچ پیامی نمی‌دهیم. اجازهٔ داده‌نشده و
   * شکست هم پیامِ روشن می‌گیرند تا کاربر بداند ماجرا در گوشی است یا سرور.
   */
  /**
   * باز کردنِ کارتِ پروفایل با وضعیتِ تمیز.
   *
   * چرا خطای بالای صفحه هم پاک می‌شود: کارتِ عکس پیش‌تر به آن خطا برمی‌گشت
   * (`photoNote ?? error`) و اگر آخرین خطا مربوط به ثبتِ حضور بود، زیرِ عکس
   * پیامِ «اینترنت/شبکهٔ محل کار» می‌نشست — پیامی که هیچ ربطی به عکس نداشت و
   * کاربر را دنبالِ مشکلِ اشتباهی می‌فرستاد. حالا هر کارت فقط حرفِ خودش را
   * می‌زند؛ خطای صفحه جای خودش (بنرِ بالای بدنه) می‌ماند.
   */
  const openProfile = () => {
    setPhotoNote(null);
    clearError();
    setProfileOpen(true);
  };

  const pickPhoto = async (source: PhotoSource) => {
    setPhotoNote(null);

    const outcome = await pickProfilePhoto(source);

    if (outcome.status === 'cancelled') {
      return;
    }

    if (outcome.status === 'denied') {
      setPhotoNote(
        source === 'camera'
          ? 'اجازهٔ دوربین داده نشد. از تنظیماتِ گوشی می‌توانید روشنش کنید.'
          : 'اجازهٔ دسترسی به عکس‌ها داده نشد. از تنظیماتِ گوشی می‌توانید روشنش کنید.',
      );
      return;
    }

    if (outcome.status === 'failed') {
      setPhotoNote('انتخاب عکس انجام نشد؛ یک بار دیگر تلاش کنید.');
      return;
    }

    /*
     * اینجا آپلودی انجام نمی‌شود — عکس اول به ویرایشگر می‌رود تا کارمند
     * زاویه و قابش را تنظیم کند، و فرستادن بعد از «استفاده از عکس» همان
     * مسیرِ قبلیِ `setPhoto` را می‌رود.
     *
     * استثناء: اگر گالری‌ای اندازهٔ تصویر نداد (کمیاب، ولی شده)، ویرایشگر
     * بدون آن عدد نمی‌تواند هندسهٔ برش را حساب کند — پس همان رفتارِ قدیمیِ
     * نسخهٔ وب: عکس همان‌طور که هست می‌رود و سرور و پنل خودشان با آن
     * کار می‌کنند.
     */
    if (!outcome.photo.width || !outcome.photo.height) {
      setPhotoNote((await setPhoto(outcome.photo)) ? 'عکس پروفایل ذخیره شد.' : null);
      return;
    }

    setEditing(outcome.photo);
  };

  /**
   * پایانِ ویرایش: عکسِ چرخیده و بریده‌شده همان مسیرِ آپلودِ قبلی را می‌رود؛
   * سرور هیچ تفاوتی در درخواست نمی‌بیند (نام و نوع از خودِ نتیجه ساخته
   * می‌شود) و پیامِ «ذخیره شد» هم روی همان کارتِ پروفایل می‌نشیند.
   */
  const finishEditing = async (photo: PickedPhoto) => {
    setEditing(null);
    setPhotoNote((await setPhoto(photo)) ? 'عکس پروفایل ذخیره شد.' : null);
  };

  const dropPhoto = async () => {
    setPhotoNote((await removePhoto()) ? 'عکس حذف شد؛ عکس پیش‌فرض برگشت.' : null);
  };

  /**
   * تایمرِ زنده.
   *
   * هر ثانیه از نو حساب می‌شود، ولی مبنا ساعتِ سرور است نه ساعت گوشی: `now`
   * همان ساعتِ لنگرشدهٔ سرور است. اگر شیفت باز باشد، عدد خودش جلو می‌رود.
   */
  const workedToday = workedSeconds(today.punches, { now: liveClock || null });
  const running = today.present;

  /**
   * قفلِ دکمهٔ ثبت تا تأییدِ همین ثبت.
   *
   * قاعده در سرور اجرا می‌شود (`presence_required`)؛ اینجا فقط نشان داده
   * می‌شود. ضربهٔ دکمه در این حالت بی‌جواب نمی‌ماند: همان اسکنر باز می‌شود —
   * تنها کاری که کاربر باید بکند همین است.
   */
  const punchLocked = presenceLocksPunch(presence);

  /*
   * تأییدِ حضور ۳۰ ثانیه بیشتر اعتبار ندارد. سرور در پایانِ مهلت آن را
   * «مصرف‌نشدهٔ منقضی» می‌بیند و ثبت را قفل می‌کند؛ اپ همین را کمی زودتر
   * نشان می‌دهد: نشانِ «تأیید شده» می‌رود، ثانیه‌ها شمرده می‌شوند و دکمهٔ
   * اسکن دوباره برمی‌گردد.
   */
  const presenceOver = presenceExpired(presence);
  const presenceLeft = presenceSecondsLeft(presence);
  const canScan = needsQrScan(presence) || presenceOver;

  /**
   * باز کردنِ اسکنر.
   *
   * همان لحظه به پنل خبر می‌دهیم که «کارتِ من را بزرگ نشان بده»: کارمند
   * پشتِ گوشی است و صفحهٔ دفتر شاید ده کارت داشته باشد؛ بدونِ این، باید
   * کارتِ خودش را بین آن‌ها پیدا کند و همان چند ثانیه هم صرفِ گشتن می‌شود —
   * در حالی که بعد از اسکن فقط ۳۰ ثانیه برای زدنِ اثرِ انگشت وقت دارد.
   * این خبر کاملاً اختیاری است — نرسیدنش مانعِ اسکن نیست.
   *
   * `forPunch`: اگر از دکمهٔ ثبت آمده‌ایم، بعد از اسکنِ موفق همان ثبت
   * خودکار ادامه می‌یابد؛ اسکنِ کارتِ تأیید این کار را نمی‌کند.
   */
  const openScan = (forPunch = false) => {
    setScanNote(null);
    punchFlowRef.current = forPunch;
    setScanOpen(true);
    spotlightPresence();
  };

  /**
   * بستنِ شیتِ اسکنر (دکمهٔ «بستن» یا اسکنِ موفق).
   *
   * به پنل هم خبر می‌دهیم کارت جمع شود؛ وگرنه کارتِ بزرگ‌شده تا پایانِ ۴۵
   * ثانیه روی صفحهٔ دفتر می‌ماند. این خبر هم مثلِ باز کردن «بهترین تلاش» است
   * و خطایی نشان نمی‌دهد.
   */
  const closeScan = () => {
    setScanOpen(false);
    spotlightPresence(true);
  };

  /**
   * «مهلتِ همین تأیید تمام شد» — یک رویدادِ لحظه‌ای، نه یک وضعیتِ مشتق از رندر.
   *
   * چرا تایمر و نه فقط `presenceExpired` در رندر: نشست خودش ۳۰۰ میلی‌ثانیه بعد
   * از پایانِ مهلت وضعیت را از سرور تازه می‌کند و آنجا `pending` صفر می‌شود؛
   * اگر فقط به رندرِ یک‌ثانیه‌ای تکیه کنیم، ممکن است تازه‌سازی زودتر برسد و
   * رویدادِ «منقضی شد» هیچ‌وقت دیده نشود. تایمر دقیقاً روی همان مهلت می‌نشیند.
   */
  const [presenceTimedOut, setPresenceTimedOut] = useState(false);

  useEffect(() => {
    if (presence.expiresAt == null) {
      setPresenceTimedOut(false);
      return;
    }

    const left = presence.expiresAt - Date.now();

    if (left <= 0) {
      setPresenceTimedOut(true);
      return;
    }

    // تأییدِ تازه = مهلتِ تازه؛ پرچمِ قبلی باید پاک شود.
    setPresenceTimedOut(false);

    const timer = setTimeout(() => setPresenceTimedOut(true), left + 50);
    return () => clearTimeout(timer);
  }, [presence.expiresAt]);

  /**
   * مهلتی که یک‌بار به‌خاطرش اسکنر را خودمان باز کردیم.
   *
   * چرا لازم است: بعد از پایانِ مهلت، پرچمِ بالا تا تازه‌سازیِ بعدی true
   * می‌ماند؛ بدونِ این نگهبان، هر رندر دوباره شیت را باز می‌کرد و کاربر
   * نمی‌توانست ببنددش.
   */
  const reaskedRef = useRef<number | null>(null);

  /**
   * ۳۰ ثانیه گذشت و ثبت انجام نشد → دوباره تأییدِ حضور بخواه.
   *
   * سناریوی اصلی: کارمند تأیید می‌کند تا خروج بزند، ولی بین اسکن و اثرِ انگشت
   * وقتش می‌گذرد (تلفن، همکار، پیدا کردنِ جای انگشت). سرور تأیید را دیگر
   * «آماده» نمی‌بیند و ثبت را با `presence_required` رد می‌کند؛ اپ همان لحظه
   * شیتِ اسکن را با جملهٔ روشن باز می‌کند تا کارمند بداند باید دوباره تأیید
   * کند — نه اینکه با دکمهٔ قفل‌شده رها شود.
   */
  useEffect(() => {
    if (!presenceTimedOut || presence.expiresAt == null) {
      return;
    }

    if (reaskedRef.current === presence.expiresAt) {
      return;
    }

    reaskedRef.current = presence.expiresAt;

    // اگر شیت همین حالا باز است، جملهٔ خطای اسکنش را با این پیام عوض نمی‌کنیم.
    if (scanOpen) {
      return;
    }

    setScanNote(presenceReaskNote(presence));
    setScanOpen(true);
    spotlightPresence();
    // `presence` و `spotlightPresence` عمداً در وابستگی‌ها نیستند؛ تنها
    // رویدادی که باید این افکند را اجرا کند «گذشتنِ همین مهلت» است.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceTimedOut, presence.expiresAt]);

  const timerCaption = running
    ? `شیفت از ساعت ${formatClock(today.openSince)} باز است`
    : workedToday === null
      ? 'هنوز ثبتی برای امروز انجام نشده'
      : 'جمع کارکرد امروز';

  // `flushTop`: سرصفحه از زیرِ نوار وضعیت شروع می‌شود تا لکهٔ نوریِ گوشهٔ بالا
  // پشتِ ساعت ادامه پیدا کند، نه اینکه با خطِ صاف بریده شود — همان قراردادِ
  // صفحهٔ ورود.
  return (
    <Screen topColor={colors.brandDeep} backgroundColor={colors.white} flushTop>
      <StatusBar style="light" />

      <HeroHeader
        onMenu={() => setMenuOpen(true)}
        // ساعت بدون ثانیه: ثانیه‌شمار روی این صفحه فقط چشم را می‌دواند و
        // چیزی به تصمیم کاربر اضافه نمی‌کند؛ به‌جایش دو لکهٔ نورِ سرصفحه آرام
        // حرکت می‌کنند تا صفحه زنده به نظر برسد.
        clock={formatClock(liveClock || null)}
        // تاریخ از خود سرور می‌آید (`dmy`)، پس ساعت اشتباه گوشی آن را خراب نمی‌کند.
        date={today.dmy ? formatDmyFull(today.dmy) : formatJalaliShort(new Date())}
        clockNote="مرجع زمان: سرور"
      />

      {/* «سابقهٔ روزها» و «خروج» از بدنهٔ صفحه به این منو منتقل شده‌اند: بالای
          صفحه باید همان چیزی باشد که هر روز لازم است، نه دکمه‌های کناری. */}
      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        // جای کارتِ منو از همان محاسبه‌ای می‌آید که جای دکمهٔ سه‌خط را می‌سازد:
        // حاشیهٔ نوار وضعیت + حاشیهٔ بالای سرصفحه + قدِ خودِ دکمه + کمی فاصله.
        // عددِ ثابتِ قبلی (۷۶) فقط برای یک گوشیِ مشخص درست بود.
        anchorTop={insets.top + spacing.md + HERO_ACTION_SIZE + spacing.sm}
        items={[
          {
            // عکسِ پروفایل از دو جا در دسترس است: همین سطر، و ضربه روی خودِ
            // عکس در بالای صفحه — چون کاربر دنبالِ «عکس» اول روی تصویر می‌زند.
            key: 'profile',
            label: 'پروفایل و عکس',
            icon: 'account-circle-outline',
            onPress: () => {
              setMenuOpen(false);
              openProfile();
            },
          },
          {
            key: 'history',
            label: 'سابقهٔ روزها',
            icon: 'calendar-month-outline',
            onPress: () => {
              setMenuOpen(false);
              setShowHistory(true);
            },
          },
          {
            key: 'signOut',
            label: 'خروج از حساب',
            icon: 'logout-variant',
            tone: 'danger',
            onPress: () => {
              setMenuOpen(false);
              void signOut();
            },
          },
        ]}
      />

      <ProfileSheet
        visible={profileOpen}
        name={employee?.name ?? ''}
        role={employee?.role ?? employee?.email ?? null}
        uris={avatarSources(employee?.avatar)}
        hasPhoto={Boolean(employee?.avatar)}
        busy={photoBusy}
        progress={photoProgress}
        note={photoNote}
        onPick={(source) => void pickPhoto(source)}
        onRemove={() => void dropPhoto()}
        onClose={() => setProfileOpen(false)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, presence.enabled ? styles.bodyWithPresence : null]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {error ? (
          <FadeInView>
            <Banner text={error} />
          </FadeInView>
        ) : null}

        {/* تأییدِ حضور — اوّلِ صفحه، بالای عکسِ پروفایل.

             چرا بالا: این کارت می‌گوید «حضورِ امروز در سامانه پذیرفته شده یا
             نه»؛ تا وقتی سبز نشود، تایمر و ساعت فقط عددی روی صفحه‌اند. کارِ
             روزانهٔ کارمند همین است، پس باید پیش از هر چیز و پیش از کارتِ
             کارکرد دیده شود. اگر سرور کلیدِ کدِ چرخان را نداشته باشد، کلِ این
             کارت دیده نمی‌شود و اپ مثل قبل کار می‌کند. */}
        {presence.enabled ? (
          <FadeInView delay={40}>
            <Card style={styles.presenceCard}>
              <View style={styles.presenceHead}>
                <Text style={styles.cardTitle}>تأیید حضور</Text>

                {/* نشانِ «تأیید شده» فقط وقتی معنی دارد که همان تأیید هنوز
                    برای ثبتِ بعدی خرج نشده باشد. بعد از هر ثبت (ورود یا خروج)،
                    تأیید مصرف می‌شود و ثبتِ بعدی دوباره اسکن می‌خواهد؛ آنجا نشان
                    خاموش می‌شود و جملهٔ زیرش می‌گوید چه کار کند. */}
                {presence.pending && !presenceOver ? (
                  <View style={styles.presenceBadge}>
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.brand} />
                    <Text style={styles.presenceBadgeLabel}>
                      {presenceLeft > 0
                        ? `تأیید شده · ${toPersianDigits(presenceLeft)} ثانیه`
                        : 'تأیید شده'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.presenceNote}>{presenceNote(presence)}</Text>

              {canScan ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="اسکن QR کارت من"
                  // بدونِ پارامتر: این دکمه فقط تأییدِ حضور می‌خواهد و نباید
                  // بعد از اسکن خودش ثبت بسازد.
                  onPress={() => openScan()}
                  style={({ pressed }) => [styles.presenceButton, pressed && styles.pressedSoft]}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={18} color={colors.white} />
                  <Text style={styles.presenceButtonLabel}>اسکن QR کارتِ من</Text>
                </Pressable>
              ) : null}
            </Card>
          </FadeInView>
        ) : null}

        <FadeInView delay={120}>
          <View style={styles.profile}>
            {/* ضربه روی خودِ عکس، کارتِ پروفایل را باز می‌کند: مسیرِ طبیعیِ
                کاربر برای «عکسِ من» همین تصویر است، نه منوی گوشه. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="پروفایل و عکس"
              onPress={openProfile}
              style={styles.avatarButton}
            >
              {/* اگر کارمند عکس پروفایل نداشته باشد، عکسِ پیش‌فرضِ خودِ سرور
                  (`images/users/PRP.jpg` — همان که پنل وب نشان می‌دهد) کشیده
                  می‌شود؛ دایرهٔ خالی یا حروفِ اوّل جای «چهره» را نمی‌گیرد.
                  اگر عکسِ خودش هم باز نشد، باز به عکسِ پیش‌فرض برمی‌گردد. */}
              <Avatar name={employee?.name ?? ''} size={96} uris={avatarSources(employee?.avatar)} />

              {/* نشانِ کوچکِ دوربین روی خودِ عکس: بی‌آن، کاربر نمی‌داند جای
                  عوض کردنش همین‌جاست. */}
              <View style={styles.avatarBadge}>
                <MaterialCommunityIcons name="camera-outline" size={15} color={colors.white} />
              </View>
            </Pressable>

            <Text style={styles.profileName}>{employee?.name ?? '—'}</Text>
            <Text style={styles.profileRole}>
              {employee?.role ?? employee?.email ?? ''}
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <Card style={styles.timerCard}>
            <View style={styles.timerHead}>
              <Text style={styles.cardTitle}>کارکرد امروز</Text>
              <StatusBox present={today.present} />
            </View>

            <TimerDisplay
              value={formatStopwatch(workedToday)}
              running={running}
              caption={timerCaption}
            />

            <View style={styles.statRow}>
              <StatBlock label="ساعت ورود" value={formatClock(today.entry)} />
              <View style={styles.divider} />
              <StatBlock label="ساعت خروج" value={formatClock(today.exit)} />
            </View>
          </Card>
        </FadeInView>
      </ScrollView>

      {/* شیتِ اسکنر فقط وقتی باز است سوار می‌شود.

          چرا: تا پیش از این همیشه در درخت بود و بنابراین `useCameraPermissions`
          همان لحظهٔ رسیدن به داشبورد، پس از ورود، با دوربینِ نیتیو حرف می‌زد.
          حالا اولین لحظهٔ بعد از ورود فقط همان چیزی را دارد که لازم دارد؛ دوربین
          و حسگر وقتی صدا زده می‌شوند که کارمند واقعاً بخواهد اسکن کند. سودِ
          جانبی: وضعیتِ «کدِ فرستاده‌شده» هم با هر باز شدن خودش صفر می‌شود. */}
      {scanOpen ? (
        <PresenceScanSheet
          visible
          busy={presenceBusy}
          employeeId={employee?.id ?? null}
          note={scanNote}
          onCode={async (code) => {
            const ok = await confirmPresence(code);

            if (ok) {
              // اگر اسکن برای ثبت بود، همان ثبت را ادامه بده: ادعای «۳۰ ثانیه
              // فرصت» وقتی معنی دارد که اثرِ انگشت بلافاصله پرسیده شود، نه
              // اینکه کارمند یادش برود دوباره دکمه را بزند و مهلت بسوزد.
              //
              // مهلتِ کوتاه پیش از پرسش، برای بسته شدنِ کاملِ شیتِ دوربین است؛
              // روی iOS باز کردنِ اثرِ انگشت روی مودالِ در حالِ بسته شدن شکست
              // می‌خورد.
              const resumePunch = punchFlowRef.current;

              setScanNote(null);
              closeScan();

              if (resumePunch) {
                setTimeout(() => void punch({ presenceJustConfirmed: true }), 350);
              }

              return true;
            }

            setScanNote(errorRef.current ?? 'تأیید نشد؛ دوباره تلاش کنید.');
            return false;
          }}
          onClose={closeScan}
        />
      ) : null}

      {/* ویرایشگرِ عکس: بعد از انتخاب از گالری/دوربین باز می‌شود (بیرون از
          کارتِ پروفایل، چون مودالِ تمام‌صفحهٔ خودش را می‌خواهد) و بعد از
          تأیید، نتیجه همان `setPhoto`ِ قبلی را می‌رود. */}
      <PhotoEditorSheet
        photo={editing}
        onCancel={() => setEditing(null)}
        onConfirm={(photo) => void finishEditing(photo)}
      />

      {/* ---------------- نوار ثابتِ پایین ----------------
           دکمهٔ ثبت بیرون از ناحیهٔ اسکرول است تا همیشه در دسترس باشد؛ کارِ
           اصلیِ اپ همین یک دکمه است و نباید برای زدنش اسکرول کرد. بک‌گراند
           دارد تا کارت‌ها از زیرش رد نشوند، و فاصلهٔ پایین از ناحیهٔ ایمنِ
           گوشی می‌آید تا روی گوشی‌های با نوار خانه پنهان نشود.

           فاصلهٔ پایین عمداً از یک حاشیهٔ معمولی بیشتر است (`xxl + md`): این
           دکمه با شست زده می‌شود و روی دستِ در حالِ گرفتنِ گوشی می‌افتد؛ کمی
           بالاتر نشستن هم زدنش را راحت‌تر می‌کند و هم از نوار خانهٔ پایین
           فاصله می‌گیرد. */}
      <FadeInView style={[styles.punchFooter, { paddingBottom: spacing.xxl + spacing.md + insets.bottom }]}>
        <PunchButton
          label={punchLocked ? 'تأیید حضور با QR' : PUNCH_LABEL[today.nextIntent]}
          tone={today.nextIntent}
          onPress={() => (punchLocked ? openScan(true) : void punch())}
          loading={busy}
        />

        {/* تذکر زیرِ دکمه: وقتی ثبت قفل است، جایش را "چرا" و "چه کنم" می‌گیرد؛
            متنِ اثر انگشت آنجا گمراه‌کننده بود (کاربر انگشت می‌زد و ثبتی نمی‌شد).
            این قفل یکسان برای ورود و خروج است: سرور برای هر دو تأییدِ تازه
            می‌خواهد، پس خروج هم اول اسکن QR، بعد اثرِ انگشت. */}
        <Text style={styles.hint}>
          {punchLocked
            ? PUNCH_LOCK_NOTE
            : 'برای ثبت، اثر انگشتِ ثبت‌شده روی همین گوشی باید تطبیق بخورد.'}
        </Text>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    /* زیر کادرِ بالا یک پلهِ کامل نفس: عکس، نام و هر چه زیرشان می‌آید از سرصفحه
       جدا می‌شوند و به آن نمی‌چسبند. عدد عمداً بیشتر از یک حاشیهٔ معمولی است
       (`xxl + lg`): سرصفحه گوشه‌های گردِ پایین و سایه دارد و اگر محتوا نزدیک
       بنشیند، عکس پروفایل روی همان سایه می‌افتد و کادر بالا «تنگ» دیده می‌شود.

       کلیدِ مهم: این فاصله **فقط** روی ناحیهٔ اسکرول اثر دارد. نوارِ ثابتِ
       پایین (دکمهٔ ثبت حضور/خروج) بیرون از `ScrollView` است، پس هر چقدر این
       عدد بالا برود، دکمه یک پیکسل هم پایین‌تر نمی‌رود.

       این عدد برای حالتی است که **عکسِ پروفایل** اوّلِ صفحه است؛ وقتی کادرِ
       تأییدِ حضور اوّلِ صفحه می‌نشیند، `bodyWithPresence` جایش را می‌گیرد. */
    paddingTop: spacing.xxl + spacing.lg,
    gap: spacing.lg,
  },
  /**
   * ناحیهٔ اسکرول وقتی کادرِ «تأیید حضور» اوّلِ صفحه است.
   *
   * چرا کمتر: این کادر خودش پس‌زمینهٔ سفید، خطِ دور و سایه دارد؛ پس آن نوارِ
   * چهل‌وهشت پیکسلی بالای سرش فقط «فضای خالیِ الکی» دیده می‌شد و کادر را
   * از سرصفحه دور می‌انداخت. یک حاشیهٔ معمولی برای جدا شدنش از سرصفحه کافی
   * است، چون مرزش با خودش کشیده شده است.
   */
  bodyWithPresence: {
    paddingTop: spacing.md,
  },
  timerCard: {
    gap: spacing.lg,
    // کادر و سایهٔ کارتِ تایمر عمداً حذف شده — زمینهٔ سفیدِ صفحه خودش
    // کافی است و دو خطِ دورِ هم (این کارت + کادر وضعیت) چشم را خسته می‌کند.
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profile: {
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  avatarButton: {
    borderRadius: 48,
  },
  presenceCard: {
    gap: spacing.sm,
  },
  presenceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  presenceBadgeLabel: {
    color: colors.brand,
    fontSize: 12,
  },
  presenceNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  presenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  presenceButtonLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  /** فشردنِ نرمِ دکمهٔ تأیید — همان حسِ بقیهٔ دکمه‌های این صفحه. */
  pressedSoft: {
    opacity: 0.88,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
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
  timerHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    writingDirection: 'rtl',
  },
  statRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.line,
  },
  scroll: {
    flex: 1,
  },
  punchFooter: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // زمینهٔ نوار پایین با صفحهٔ سفید یکی است؛ فقط یک خطِ نازکِ جداکننده.
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  hint: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
