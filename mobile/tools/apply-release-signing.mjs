/**
 * امضای ریلیزِ اندروید را روی پروژهٔ تولیدشدهٔ `expo prebuild` سیم‌کشی می‌کند.
 *
 * چرا لازم است: پوشهٔ `android/` ساختهٔ prebuild است و در مخزن نمی‌رود؛ پس هر
 * بار که دوباره ساخته شود، `build.gradle` هم تازه می‌شود و به همان کلیدِ دیباگِ
 * پیش‌فرض برمی‌گردد — یعنی APKای که به دست کارمندان می‌رسد با کلیدِ درست امضا
 * نمی‌شود. این اسکریپت همان چند خط را هر بار (و فقط یک‌بار) می‌نویسد.
 *
 *   node tools/apply-release-signing.mjs
 *
 * پیش‌نیاز: `keys/keystore.properties` و فایلِ keystore کنارش (هر دو gitignore).
 *
 * اجرا:  node tools/apply-release-signing.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, '..');
const gradlePath = resolve(mobileRoot, 'android/app/build.gradle');
const keystoreProps = resolve(mobileRoot, 'keys/keystore.properties');

if (!existsSync(gradlePath)) {
  console.error('android/app/build.gradle پیدا نشد. اول `npx expo prebuild --platform android` را بزن.');
  process.exit(1);
}

const source = readFileSync(gradlePath, 'utf8');

if (source.includes('releaseKeystoreProps')) {
  console.log('✔ امضای ریلیز از قبل وصل است؛ کاری لازم نیست.');
  process.exit(0);
}

if (!existsSync(keystoreProps)) {
  console.error('keys/keystore.properties پیدا نشد؛ کلید امضا موجود نیست.');
  process.exit(1);
}

// ۱) بلوکِ signingConfigs — یک signingConfig اضافهٔ release که از keys/ می‌خواند.
const signingBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const signedBlock = `    // کلید امضای خودِ پروژه در mobile/keys/ است (در مخزن نمی‌رود). اگر
    // نباشد، ریلیز با کلید دیباگ امضا می‌شود تا ساخت روی ماشینی بدون کلید
    // هم بشکند — ولی برای نسخه‌ای که به دست کارمندان می‌رسد، کلید باید باشد.
    def releaseKeystoreProps = rootProject.file('../keys/keystore.properties')

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (releaseKeystoreProps.exists()) {
                def keystoreProps = new Properties()
                releaseKeystoreProps.withInputStream { keystoreProps.load(it) }
                storeFile rootProject.file('../keys/' + keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }`;

// ۲) ریلیز باید از همان signingConfig استفاده کند، نه از کلید دیباگ.
const debugRelease = `            signingConfig signingConfigs.debug
            def enableShrinkResources`;

const signedRelease = `            signingConfig releaseKeystoreProps.exists() ? signingConfigs.release : signingConfigs.debug
            def enableShrinkResources`;

if (!source.includes(signingBlock)) {
  console.error('بلوکِ signingConfigs در build.gradle با الگوی مورد انتظار جور نیست (نسخهٔ Expo عوض شده؟).');
  process.exit(1);
}

if (!source.includes(debugRelease)) {
  console.error('تنظیمِ signingConfig در buildTypes.release با الگوی مورد انتظار جور نیست.');
  process.exit(1);
}

const patched = source.replace(signingBlock, signedBlock).replace(debugRelease, signedRelease);

writeFileSync(gradlePath, patched);
console.log('✔ امضای ریلیز به android/app/build.gradle وصل شد (کلید: keys/keystore.properties).');
