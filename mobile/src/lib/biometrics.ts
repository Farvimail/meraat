import * as LocalAuthentication from 'expo-local-authentication';
import type { LocalAuthenticationError } from 'expo-local-authentication';

/**
 * تأیید هویت با اثر انگشت گوشی.
 *
 * **آنچه این ماژول اثبات می‌کند و آنچه اثبات نمی‌کند:** سیستم‌عامل فقط
 * می‌گوید «یکی از انگشت‌های ثبت‌شدهٔ همین گوشی تطبیق خورد». نمی‌گوید کدام
 * انگشت بود و الگو را هم بیرون نمی‌دهد. پس این یک قیدِ «همین دستگاه» است، نه
 * شناسایی کارمند. کارمندی که گوشی به نامش ثبت شده، خودش مسئول گوشی است.
 */

export type BiometricFailureReason =
  | 'unavailable'
  | 'not_enrolled'
  | 'cancelled'
  | 'failed'
  | 'lockout';

export type BiometricOutcome =
  | { ok: true; at: number; kind: string }
  | { ok: false; reason: BiometricFailureReason };

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  /** `fingerprint` | `face` | `iris` | null */
  kind: string | null;
}

const KIND_BY_TYPE: Record<number, string> = {
  [LocalAuthentication.AuthenticationType.FINGERPRINT]: 'fingerprint',
  [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]: 'face',
  [LocalAuthentication.AuthenticationType.IRIS]: 'iris',
};

const REASON_BY_ERROR: Record<LocalAuthenticationError, BiometricFailureReason> = {
  not_enrolled: 'not_enrolled',
  user_cancel: 'cancelled',
  system_cancel: 'cancelled',
  app_cancel: 'cancelled',
  user_fallback: 'cancelled',
  lockout: 'lockout',
  not_available: 'unavailable',
  passcode_not_set: 'unavailable',
  invalid_context: 'failed',
  no_space: 'failed',
  timeout: 'failed',
  unable_to_process: 'failed',
  unknown: 'failed',
  authentication_failed: 'failed',
};

export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = available ? await LocalAuthentication.isEnrolledAsync() : false;
    const types = available ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
    const kinds = types.map((type) => KIND_BY_TYPE[type]).filter((kind): kind is string => Boolean(kind));

    // اثر انگشت مقدم است؛ اگر بود، همان را نشان بده.
    const kind = kinds.find((value) => value === 'fingerprint') ?? kinds[0] ?? null;

    return { available, enrolled, kind };
  } catch {
    return { available: false, enrolled: false, kind: null };
  }
}

export async function verifyBiometric(promptMessage: string): Promise<BiometricOutcome> {
  const status = await getBiometricStatus();

  if (!status.available) return { ok: false, reason: 'unavailable' };
  if (!status.enrolled) return { ok: false, reason: 'not_enrolled' };

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: 'برای ثبت، انگشت خود را روی حسگر بگذارید',
      cancelLabel: 'انصراف',
      // رمز صفحه جای انگشت را نمی‌گیرد؛ وگرنه شرط «ثبت با اثر انگشت» بی‌معنی می‌شد.
      disableDeviceFallback: true,
      // فقط بیومتریک کلاس ۳ اندروید: اثر انگشت واقعی یا چهرهٔ سه‌بعدی.
      biometricsSecurityLevel: 'strong',
      requireConfirmation: false,
    });

    if (result.success) {
      return { ok: true, at: Date.now(), kind: status.kind ?? 'biometric' };
    }

    return { ok: false, reason: REASON_BY_ERROR[result.error] ?? 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
