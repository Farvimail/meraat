import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PHOTO_ASPECT,
  PHOTO_MAX_BYTES,
  PHOTO_QUALITY,
  checkPhoto,
  isWebPhotoUri,
  photoFileName,
  photoMimeType,
  photoRejectionMessage,
  pickerOptions,
} from '../profile-photo.ts';

test('پیکر خام می‌آورد؛ برش و چرخش کارِ ویرایشگرِ خودِ اپ است', () => {
  const options = pickerOptions('library');

  // قابِ مربع قراردادِ نهایی است (ویرایشگر همین را اجرا می‌کند)، نه کارِ
  // پیکر — پس `aspect` می‌ماند ولی `allowsEditing` خاموش است تا عکسِ خام
  // به ویرایشگر برسد و کاربر دو برشِ پشتِ سرِ هم ندهد.
  assert.deepEqual(options.aspect, PHOTO_ASPECT, 'قاب باید مربع باشد');
  assert.deepEqual(PHOTO_ASPECT, [1, 1]);
  assert.equal(
    options.allowsEditing,
    false,
    'برشِ سیستم‌عامل باید خاموش باشد تا چرخشِ ویرایشگر معنا داشته باشد',
  );
  assert.equal(options.mediaTypes, 'images', 'فقط عکس، نه ویدیو');
  assert.equal(options.quality, PHOTO_QUALITY);
  assert.equal(options.exif, false, 'مکانِ عکس‌برداری نباید فرستاده شود');
  assert.equal(options.base64, false);
});

test('دوربین پیش‌فرضِ جلویی است و گالری به دوربین کاری ندارد', () => {
  assert.equal(pickerOptions('camera').cameraType, 'front');
  assert.equal(pickerOptions('library').cameraType, 'back');
});

test('عکسِ نبوده/بزرگ/غیرتصویری رد می‌شود و بقیه رد نمی‌شود', () => {
  assert.equal(checkPhoto(null), 'missing');
  assert.equal(checkPhoto({ uri: '   ' }), 'missing');

  assert.equal(
    checkPhoto({ uri: 'file://a.jpg', fileSize: PHOTO_MAX_BYTES + 1 }),
    'too_large',
    'حجمِ بیشتر از سقفِ سرور باید روی گوشی گرفته شود، نه بعد از آپلود',
  );
  assert.equal(checkPhoto({ uri: 'file://a.jpg', fileSize: PHOTO_MAX_BYTES }), null);

  assert.equal(checkPhoto({ uri: 'file://a.pdf', mimeType: 'application/pdf' }), 'not_image');

  // نوعِ نامعلوم (بعضی گالری‌های اندروید) رد نمی‌شود؛ سرور از محتوا می‌خواند.
  assert.equal(checkPhoto({ uri: 'file://a.jpg', mimeType: null }), null);
});

test('نوعِ MIME از خودِ asset، وگرنه از پسوند', () => {
  assert.equal(photoMimeType({ uri: 'a', mimeType: 'image/png' }), 'image/png');
  assert.equal(
    photoMimeType({ uri: 'a', mimeType: 'image/jpg' }),
    'image/jpeg',
    'نامِ جایگزینِ jpg باید به نوعِ استاندارد تبدیل شود',
  );
  assert.equal(photoMimeType({ uri: 'a', fileName: 'IMG_0042.PNG' }), 'image/png');
  assert.equal(
    photoMimeType({ uri: 'a', mimeType: 'application/octet-stream' }),
    'image/jpeg',
    'نوعِ ناشناخته نباید به سرور برود؛ پیش‌فرضِ تصویری می‌گذاریم',
  );
});

test('نامِ فایلِ ارسالی سالم و پسونددار است', () => {
  assert.equal(photoFileName({ uri: 'a', mimeType: 'image/png', fileName: 'me.png' }), 'me.png');
  assert.equal(
    photoFileName({ uri: 'a', mimeType: 'image/png', fileName: 'me' }),
    'me.png',
    'بی‌پسوند نباید فایلِ بی‌نوع بسازد',
  );
  assert.equal(
    photoFileName({ uri: 'a', mimeType: 'image/jpeg', fileName: 'عکس من.jpg' }),
    'عکس-من.jpg',
    'فاصله در نام فایل مشکل‌ساز است، ولی حرف فارسی نه',
  );
  assert.equal(photoFileName({ uri: 'a', mimeType: 'image/jpeg' }), 'avatar.jpg');
});

test('نشانیِ وب باید اول Blob شود، ولی نشانیِ گوشی نه', () => {
  assert.equal(isWebPhotoUri('blob:http://localhost:8081/abc'), true);
  assert.equal(isWebPhotoUri('data:image/jpeg;base64,AAAA'), true);
  assert.equal(
    isWebPhotoUri('file:///var/mobile/tmp/IMG_1.jpg'),
    false,
    'در گوشی همان شیءِ {uri,name,type} کار می‌کند',
  );
});

test('هر دلیلِ رد شدن پیامِ فارسی دارد', () => {
  for (const reason of ['missing', 'too_large', 'not_image'] as const) {
    const message = photoRejectionMessage(reason);

    assert.ok(message.length > 5, `پیامِ ${reason} باید روشن باشد`);
    assert.match(message, /[\u0600-\u06FF]/, 'پیام باید فارسی باشد');
  }
});
