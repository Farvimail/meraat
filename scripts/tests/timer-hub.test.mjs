/*
  هابِ زنده (ws/timer-hub.mjs) — بررسیِ واقعی، بدون وابستگی.

  خودِ هاب را در یک پروسهٔ جدا بالا می‌آورد، یک سوکتِ واقعی باز می‌کند، از
  مسیرِ `/publish` همان کاری را می‌کند که بعد از ثبتِ گوشی PHP می‌کند و می‌سنجد
  خبر به دستِ درستِ می‌رسد:

    ۱) وصل شدن → پیام `ready`
    ۲) گوش‌دادنِ کارت‌ها (`watch`) → `change` فقط برای همان کارت‌ها
    ۳) بدونِ کلیدِ درست → ۴۰۳ (کسی از بیرون نمی‌تواند پنل را به تازه‌کردن وادارد)
    ۴) کارتِ خارجِ از فهرست → ارسال نمی‌شود (delivered: 0)
    ۵) `/health` پاسخ می‌دهد تا healthcheck داکر آرام بماند
    ۶) تعدادِ پنل‌های باز: در `ready` و با پیامِ `peers` هنگامِ آمدن و رفتنِ هر پنل

  اجرا:  node scripts/tests/timer-hub.test.mjs
*/
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const hubPath = resolve(here, '../../ws/timer-hub.mjs');
const SECRET = 'hub-secret-for-tests';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** صبر کردن روی یک شرط؛ با مهلتِ محدود تا تست گیر نکند. */
async function until(fn, timeout = 4000, every = 25) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(every);
  }
  return null;
}

/** بالا آوردن هاب روی یک پورت آزاد (با چند تلاش، برای پورتِ اشغال). */
async function startHub() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const port = 18000 + Math.floor(Math.random() * 2000) + attempt;
    const child = spawn(process.execPath, [hubPath], {
      env: { ...process.env, HUB_PORT: String(port), HUB_SECRET: SECRET },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let log = '';
    child.stdout.on('data', (chunk) => (log += chunk));
    child.stderr.on('data', (chunk) => (log += chunk));

    const healthy = await until(async () => {
      if (child.exitCode !== null) return null;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        return (await response.json()).ok === true;
      } catch {
        return null;
      }
    }, 3000);

    if (healthy) return { child, port, log };

    child.kill('SIGKILL');
    await sleep(100);
  }

  throw new Error('هاب روی هیچ پورتی بالا نیامد.');
}

/** پیامِ بعدیِ سوکت را می‌گیرد (یا null اگر مهلت تمام شود). */
function nextMessage(socket, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.removeEventListener('message', onMessage);
      resolve(null);
    }, timeout);

    function onMessage(event) {
      clearTimeout(timer);
      resolve(JSON.parse(event.data));
    }

    socket.addEventListener('message', onMessage, { once: true });
  });
}

/** `POST /publish` — همان درخواستی که `App\TimerHub` می‌فرستد. */
function publish(port, body, secret = null) {
  return fetch(`http://127.0.0.1:${port}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-Meraat-Secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

const { child, port } = await startHub();

try {
  // ۱) وصل شدن
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const opened = await new Promise((resolve) => {
    socket.addEventListener('open', () => resolve(true), { once: true });
    socket.addEventListener('error', () => resolve(false), { once: true });
  });
  assert.ok(opened, 'سوکت باید وصل شود');

  const ready = await nextMessage(socket);
  assert.equal(ready.type, 'ready', 'پیامِ آماده باید بیاید');
  assert.equal(ready.clients, 1, 'ready باید تعدادِ پنل‌های باز را هم بگوید (۱ = همین یکی)');

  // ۲) گوش‌دادنِ کارت‌های همین صفحه
  socket.send(JSON.stringify({ type: 'watch', ids: [12, 15] }));
  await sleep(50);

  // گوشِ دریافت را **قبل از** ارسال باز می‌کنیم: پیامِ هاب همان لحظه می‌آید و
  // اگر شنونده بعد از `await` ثبت شود، همان لحظه از دست رفته است (خودِ کانال
  // سالم است، فقط شنونده دیر رسیده) — دامی که خودِ همین تست توش افتاد.
  const changePromise = nextMessage(socket);

  const accepted = await publish(port, { dmy: '16102026', id: 12, revision: '1:900' }, SECRET);
  assert.equal(accepted.status, 200, 'publish با کلیدِ درست باید پذیرفته شود');
  assert.equal((await accepted.json()).delivered, 1, 'خبر باید به همان سوکت برسد');

  const change = await changePromise;
  assert.ok(change, 'پیامِ تغییر باید برسد');
  assert.equal(change.type, 'change', 'نوعِ پیام باید change باشد');
  assert.equal(change.id, 12, 'همان کارمندی که عوض شده');
  assert.equal(change.dmy, '16102026', 'تاریخِ رکورد باید دست‌نخورده بماند');

  // ۳) بدونِ کلید → ۴۰۳
  assert.equal((await publish(port, { dmy: '16102026', id: 12 })).status, 403, 'بدونِ کلید نباید ارسال شود');
  assert.equal((await publish(port, { dmy: '16102026', id: 12 }, 'WRONG')).status, 403, 'کلیدِ غلط هم نباید قبول شود');

  // ۴) کارتِ خارجِ از فهرست: به کسی نرسد
  const ignored = await publish(port, { dmy: '16102026', id: 99, revision: '1:901' }, SECRET);
  assert.equal((await ignored.json()).delivered, 0, 'کارتِ خارج از فهرست نباید ارسال شود');

  // ۴٫۵) «کارتِ فلانی را بزرگ نشان بده» → به سوکتی که آن کارت را watch نکرده هم می‌رسد.
  // کارمند پشتِ گوشی ایستاده و کدِ خودش را روی صفحه می‌خواهد؛ مشروط کردنِ این
  // پیام به فهرستِ کارت‌های صفحه یعنی صفحه‌ای که فهرستش را تازه نداده، هیچ
  // واکنشی نشان نمی‌دهد. پس اینجا ۹۹ (خارج از watch) باید برسد.
  const focusPromise = nextMessage(socket);

  const focused = await publish(port, { type: 'qr-focus', id: 99 }, SECRET);
  assert.equal(focused.status, 200, 'پیامِ «نشانم بده» باید پذیرفته شود');
  assert.equal((await focused.json()).delivered, 1, 'باید به پنلِ باز برسد');

  const focus = await focusPromise;
  assert.ok(focus, 'پیامِ بزرگ‌نمایی باید برسد');
  assert.equal(focus.type, 'qr-focus', 'نوعِ پیام باید qr-focus باشد');
  assert.equal(focus.id, 99, 'شناسهٔ همان کارت باید دست‌نخورده برسد');

  // ۴٫۶) «جمع کن» (qr-blur) — وقتی کارمند اسکنر را در گوشی می‌بندد؛ همان مسیر و همان قرارداد.
  const blurPromise = nextMessage(socket);

  const blurred = await publish(port, { type: 'qr-blur', id: 99 }, SECRET);
  assert.equal(blurred.status, 200, 'پیامِ «جمع کن» باید پذیرفته شود');
  assert.equal((await blurred.json()).delivered, 1, 'qr-blur هم باید به پنلِ باز برسد');

  const blur = await blurPromise;
  assert.ok(blur, 'پیامِ جمع‌کردن باید برسد');
  assert.equal(blur.type, 'qr-blur', 'نوعِ پیام باید qr-blur باشد');
  assert.equal(blur.id, 99, 'شناسهٔ qr-blur هم باید دست‌نخورده برسد');

  // بدونِ شناسه → رد؛ مثلِ qr-focus.
  const blurNoId = await publish(port, { type: 'qr-blur' }, SECRET);
  assert.equal(blurNoId.status, 422, 'qr-blur بدونِ شناسه باید رد شود');

  // بدونِ شناسه → رد؛ وگرنه پنل کارتِ نامعلوم را بزرگ می‌کرد.
  const noId = await publish(port, { type: 'qr-focus' }, SECRET);
  assert.equal(noId.status, 422, 'qr-focus بدونِ شناسه باید رد شود');

  // ۵) بدنهٔ خراب → ۴۲۲، نه سقوط
  const bad = await publish(port, { nope: true }, SECRET);
  assert.equal(bad.status, 422, 'بدنهٔ خراب باید رد شود');

  // ۶) health برای healthcheck داکر
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.ok, true, '/health باید سالم باشد');

  // ۷) تعدادِ پنل‌های باز — همان عددی که چیپِ نوار بالای پنل نشان می‌دهد.
  //گوشِ سوکتِ اول **قبل از** باز کردنِ سوکتِ دوم باز می‌شود: هاب خبر را همان
  // لحظه می‌فرستد و اگر شنونده دیر برسد، پیام از دست می‌رود (همان دامی که
  // بالاتر هم توضیح داده شده).
  const peersOnJoin = nextMessage(socket, 5000);

  const second = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const secondOpened = await new Promise((resolve) => {
    second.addEventListener('open', () => resolve(true), { once: true });
    second.addEventListener('error', () => resolve(false), { once: true });
  });
  assert.ok(secondOpened, 'سوکتِ دوم باید وصل شود');

  const secondReady = await nextMessage(second);
  assert.equal(secondReady.clients, 2, 'پنلِ دوم باید ببیند که ۲ پنل باز است');

  const joined = await peersOnJoin;
  assert.ok(joined, 'پنلِ اول باید خبرِ پیوستن را بگیرد');
  assert.equal(joined.type, 'peers', 'نوعِ پیامِ تعدادِ پنل‌ها باید peers باشد');
  assert.equal(joined.count, 2, 'بعد از پیوستنِ پنلِ دوم، عدد باید ۲ شود');

  // و وقتی پنلی می‌رود، باقی همان لحظه می‌فهمند.
  const peersOnLeave = nextMessage(socket, 5000);
  second.close();

  const left = await peersOnLeave;
  assert.ok(left, 'پنلِ اول باید خبرِ رفتن را بگیرد');
  assert.equal(left.count, 1, 'بعد از رفتنِ پنلِ دوم، عدد باید ۱ شود');

  socket.close();
  console.log(
    '✔ هاب: وصل شدن، رساندنِ تغییر، بزرگ‌نماییِ کارت، ردِ کلیدِ نادرست، health و تعدادِ پنل‌ها',
  );
} finally {
  child.kill('SIGTERM');
}

console.log('\nهمهٔ بررسی‌های هابِ تازه‌سازیِ زنده گذشت.');
