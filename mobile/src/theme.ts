/**
 * پالتِ اپ، هم‌خانواده با پنل meraat.
 *
 * توجه: رنگ‌ها عمداً سخت‌کد شده‌اند و از پنل وب خوانده نمی‌شوند؛ اپ باید
 * بدون اینترنت هم کامل رندر شود.
 *
 * زبانِ بصری: سبزِ تیره برای «سرصفحه و کارهای اصلی»، خاکستریِ سردِ روشن برای
 * پس‌زمینه، و سایه‌های نرم به‌جای خط‌های ضخیم. سرصفحه عمداً تیره‌تر از پنل وب
 * است تا اپ در نگاه اول «یک ابزار رسمی» به نظر برسد، نه یک فرم وب.
 */

export const colors = {
  /** سبز سرصفحه و دکمه‌ها. */
  brand: '#0F6B3F',
  brandDark: '#0A4F2E',
  /** ته‌رنگِ سرصفحه؛ برنگرداندن به پنل وب عمدی است. */
  brandDeep: '#08301E',
  /** پس‌زمینهٔ ملایم سبز برای نشان‌ها. */
  brandSoft: '#E6F2EB',
  accent: '#1E9E5A',

  bg: '#F1F4F3',
  card: '#FFFFFF',
  line: '#E3E9E5',
  /** خط جداکنندهٔ روی زمینهٔ تیره. */
  lineOnDark: 'rgba(255, 255, 255, 0.14)',
  veil: 'rgba(255, 255, 255, 0.07)',

  ink: '#10231A',
  muted: '#6B7C73',
  /** متن کم‌رنگ روی سرصفحهٔ تیره. */
  onDark: 'rgba(255, 255, 255, 0.72)',

  danger: '#B4342A',
  dangerSoft: '#FBEAE8',
  warning: '#8A6116',
  warningSoft: '#FDF3E2',
  /** رنگ دکمهٔ «ثبت خروج»: عمداً سبز نیست تا با ورود اشتباه گرفته نشود. */
  slate: '#22303A',
  slateSoft: '#EDF1F4',

  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * سایه‌ها. در اندروید `elevation` و در iOS/وب `shadow*` اثر می‌کند؛ هر دو را
 * می‌دهیم تا یک شکل دیده شود.
 */
export const shadow = {
  card: {
    shadowColor: '#0A2A1B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0A2A1B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
  header: {
    shadowColor: '#062015',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;

/** مدت انیمیشن‌ها (میلی‌ثانیه) تا حرکتِ کل اپ یک‌دست بماند. */
export const motion = {
  fast: 160,
  base: 300,
  slow: 460,
  /** یک تپشِ کامل حلقهٔ دکمهٔ ثبت. */
  pulse: 1700,
} as const;
