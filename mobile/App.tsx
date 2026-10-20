import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/error-boundary';
import { FadeInView } from './src/components/motion';
import { BrandMark } from './src/components/ui';
import { installCrashHandler } from './src/lib/crash-log';
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import { SessionProvider, useSession } from './src/session';
import { colors, spacing } from './src/theme';

/**
 * خطاهای رهاشده را از همان اولِ اجرا ثبت می‌کنیم، نه بعد از ورود: خطا می‌تواند
 * در همان لحظهٔ راه‌اندازی هم رخ دهد و بعد هیچ‌کس صدایش را نمی‌شنید.
 */
installCrashHandler();

/**
 * ناوبری عمداً ساده است: سه صفحه و یک جریان خطی. برای همین به
 * `expo-router` یا `react-navigation` نیازی نبود و اپ با کمترین وابستگی
 * ساخته می‌شود — روی شبکه‌ای که دسترسی به رجیستری npm در آن همیشه روان نیست،
 * هر وابستگی کمتر یعنی نصب و به‌روزرسانی مطمئن‌تر.
 *
 * رنگ نوار وضعیت اینجا تنظیم نمی‌شود: هر صفحه خودش آن را می‌گوید، چون صفحهٔ
 * اصلی سرصفحهٔ تیره دارد و صفحهٔ ورود زمینهٔ روشن. اگر یک‌جا تعیین می‌شد،
 * نوشتهٔ سپید نوار وضعیت روی پس‌زمینهٔ روشن گم می‌شد.
 */
function Root() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />

        <FadeInView style={styles.splashInner}>
          <BrandMark size={76} />
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.splashText}>در حال آماده‌سازی…</Text>
        </FadeInView>
      </View>
    );
  }

  return status === 'signedIn' ? <DashboardScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* گرفتارِ خطا بیرون از نشست است: اگر خودِ نشست یا صفحه‌ای که می‌سازد
          بترکد، نباید کلِ اپ بسته شود. */}
      <ErrorBoundary>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashInner: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  splashText: {
    color: colors.onDark,
    fontSize: 13,
    writingDirection: 'rtl',
  },
});
