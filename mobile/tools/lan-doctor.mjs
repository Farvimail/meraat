/**
 * پزشک اتصال Expo Go — بدون هیچ وابستگی.
 *
 * خطای «java.io.IOException: Failed to download remote update» روی اندروید
 * تقریباً همیشه یعنی گوشی نتوانسته manifest را از Metro بگیرد؛ خودِ Metro سالم
 * است. این اسکریپت همان چیزی را چاپ می‌کند که گوشی باید به آن برسد، تا معلوم
 * شود مشکل از کدام طرف است.
 *
 * اجرا:
 *   node tools/lan-doctor.mjs           # پورت پیش‌فرض 8081
 *   node tools/lan-doctor.mjs --port 8083
 */
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// بستهٔ lan-network فقط برای `require` صادر شده (exports map)، پس import وابسته
// به مسیر شکست می‌خورد و باید با require گرفته شود.
const requireFromHere = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const portIndex = argv.indexOf('--port');
const PORT = Number(portIndex === -1 ? 8081 : argv[portIndex + 1]) || 8081;

// کارت‌های شبکهٔ مجازی (VPN / تونل / ماشین مجازی). اگر Expo اشتباهاً یکی از
// این‌ها را انتخاب کند، آدرس داخل QR برای گوشی بی‌معنی می‌شود.
const VIRTUAL = /^(tun|tap|utun|wg|sing|clash|hiddify|v2ray|wintun|docker|vEthernet|Hyper-V|Loopback|Npcap|ZeroTier|Tailscale|Radmin|WireGuard)/i;

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/** آدرسی که Expo در QR می‌گذارد. Expo از بستهٔ lan-network استفاده می‌کند. */
async function advertised() {
  try {
    const { lanNetwork } = requireFromHere('lan-network');
    return { ...(await lanNetwork()), source: 'lan-network (همان تابع Expo)' };
  } catch {
    // fallback: اولین کارت غیرداخلی و غیرمجازی
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family !== 'IPv4' || address.internal) continue;
        if (VIRTUAL.test(name)) continue;
        return { iname: name, address: address.address, source: 'حدس سادهٔ کارت‌ها' };
      }
    }
    return { iname: null, address: '127.0.0.1', source: 'هیچ کارت شبکهٔ مناسبی پیدا نشد' };
  }
}

async function probe(host, statusOnly = false) {
  const url = `http://${host}:${PORT}${statusOnly ? '/status' : '/'}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const body = statusOnly ? (await response.text()).trim() : '';
    return { ok: response.ok, url, body };
  } catch (error) {
    return { ok: false, url, body: error.name === 'TimeoutError' ? 'timeout' : error.message };
  }
}

function virtualCards() {
  const rows = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (VIRTUAL.test(name)) rows.push(`${name} → ${address.address}`);
    }
  }
  return rows;
}

function firewallRules() {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync(
      'netsh',
      ['advfirewall', 'firewall', 'show', 'rule', 'name=Node.js JavaScript Runtime', 'dir=in'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // فقط قاعده‌هایی که واقعاً اجازه می‌دهند مهم‌اند؛ یک قاعدهٔ Block همه‌چیز را خراب می‌کند.
    return out
      .split(/\r?\n/)
      .filter((line) => /Action:|Enabled:|Profiles:/.test(line))
      .map((line) => line.trim());
  } catch {
    return ['(قاعدهٔ ورودی برای node.exe پیدا نشد — ویندوز هنگام اولین اجرای سرور می‌پرسد)'];
  }
}

const chosen = await advertised();
const local = await probe('127.0.0.1', true);
const viaLan = await probe(chosen.address, true);
const card = chosen.iname ?? '?';
const url = `http://${chosen.address}:${PORT}`;

console.log(bold('\n=== پزشک اتصال Expo Go ===\n'));

console.log(bold('۱) آدرسی که باید داخل QR باشد'));
console.log(`   exp://${chosen.address}:${PORT}`);
console.log(dim(`   کارت انتخاب‌شده: ${card}  (${chosen.source})`));
if (chosen.address === '127.0.0.1') {
  console.log('   ⛔ آدرس loopback است: گوشی هیچ‌وقت به آن نمی‌رسد.');
  console.log('      سرور را این‌طور بالا بیاورید:  REACT_NATIVE_PACKAGER_HOSTNAME=<IP> npx expo start --lan');
}

console.log(bold('\n۲) وضعیت سرور Metro'));
console.log(`   روی خود کامپیوتر:  ${local.ok ? '✅ در حال اجرا' : '❌ اجرا نیست'}  ${dim(local.url)}`);
console.log(`   از طریق شبکه:      ${viaLan.ok ? '✅ پاسخ می‌دهد' : '❌ پاسخ نمی‌دهد'}  ${dim(viaLan.url)}`);
if (viaLan.ok) console.log(`   پاسخ: ${viaLan.body}`);
else if (!local.ok) console.log(dim('   اول `npx expo start --lan` را اجرا کنید، بعد این اسکریپت.'));
else console.log(dim('   یعنی خودِ ویندوز/فایروال اجازه نمی‌دهد یا کارت شبکهٔ اشتباهی انتخاب شده.'));

console.log(bold('\n۳) تستی که خودتان روی گوشی انجام دهید'));
console.log(`   در مرورگر گوشی (نه Expo Go) این آدرس را باز کنید:`);
console.log(`   ${bold(url + '/status')}`);
console.log('   ✅ اگر نوشت packager-status:running → شبکه سالم است، پس مشکل خودِ Expo Go یا آدرس داخل QR است.');
console.log('   ❌ اگر باز نشد → گوشی به این شبکه نمی‌رسد؛ دلایل رایج پایین.');

const virtuals = virtualCards();
if (virtuals.length) {
  console.log(bold('\n۴) کارت‌های شبکهٔ مجازی که پیدا شدند'));
  for (const row of virtuals) console.log(`   ${row}`);
  console.log('   اگر یک VPN/TUN روی همین ویندوز روشن است، ممکن است آدرس داخل QR را');
  console.log('   جابه‌جا کند؛ در آن صورت آدرس را دستی تثبیت کنید:');
  console.log(dim(`   REACT_NATIVE_PACKAGER_HOSTNAME=${chosen.address} npx expo start --lan`));
}

const rules = firewallRules();
if (rules.length) {
  console.log(bold('\n۵) فایروال ویندوز برای node.exe (ورودی)'));
  for (const line of rules.slice(0, 9)) console.log(`   ${line}`);
  console.log(dim('   باید Action: Allow و Enabled: Yes باشد و پروفایل شامل Private/Public.'));
}

console.log(bold('\nچه چیزهایی روی گوشی کنترل می‌شود'));
console.log('   • VPN روی گوشی باید خاموش باشد (یا «عبور از شبکهٔ محلی» روشن).');
console.log('   • گوشی باید روی همان Wi-Fi باشد — نه دیتای موبایل و نه SSID مهمان.');
console.log('   • بعضی روترها/اکسس‌پوینت‌ها ارتباط بین کلاینت‌ها (Client Isolation) را می‌بندند.');
console.log('   • در فوتر صفحهٔ Expo Go نسخهٔ آن باید SDK 57 را پشتیبانی کند.\n');
