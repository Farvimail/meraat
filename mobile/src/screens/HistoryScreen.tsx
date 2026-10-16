import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '../components/motion';
import { AppHeader, Banner, BrandBoot, Card, Screen } from '../components/ui';
import { formatClock, formatDmyFull, formatDuration } from '../lib/jalali';
import { messageForError } from '../lib/messages';
import { closingSpanMinutes } from '../lib/punch';
import type { HistoryDay, PunchRow } from '../lib/types';
import { useSession } from '../session';
import { colors, spacing } from '../theme';

/**
 * سابقهٔ روزها.
 *
 * هر روز یک کارت است و با ضربه باز می‌شود تا **همهٔ** تیک‌های آن روز را نشان
 * دهد. چرا: خلاصهٔ «اولین ورود / آخرین خروج» برای کسی که وسط روز بیرون رفته و
 * برگشته گمراه‌کننده است؛ کارمند باید ببیند کدام ورود به کدام خروج وصل شده و
 * آن شیفت چقدر طول کشیده.
 *
 * این صفحه عمداً **همان زبانِ بصریِ صفحهٔ اصلی** را دارد — سرصفحهٔ سبز با
 * هویتِ اپ، زمینهٔ سفید، کارت‌های بی‌سایه با خطِ نازک، و همان پیش‌بارگذاریِ
 * برندشده. یک صفحهٔ داخلی که قالبش با صفحهٔ خانه فرق کند، اپ را دو تکه نشان
 * می‌دهد و کاربر فکر می‌کند جای دیگری است.
 */
export default function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { api } = useSession();
  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await api.history(1);
        if (!cancelled) setDays(result.days);
      } catch (failure) {
        if (!cancelled) setError(messageForError(failure));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  /** جمع همین صفحه. صفر یعنی هنوز چیزی برای جمع‌زدن نیست. */
  const totalMinutes = useMemo(
    () => (days ?? []).reduce((sum, day) => sum + (day.minutes ?? 0), 0),
    [days],
  );

  return (
    <Screen topColor={colors.brandDeep} backgroundColor={colors.white}>
      <StatusBar style="light" />

      <AppHeader
        title="سابقهٔ حضور"
        subtitle={days ? `جمع این صفحه: ${formatDuration(totalMinutes)}` : undefined}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {error ? (
          <FadeInView>
            <Banner text={error} />
          </FadeInView>
        ) : null}

        {/* دکمهٔ بازگشت بالای صفحه (داخل سرصفحه) همیشه در دسترس است؛ پس
            بارگذاریِ بدنه می‌تواند همان نشانِ برندشده باشد بدون اینکه کاربر
            راهِ برگشتی نداشته باشد. */}
        {days === null && !error ? <BrandBoot tone="light" text="در حال خواندن سابقه…" /> : null}

        {days !== null && days.length === 0 ? (
          <Text style={styles.empty}>هنوز روزی ثبت نشده است.</Text>
        ) : null}

        {(days ?? []).map((day, index) => {
          const open = openDay === day.dmy;
          const events = day.punches ?? [];

          return (
            // ورودِ پله‌ای؛ سقفش می‌گیرد تا فهرست بلند یک‌باره پرش نکنه.
            <FadeInView key={day.dmy} delay={Math.min(index, 6) * 55}>
              <Card flat style={styles.rowCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDmyFull(day.dmy)} — نمایش جزئیات ثبت‌ها`}
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenDay(open ? null : day.dmy)}
                  style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowHeader}>
                    <Text style={styles.day}>{formatDmyFull(day.dmy)}</Text>
                    <Text style={styles.minutes}>{formatDuration(day.minutes)}</Text>
                  </View>

                  {/* همان ستون‌های «ساعت ورود / ساعت خروج» صفحهٔ اصلی: عددِ
                      ورود/خروج همان چیزی است که کاربر برایش این صفحه را باز
                      می‌کند، پس از جنسِ همان اعدادِ صفحهٔ خانه است. */}
                  <View style={styles.rowTimes}>
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeLabel}>ساعت ورود</Text>
                      <Text style={styles.timeValue} allowFontScaling={false}>
                        {formatClock(day.entry)}
                      </Text>
                    </View>

                    <View style={styles.timeDivider} />

                    <View style={styles.timeBlock}>
                      <Text style={styles.timeLabel}>ساعت خروج</Text>
                      <Text style={styles.timeValue} allowFontScaling={false}>
                        {formatClock(day.exit)}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.muted}
                    />
                  </View>
                </Pressable>

                {open ? (
                  <View style={styles.events}>
                    {events.length === 0 ? (
                      <Text style={styles.emptyRow}>برای این روز جزئیاتی ثبت نشده است.</Text>
                    ) : (
                      events.map((event, eventIndex) => (
                        <EventRow
                          key={`${day.dmy}-${event.time}-${eventIndex}`}
                          event={event}
                          events={events}
                          index={eventIndex}
                        />
                      ))
                    )}
                  </View>
                ) : null}
              </Card>
            </FadeInView>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/** یک تیکِ روز: ورود یا خروج، با فاصله‌اش از تیکِ قبلی برای خروج‌ها. */
function EventRow({
  event,
  events,
  index,
}: {
  event: PunchRow;
  events: PunchRow[];
  index: number;
}) {
  const isStart = event.start === 1;
  const color = isStart ? colors.brand : colors.slate;

  // طول شئفتی که این خروج می‌بندد؛ ورود و خروجِ بی‌جفت چیزی نشان نمی‌دهد.
  const span = closingSpanMinutes(events, index);

  return (
    <View style={[styles.eventRow, !isStart && styles.eventRowExit]}>
      <MaterialCommunityIcons name={isStart ? 'login' : 'logout'} size={17} color={color} />

      <Text style={[styles.eventLabel, { color }]}>{isStart ? 'ورود' : 'خروج'}</Text>

      <Text style={styles.eventTime} allowFontScaling={false}>
        {formatClock(event.time)}
      </Text>

      <Text style={styles.eventSpan}>{span === null ? '' : formatDuration(span)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    // زمینهٔ سفیدِ صفحه + کارت‌های بی‌سایه: فهرست روزها با خط‌های نازک از هم
    // جدا می‌شود، نه با سایه‌های روی‌هم‌افتاده.
    flexGrow: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowCard: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  rowPress: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.slateSoft,
  },
  rowHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  day: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    writingDirection: 'rtl',
  },
  minutes: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
    writingDirection: 'rtl',
  },
  rowTimes: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeBlock: {
    alignItems: 'center',
    gap: 2,
  },
  timeLabel: {
    fontSize: 11.5,
    color: colors.muted,
    writingDirection: 'rtl',
  },
  timeValue: {
    // در فهرست کمی کوچک‌تر از عددِ صفحهٔ اصلی (۲۶) است تا هر کارت یک‌خطی
    // بماند، ولی همان بزرگ‌شدنِ ۲۰→۲۲ را دارد.
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  timeDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  events: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eventRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  /**
   * جداکنندهٔ نازک — فقط زیر سطرِ «خروج».
   *
   * قبلاً زیر هر تیک یک خط بود و روزی با سه ورود و سه خروج شش خط می‌شد؛ چشم
   * به‌جای «ورود یا خروج» خط‌ها را می‌شمرد. فقط سطرِ خروج خط می‌گیرد چون آن
   * یکی بستن یک بازهٔ زمانی را نشان می‌دهد و بقیهٔ سطرها ادامهٔ همان بازه‌اند.
   */
  eventRowExit: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  eventLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  eventTime: {
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  eventSpan: {
    flex: 1,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  emptyRow: {
    fontSize: 12.5,
    color: colors.muted,
    writingDirection: 'rtl',
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xl,
    writingDirection: 'rtl',
  },
});
