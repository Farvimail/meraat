/**
 * تأییدِ سرتاسریِ کانالِ زندهٔ پنل — روی **سایتِ واقعی**، دستی اجرا می‌شود.
 *
 * چرا این اسکریپت لازم است: سه چیز می‌تواند بی‌سروصدا خراب باشد و هیچ‌کدام از
 * تست‌های محلی نمی‌بیندشان:
 *
 *   ۱) بلوکِ `/ws` در nginx میزبان نباشد → مرورگر سوکت نمی‌گیرد و همه‌چیز
 *      «کار می‌کند» ولی با همان تأخیرِ قبلی.
 *   ۲) سرویسِ هاب بالا نباشد یا کلیدش با `.env` نخواند → PHP خبر می‌فرستد و
 *      ۴۰۳ می‌گیرد، بی‌هیچ خطایی.
 *   ۳) مسیرِ `/publish` اشتباهاً از اینترنت باز شده باشد → هر کسی می‌تواند
 *      پنل‌ها را به تازه‌سازیِ بی‌دلیل وادار کند.
 *
 * پس چهار چیز را می‌سنجد: دست‌دادنِ wss از پشتِ TLS، رسیدنِ پیامِ `change` به
 * سوکتِ باز، رد‌شدنِ `/publish` بدونِ کلید، و بسته‌بودنِ همان مسیر از بیرون.
 *
 * اجرا (روی همین ماشین، رو به سرورِ واقعی):
 *
 *   node scripts/verify-live-hub.mjs
 *   node scripts/verify-live-hub.mjs --host meraat.piqagram.ir --ssh root@1.2.3.4
 *
 * کلیدِ هاب هیچ‌وقت چاپ یا این‌طرف منتقل نمی‌شود: روی خودِ سرور از `.env`
 * خوانده می‌شود، فقط برای همان یک درخواست.
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const HOST = argOf('host', 'meraat.piqagram.ir');
const SSH = argOf('ssh', '');
// `homedir()` عمدی است و نه `$HOME`: روی ویندوز `$HOME` می‌شود
// `/c/Users/...` و ssh خودِ ویندوز این مسیر را نمی‌فهمد.
const SSH_KEY = argOf('key', join(homedir(), '.ssh', 'id_ed25519'));
/** شناسه‌ای که هیچ کارمندی ندارد تا آزمایش به دادهٔ واقعی دست نزند. */
const CARD_ID = Number(argOf('id', '990001'));
const DMY = '16102026';

const WS_URL = `wss://${HOST}/ws`;
const step = (text) => console.log(`\n== ${text}`);
const ok = (text) => console.log(`   ✅ ${text}`);
const fail = (text) => {
  console.log(`   ❌ ${text}`);
  process.exitCode = 1;
};

const ssh = (command) =>
  execFileSync('ssh', ['-i', SSH_KEY, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', SSH, command], {
    encoding: 'utf8',
  }).trim();

/** یک سوکتِ پنل با یک وعده که با اولین پیامِ خواسته‌شده حل می‌شود. */
function openPanelSocket() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    const messages = [];
    let expected = null;
    let waiter = null;

    const waitFor = (predicate, timeoutMs, label) =>
      new Promise((settle, bail) => {
        const found = messages.find(predicate);
        if (found) return settle(found);

        const timer = setTimeout(() => {
          waiter = null;
          bail(new Error(`منتظرِ «${label}» ماندیم و نرسید (پیام‌های رسیده: ${JSON.stringify(messages)})`));
        }, timeoutMs);

        expected = predicate;
        waiter = (message) => {
          if (!predicate(message)) return;
          clearTimeout(timer);
          waiter = null;
          settle(message);
        };
      });

    socket.addEventListener('message', (event) => {
      let message = null;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      // `ping` هاب فقط برای زنده نگه داشتنِ سوکت است؛ جوابش می‌دهیم ولی
      // در فهرستِ پیام‌های «معنادار» نمی‌آوریم.
      if (message?.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      messages.push(message);
      if (waiter) waiter(message);
    });

    socket.addEventListener('error', () => reject(new Error(`سوکت به ${WS_URL} وصل نشد`)));

    resolve({ socket, messages, waitFor, close: () => socket.close() });
  });
}

console.log(`آزمایشِ کانالِ زنده روی ${HOST} (شناسهٔ آزمایشی ${CARD_ID})`);

if (!SSH) {
  console.log('   بدونِ --ssh فقط بخشِ وب آزمایش می‌شود (نیمهٔ PHP لازم است).');
}

/* ------------------------------------------------------ ۱) دست‌دادنِ سوکت */

step('دست‌دادنِ WebSocket از پشتِ TLS');

const panel = await openPanelSocket().catch((error) => {
  fail(error.message);
  return null;
});

if (panel) {
  try {
    const ready = await panel.waitFor((m) => m.type === 'ready', 15000, 'ready');
    ok(`سوکت باز شد و ready آمد (${JSON.stringify(ready)})`);
    panel.socket.send(JSON.stringify({ type: 'watch', ids: [CARD_ID] }));
    ok('فهرستِ کارت‌های زیرِ نظر فرستاده شد');
  } catch (error) {
    fail(error.message);
  }
}

/* --------------------------------------- ۲) مسیرِ انتشار از بیرون بسته است */

step('مسیرِ /publish از اینترنت باز نیست');

const publicPublish = await fetch(`https://${HOST}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dmy: DMY, id: CARD_ID }),
}).catch(() => null);

if (!publicPublish) fail('درخواست به /publish از بیرون جواب نداد');
else if (publicPublish.status === 200) fail('/publish از بیرون ۲۰۰ داد — یعنی هر کسی می‌تواند هاب را خبر کند');
else ok(`از بیرون ${publicPublish.status} می‌دهد (فقط /ws پروکسی شده است)`);

/* ------------------------------------------- ۳) رد‌شدنِ کلیدِ نادرست */

if (SSH) {
  step('هاب کلیدِ نادرست را رد می‌کند');

  const forbidden = ssh(
    `cd /var/www/meraat && ` +
      `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' ` +
      `-H 'X-Meraat-Secret: definitely-wrong' ` +
      `--data '{"dmy":"${DMY}","id":${CARD_ID}}' http://127.0.0.1:8091/publish`,
  );

  if (forbidden === '403') ok('کلیدِ نادرست ۴۰۳ گرفت');
  else fail(`کلیدِ نادرست ${forbidden} گرفت (باید ۴۰۳ باشد)`);

  step('هاب زنده است');

  const health = ssh('curl -s --max-time 5 http://127.0.0.1:8091/health');
  if (health.includes('"ok":true')) ok(`/health: ${health}`);
  else fail(`/health پاسخِ نامنتظر داد: ${health}`);

  /* --------------------- ۴) همان درخواستی که PHP می‌فرستد → پیام به سوکت */

  step('درخواستِ PHP (همان /publish با کلیدِ درست) به سوکتِ پنل می‌رسد');

  const delivered = ssh(
    `cd /var/www/meraat && set -a && . ./.env && set +a && ` +
      `curl -s -X POST -H 'Content-Type: application/json' -H "X-Meraat-Secret: $HUB_SECRET" ` +
      `--data '{"dmy":"${DMY}","id":${CARD_ID},"revision":"verify"}' http://127.0.0.1:8091/publish`,
  );

  let deliveredCount = null;

  try {
    deliveredCount = JSON.parse(delivered).delivered;
  } catch {
    fail(`پاسخِ /publish خوانده نشد: ${delivered}`);
  }

  if (deliveredCount !== null && deliveredCount < 1) {
    fail(`هاب پیام را به هیچ سوکتی نرساند (delivered=${deliveredCount}) — سوکتِ ما در فهرست نبود`);
  } else if (deliveredCount !== null) {
    ok(`هاب گفت به ${deliveredCount} سوکت رسانده شد`);
  }

  if (panel) {
    try {
      const change = await panel.waitFor((m) => m.type === 'change' && m.id === CARD_ID, 15000, 'change');
      ok(`پیام و روی سوکت نشست: ${JSON.stringify(change)}`);
    } catch (error) {
      fail(error.message);
    }
  }
}

panel?.close();

console.log(
  process.exitCode === 1
    ? '\nنتیجه: یک یا چند بررسی رد شد (بالا را ببین).\n'
    : '\nنتیجه: کانالِ زندهٔ پنل سرتاسری سالم است.\n',
);
