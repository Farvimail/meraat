/*
 * باز کردنِ گالری یا دوربین برای عکسِ پروفایل.
 *
 * چرا جدا از `profile-photo.ts`: آن فایل منطقِ خالص است و در تست هم می‌آید؛
 * این یکی به Expo و دستگاه وابسته است و فقط در اپ اجرا می‌شود. تفکیکشان
 * یعنی امکان تستِ قواعدِ عکس بدون شبیه‌ساز گوشی.
 *
 * نکتهٔ اجازه‌ها: روی iOS وقتی کاربر «انتخابِ محدود» را می‌زند،
 * `granted` می‌شود `false` ولی `accessPrivileges` مقدار `limited` می‌گیرد.
 * اگر آن حالت را رد کنیم، کاربری که چند عکسِ خاص را مجاز کرده نمی‌تواند
 * هیچ عکسی بگذارد — پس هر دو حالت «اجازه داد» حساب می‌شوند.
 */

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { pickerOptions } from './profile-photo';
import type { PhotoSource, PickedPhoto } from './profile-photo';

export type PickOutcome =
  /** عکس انتخاب شد (و اگر برش لازم بود، کاربر خودش در پیکرِ سیستم انجام داد). */
  | { status: 'picked'; photo: PickedPhoto }
  /** کاربر پیکر را بست یا «لغو» زد. خطا نیست. */
  | { status: 'cancelled' }
  /** اجازهٔ دسترسی داده نشد (یا در تنظیمات بسته شده است). */
  | { status: 'denied' }
  /** پیکر باز شد ولی عکسی برنگرداند. */
  | { status: 'failed' };

/** گرفتنِ اجازه، اگر لازم است. در وب، مرورگر خودش موقع انتخاب اجازه می‌گیرد. */
async function ensurePermission(source: PhotoSource): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  const media = permission as { accessPrivileges?: string };

  return Boolean(permission.granted) || media.accessPrivileges === 'limited';
}

export async function pickProfilePhoto(source: PhotoSource): Promise<PickOutcome> {
  try {
    if (!(await ensurePermission(source))) {
      return { status: 'denied' };
    }

    /*
     * گزینه‌ها در فایلِ خالص (`profile-photo.ts`) ساخته می‌شوند و آن‌جا
     * `cameraType` یک رشتهٔ ساده است، چون آن فایل نباید به Expo وابسته
     * شود؛ اینجا فقط به نوعِ خودِ پکیج تبدیلش می‌کنیم.
     */
    const base = pickerOptions(source);
    const options: ImagePicker.ImagePickerOptions = {
      ...base,
      cameraType: base.cameraType as ImagePicker.CameraType,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) {
      return { status: 'cancelled' };
    }

    const asset = result.assets?.[0];

    if (!asset || !asset.uri) {
      return { status: 'failed' };
    }

    return {
      status: 'picked',
      photo: {
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
        fileSize: asset.fileSize ?? null,
        // اندازهٔ واقعیِ تصویر: مبنای هندسهٔ ویرایشگر (چرخش و برشِ مربع).
        width: asset.width ?? null,
        height: asset.height ?? null,
      },
    };
  } catch {
    // هر خطای غیرمنتظرهٔ پیکر (چیدمانِ عجیبِ دستگاه، حافظهٔ کم) باید به
    // پیامِ روشن برسد، نه به صفحهٔ سفید.
    return { status: 'failed' };
  }
}
