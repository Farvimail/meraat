import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { recordCrash, toCrashRecord } from '../lib/crash-log';
import { colors, radius, spacing } from '../theme';

/**
 * گرفتارِ خطا — چرا این کامپوننت هست.
 *
 * در buildِ release، یک خطای رندر یعنی **بسته‌شدنِ اپ**؛ کاربر فقط می‌بیند
 * اسپلش آمد و بعد اپ رفت. React این خطا را به `componentDidCatch` می‌دهد و
 * اگر کسی گوش ندهد، درخت را پایین می‌کشد.
 *
 * اینجا گوش می‌دهیم: پیام و مسیرِ خطا ذخیره می‌شود (تا در صفحهٔ ورود دیده
 * شود) و به‌جای صفحهٔ سیاه، یک صفحهٔ روشن با جملهٔ فارسی و دکمهٔ «تلاش
 * دوباره» می‌آید. اگر دکمه جواب نداد، کاربر می‌تواند اپ را ببندد و باز کند —
 * همان بلایی که قبلاً تنها راهِ ممکن بود، ولی این بار با یک سرنخ.
 *
 * عمداً هیچ چیزی از `components/ui` اینجا وارد نمی‌شود: خودِ آن‌ها ممکن است
 * مسببِ خطا باشند و این صفحه باید در هر شرایطی رندر شود.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    void recordCrash(
      toCrashRecord('render', info.componentStack ? `${String(error)}\n${info.componentStack}` : error),
    );
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.screen}>
        <StatusBar style="light" />

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>این صفحه بالا نیامد</Text>

          <Text style={styles.note}>
            برنامه بسته نشد؛ یک بخش از آن به مشکل خورد. دکمهٔ زیر را بزنید. اگر باز هم همین پیام آمد،
            برنامه را ببندید و دوباره باز کنید و موضوع را به مدیر سامانه اطلاع دهید.
          </Text>

          <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
            <Text style={styles.buttonLabel}>تلاش دوباره</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brandDeep,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  title: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  note: {
    color: colors.onDark,
    fontSize: 13,
    lineHeight: 23,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  button: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
