import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../components/motion';
import {
  Banner,
  BrandMark,
  Card,
  Field,
  HeroGlows,
  InfoRow,
  PrimaryButton,
  Screen,
  useHeroGlow,
} from '../components/ui';
import { API_BASE_URL } from '../lib/config';
import { CONNECTION_RETRY_MS, connectionNote } from '../lib/connection';
import { useSession } from '../session';
import { colors, radius, shadow, spacing } from '../theme';

/**
 * صفحهٔ ورود.
 *
 * ساختارش عمداً همان ساختار صفحهٔ اصلی است: یک سرصفحهٔ سبزِ تیره با گوشه‌های
 * گردِ پایین (نشان، نام اپ، و همان دو لکهٔ نوری)، بعد کارت‌های سفید روی زمینهٔ
 * روشن. قبلاً این صفحه پس‌زمینهٔ روشنِ یکدست داشت و بالایش لوگوی شناور بود؛
 * نتیجه این بود که اپ دو چهره پیدا می‌کرد و ورود شبیه یک فرم وب می‌شد، نه
 * ورودیِ همان اپی که کاربر بعدش می‌بیند.
 *
 * نکته‌های امنیتی هم از چند پاراگرافِ خاکستری به کارتِ «امنیت و شرایط ثبت»
 * با سطرهای کوتاه تبدیل شدند: اینها «شرط»اند نه «انشا»، و کسی که می‌خواهد
 * بداند چرا ثبتش رد شده دنبال یک جمله در میان متن نمی‌گردد.
 */
export default function LoginScreen() {
  // همان واکنشِ صفحهٔ اصلی به کشیدنِ انگشت: لکه‌های این سرصفحه هم هل می‌خورند.
  const glows = useHeroGlow();
  const { signIn, busy, error, clearError, connection, checkConnection } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /**
   * کاربر «ورود» را خواسته ولی شبکه نگذاشته.
   *
   * بدون این پرچم، کاربر بعد از وصل شدنِ اینترنت باید خودش دوباره دکمه را
   * بزند — همان چیزی که در صفحهٔ ورودِ وب هم حل کرده‌ایم.
   */
  const [pending, setPending] = useState(false);

  const offline = connection === 'offline';
  const checking = connection === 'checking';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy && !offline;

  const retryConnection = useCallback(() => {
    void checkConnection();
  }, [checkConnection]);

  /** ورودِ اولِ صفحه: تا جوابِ سرور کارتِ قرمز نمی‌آید، فقط یک سطر وضعیت. */
  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  /** تا وقتی قطع است، خودمان هر چند ثانیه تست می‌کنیم. */
  useEffect(() => {
    if (!offline) return;

    const timer = setInterval(retryConnection, CONNECTION_RETRY_MS);
    return () => clearInterval(timer);
  }, [offline, retryConnection]);

  /**
   * ورودی که شبکه نگذاشت فرستاده شود، «معطل» می‌ماند.
   *
   * دربارهٔ `offline`ِ همراهِ خطا: یک درخواست فقط وقتی «قطع» شمرده می‌شود که
   * هیچ پاسخی نیامده باشد (`reachableFromError`)؛ پس اگر رمز اشتباه باشد
   * مودالِ قطعی باز نمی‌شود و همین پرچم هم روشن نمی‌شود.
   */
  useEffect(() => {
    if (!error || !offline) return;

    setPending(true);
  }, [error, offline]);

  /** اتصال برگشت و ورودی معطل بود: همان ورود خودش ادامه پیدا می‌کند. */
  useEffect(() => {
    if (!pending || offline || busy) return;
    if (!email.trim() || !password) return;

    setPending(false);
    void signIn(email, password);
  }, [pending, offline, busy, signIn, email, password]);

  const submit = () => {
    if (!canSubmit) return;

    clearError();

    // وقتی مودالِ «اتصال برقرار نیست» باز است فرم پشتش قفل است و این مسیر
    // عملاً وقتی می‌رسد که کاربر قبل از تشخیصِ قطعی دکمه را زده باشد؛ همان
    // درخواست معطل می‌ماند و به‌محضِ برگشتنِ اتصال فرستاده می‌شود.
    if (offline) {
      setPending(true);
      retryConnection();
      return;
    }

    void signIn(email, password);
  };

  return (
    <Screen topColor={colors.brandDeep}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* سرصفحه بیرون از ناحیهٔ اسکرول است تا هنگام باز شدن کیبورد جابه‌جا
            نشود؛ همان کاری که صفحهٔ اصلی با سرصفحه‌اش می‌کند. */}
        <View ref={glows.ref} style={styles.hero} {...glows.handlers}>
          <HeroGlows push={glows.pushed} />

          <BrandMark size={44} />
          <Text style={styles.heroName}>مِرآت</Text>
          <Text style={styles.heroHint}>سامانهٔ حضور و غیاب کارکنان</Text>

          <View style={styles.heroTag}>
            <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.onDark} />
            <Text style={styles.heroTagText}>اتصال امن</Text>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInView>
            <Card style={styles.formCard}>
              {error ? <Banner text={error} /> : null}

              {checking ? <Banner tone="info" text={connectionNote('checking')} /> : null}

              <Text style={styles.cardTitle}>ورود به حساب</Text>

              <Field
                label="پست الکترونیک"
                icon="account-outline"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="name@example.com"
                returnKeyType="next"
              />

              <Field
                label="رمزعبور"
                icon="lock-outline"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                placeholder="••••••••"
                returnKeyType="go"
                onSubmitEditing={submit}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'پنهان کردن رمزعبور' : 'نمایش رمزعبور'}
                    onPress={() => setShowPassword((value) => !value)}
                    hitSlop={10}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={colors.muted}
                    />
                  </Pressable>
                }
              />

              <PrimaryButton label="ورود" onPress={submit} loading={busy} disabled={!canSubmit} />
            </Card>
          </FadeInView>

          <FadeInView delay={90}>
            <Card style={styles.infoCard}>
              <Text style={styles.cardTitle}>امنیت و شرایط ثبت</Text>

              <InfoRow icon="shield-lock-outline" label="نشست" value="حافظهٔ امن گوشی" />
              <InfoRow icon="fingerprint" label="برای هر ثبت" value="اثر انگشت همین گوشی" />
              <InfoRow icon="wifi-check" label="شرط ثبت" value="اینترنت محل کار" />
              <InfoRow icon="cellphone-lock" label="تغییر گوشی" value="با مدیر سامانه" />

              <Text style={styles.note}>
                اگر پیام «فقط از اینترنت محل کار» دیدید، وای‌فای ساختمان را وصل کنید.
              </Text>
            </Card>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------------- اتصال به سرور ----------------
           عمداً **مودالِ تمام‌صفحه** است، نه یک بلاکِ داخلِ کارت: قطع بودنِ
           اینترنت وضعیتِ کلِ صفحه است، نه یک نکتهٔ فرم. تا اتصال برنگردد هیچ
           چیزِ پشتِ آن قابل لمس نیست، پس کاربر بی‌دلیل دنبال دکمه‌ای نمی‌گردد
           که کار نمی‌کند؛ ورودی‌هایش هم سرِ جایشان محفوظ می‌مانند و هر چند
           ثانیه خودمان دوباره تلاش می‌کنیم. */}
      <Modal
        visible={offline}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
        aria-modal
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="wifi-off" size={30} color={colors.danger} />
            </View>

            <Text style={styles.modalTitle}>اتصال به سرور برقرار نیست</Text>
            <Text style={styles.modalNote}>{connectionNote('offline')}</Text>
            <Text style={styles.modalServer}>آدرس سرور: {API_BASE_URL}</Text>

            {pending ? (
              <Text style={styles.modalPending}>
                درخواستِ ورودِ شما محفوظ است؛ به‌محضِ برگشتنِ اتصال خودکار فرستاده می‌شود.
              </Text>
            ) : null}

            <View style={styles.modalAction}>
              <PrimaryButton label="تلاش دوباره" onPress={retryConnection} loading={checking} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    // ارتفاعش حدود ۳۰٪ کمتر از قبل است (همان تغییری که سرصفحهٔ صفحهٔ اصلی
    // گرفت): فاصله‌های خالی جمع شده‌اند تا فرمِ ورود زودتر به چشم بیاید و
    // کاربر مجبور نباشد برای دیدن دکمهٔ ورود اسکرول کند.
    backgroundColor: colors.brandDeep,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.header,
  },
  heroName: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroHint: {
    color: colors.onDark,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  heroTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.veil,
  },
  heroTagText: {
    color: colors.onDark,
    fontSize: 11.5,
    writingDirection: 'rtl',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  formCard: {
    gap: spacing.md,
  },
  infoCard: {
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    writingDirection: 'rtl',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 22, 14, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.raised,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  modalNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  modalServer: {
    color: colors.muted,
    fontSize: 11.5,
    textAlign: 'center',
  },
  modalPending: {
    color: colors.brand,
    fontSize: 12.5,
    lineHeight: 21,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  modalAction: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  note: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'right',
    writingDirection: 'rtl',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
});
