import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEVICE_NAME, STORAGE_KEYS } from './config';

/**
 * هویت دستگاه.
 *
 * `device_id` شناسهٔ نصب است و `device_secret` یک راز تصادفی که همراه هر
 * درخواست می‌رود؛ سرور با آن می‌فهمد درخواست از همان نصبِ بسته‌شده می‌آید.
 *
 * نکتهٔ مهم دربارهٔ «بسته شدن به یک گوشی»: اگر اپ حذف و نصب شود، هم
 * SecureStore اندروید پاک می‌شود و هم شناسهٔ نصب عوض می‌شود؛ پس کاربر باید
 * برای آزادسازی دستگاه به مدیر زنگ بزند. این عمدی است — وگرنه هر کسی با
 * حذف و نصب می‌توانست قید «یک کارمند، یک گوشی» را دور بزند.
 */

export interface DeviceIdentity {
  deviceId: string;
  deviceSecret: string;
  platform: string;
  /**
   * برچسبِ خوانا برای مدیر: مدلِ واقعیِ گوشی (مثلاً `Pixel 8`) و اگر دستگاه
   * مدل نداشت (وب/شبیه‌ساز) همان نامِ پیش‌فرضِ اپ.
   *
   * چرا لازم است: در پنل و در خروجیِ `mobile:release --list` باید معلوم باشد
   * هر کارمند روی کدام گوشی نشسته است؛ `platform` به‌تنهایی فقط «android»
   * می‌گوید و پنج گوشیِ مختلف یک‌شکل دیده می‌شوند.
   */
  label: string;
}

/** مدلِ گوشی، با افتادن به نامِ پیش‌فرضِ اپ اگر دستگاه گزارش نداد. */
function deviceLabel(): string {
  try {
    const model = typeof Device.modelName === 'string' ? Device.modelName.trim() : '';

    return model === '' ? DEVICE_NAME : model;
  } catch {
    return DEVICE_NAME;
  }
}

let cached: DeviceIdentity | null = null;

/** اگر SecureStore روی این پلتفرم نبود، اپ نباید کرش کند. */
const memoryFallback = new Map<string, string>();

async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;

  const existingId = await safeGet(STORAGE_KEYS.deviceId);
  const existingSecret = await safeGet(STORAGE_KEYS.deviceSecret);

  if (existingId && existingSecret) {
    cached = {
      deviceId: existingId,
      deviceSecret: existingSecret,
      platform: Platform.OS,
      label: deviceLabel(),
    };
    return cached;
  }

  // randomUUID برای شناسه، و ۳۲ بایت تصادفیِ رمزنگارانه برای راز.
  const deviceId = Crypto.randomUUID();
  const deviceSecret = toHex(await Crypto.getRandomBytesAsync(32));

  await safeSet(STORAGE_KEYS.deviceId, deviceId);
  await safeSet(STORAGE_KEYS.deviceSecret, deviceSecret);

  cached = { deviceId, deviceSecret, platform: Platform.OS, label: deviceLabel() };
  return cached;
}
