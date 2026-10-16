/**
 * هابِ WebSocket تایمرِ پنل — بدون هیچ وابستگی (فقط ماژول‌های خودِ Node).
 *
 * مسئله: ثبتِ حضوری که با گوشی انجام می‌شود باید «همان لحظه» در پنل دیده
 * شود. پنل با درخواست‌های دوره‌ای این کار را می‌کرد و طبیعی است که تا رسیدنِ
 * نوبتِ درخواستِ بعدی تأخیر داشته باشد. این هاب به‌جای «پرسیدنِ دوره‌ای»،
 * تغییر را از سمت سرور **هل می‌دهد**: به‌محضِ ثبت، PHP یک درخواستِ کوچک به
 * `/publish` می‌فرستد و هاب همان لحظه به همهٔ پنل‌های بازِ همان تاریخ خبر
 * می‌دهد.
 *
 * چرا بدون وابستگی: سرورِ محل کار است و هر پکیجِ npm یک ریسکِ نگه‌داری است؛
 * پروتکلِ WebSocket برای همین مقدار کار (متنِ JSON کوچک) خودش چند خط است.
 * همان قاعدهٔ `mobile/tools/mock-api.mjs` که آن هم هیچ وابستگی ندارد.
 *
 * قرارداد:
 *
 *   GET /ws?dmy=16102026&ids=12,15,23   ← پنل وصل می‌شود (همان لحظه `ready`)
 *   POST /publish  {dmy,id,revision}    ← PHP بعد از ثبت می‌زند (`x-meraat-secret`)
 *   POST /publish  {type:"qr-focus",id} ← PHP وقتی کارمند در اپ اسکنر را باز می‌کند
 *   POST /publish  {type:"qr-blur",id}  ← PHP وقتی کارمند اسکنر را می‌بندد
 *   GET /health                          ← برای healthcheck داکر
 *
 * پیام‌های هاب به پنل:
 *   {"type":"ready","watching":3,"clients":2}            وصل شد (۳ کارت، ۲ پنل)
 *   {"type":"change","dmy":"…","id":12,"revision":"3:941"} کارمند ۱۲ عوض شد
 *   {"type":"qr-focus","id":12}                          کارتِ ۱۲ را بزرگ نشان بده
 *   {"type":"qr-blur","id":12}                           کارتِ ۱۲ را جمع کن (اسکنر بسته شد)
 *   {"type":"peers","count":2}                          تعداد پنل‌های وصل‌شده عوض شد
 *   {"type":"ping"}                                      نگه‌داشتنِ اتصال
 *
 * پیام‌های پنل به هاب:
 *   {"type":"watch","dmy":"…","ids":[12,15]}   فهرستِ کارت‌های همین صفحه
 *   {"type":"pong"}
 *
 * نکتهٔ امنیتی: از این کانال هیچ دادهٔ شخصی نمی‌رود — فقط «کدام کارمند عوض
 * شد» و «کدام کارت را بزرگ نشان بده». خودِ رکوردها و خودِ کدِ QR را پنل با
 * همان مسیرِ همیشگی می‌خواند. پس روی این مسیر احراز هویتِ نشست لازم نیست
 * (مثل `/read/timer-revision` که از قبل باز بود)، ولی مسیرِ `/publish` کلیدِ
 * مشترک دارد تا کسی از بیرون نتواند هاب را به به‌روزرسانیِ بی‌دلیل وادار کند.
 *
 * چرا `qr-focus` به **همهٔ** پنل‌ها می‌رود ولی `change` فقط به کارت‌های تحتِ
 * نظر: رویدادِ اول یک کارِ فیزیکی است — کارمند گوشی‌اش را مقابل صفحه گرفته و
 * منتظر است ببیند کدِ خودش کجاست؛ صفحه‌ای که کارتش را دارد باید واکنش بدهد
 * حتی اگر همان لحظه فهرستِ کارت‌هایش را به هاب نداده باشد (مثلاً صفحهٔ تازه
 * باز شده). صفحه‌ای که آن کارت را ندارد بی‌صدا نادیده می‌گیرد. دادهٔ سنگینی
 * هم جابه‌جا نمی‌شود: فقط یک شناسه.
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.HUB_PORT) || 8090;
const SECRET = process.env.HUB_SECRET || '';

/* «نفس»ِ اتصال: هر ۲۵ ثانیه پینگ می‌رود و هر کلاینتی که تا ۷۵ ثانیه خبری
   از خودش نداده باشد قطع می‌شود. پروکسی‌ها اتصالِ بی‌صدا را بعد از یک دقیقه
   می‌بندند، پس این پینگ باید کمتر از آن باشد. */
const PING_MS = 25000;
const CLIENT_TIMEOUT_MS = 75000;

/** حداکثر بدنهٔ `/publish` — بیشتر از این یعنی درخواستِ ناخواسته است. */
const MAX_BODY = 2048;

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const startedAt = Date.now();

/** کلاینت‌های پنل: سوکت + تاریخِ فعالِ همان صفحه + کارت‌های تحتِ نظر. */
const clients = new Set();

const log = (...parts) => console.log(new Date().toISOString(), '[hub]', ...parts);

/* ------------------------------------------------------------------ قاب‌ها */

function acceptKey(key) {
  return createHash('sha1').update(key + GUID).digest('base64');
}

/** یک قابِ متنیِ بدون ماسک (سرور به کلاینت همیشه بدون ماسک می‌فرستد). */
function textFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;

  let head;

  if (length < 126) {
    head = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81;
    head[1] = 126;
    head.writeUInt16BE(length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([head, payload]);
}

/** قابِ pong (پاسخ به pingِ سطحِ پروتکل). */
function pongFrame(payload) {
  const body = payload && payload.length ? payload : Buffer.alloc(0);

  return Buffer.concat([Buffer.from([0x8a, body.length]), body]);
}

/**
 * قاب‌های کاملِ داخلِ یک تکهٔ TCP را جدا می‌کند.
 *
 * TCP مرزِ پیام ندارد؛ ممکن است نصفِ یک قاب برسد یا سه قاب با هم. این تابع
 * هرچه کامل بود برمی‌گرداند و باقی‌مانده را برای نوبتِ بعد می‌دهد.
 */
function readFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (true) {
    if (buffer.length - offset < 2) break;

    const first = buffer[offset];
    const second = buffer[offset + 1];

    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (buffer.length - cursor < 2) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (buffer.length - cursor < 8) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let mask = null;

    if (masked) {
      if (buffer.length - cursor < 4) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (buffer.length - cursor < length) break;

    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));

    if (mask) {
      for (let index = 0; index < payload.length; index++) {
        payload[index] ^= mask[index % 4];
      }
    }

    frames.push({ fin, opcode, payload });
    offset = cursor + length;
  }

  return { frames, rest: buffer.subarray(offset) };
}

/* --------------------------------------------------------------- کلاینت‌ها */

function send(client, text) {
  try {
    client.socket.write(textFrame(text));
    return true;
  } catch (error) {
    dropClient(client, 'write failed');
    return false;
  }
}

function dropClient(client, reason) {
  if (!clients.has(client)) return;

  clients.delete(client);

  try {
    client.socket.destroy();
  } catch (error) {
    /* سوکتِ مرده؛ کاری نیست */
  }

  log('client left:', clients.size, 'left —', reason || 'closed');
  broadcastPeers();
}

/**
 * «چند پنل وصل است» را به همهٔ پنل‌های باز می‌گوید.
 *
 * چرا این پیام هست: چیپِ وضعیتِ نوار بالای پنل باید «زنده» و تعداد سوکت‌های
 * باز را نشان بدهد. اگر تعداد را با درخواستِ دوره‌ای از سرور می‌گرفتیم،
 * برای نمایشِ یک عدد کوچک دوباره همان کاری را می‌کردیم که این کانال
 * حذفش کرد. هاب خودش می‌داند چند سوکت باز است، پس همان لحظه که کسی
 * می‌آید یا می‌رود خبر می‌دهد — بدون هیچ درخواستِ اضافه.
 */
function broadcastPeers() {
  const message = JSON.stringify({ type: 'peers', count: clients.size });

  for (const client of clients) send(client, message);
}

/** فهرستِ شناسه‌ها را از ورودیِ پنل می‌خواند («12,15» یا آرایهٔ JSON). */
function parseIds(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(',');

  return new Set(
    list
      .map((value) => String(value).trim())
      .filter((value) => /^\d+$/.test(value)),
  );
}

function handleClientMessage(client, raw) {
  let message = null;

  try {
    message = JSON.parse(raw);
  } catch (error) {
    return; // پیامِ ناخوانا: نادیده؛ کانال نباید با یک پیامِ خراب قطع شود.
  }

  if (!message || typeof message !== 'object') return;

  if (message.type === 'pong') {
    client.seenAt = Date.now();
    return;
  }

  if (message.type === 'ping') {
    client.seenAt = Date.now();
    send(client, JSON.stringify({ type: 'pong' }));
    return;
  }

  if (message.type === 'watch') {
    client.seenAt = Date.now();

    if (typeof message.dmy === 'string' && message.dmy) client.dmy = message.dmy;

    if (message.ids !== undefined) client.ids = parseIds(message.ids);
  }
}

function handleUpgrade(request, socket, head) {
  const url = new URL(request.url || '/', 'http://hub');
  const key = request.headers['sec-websocket-key'];
  const version = request.headers['sec-websocket-version'];

  if (url.pathname !== '/ws' || !key || version !== '13') {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n',
  );

  socket.setNoDelay(true);

  const client = {
    socket,
    dmy: url.searchParams.get('dmy') || '',
    ids: parseIds(url.searchParams.get('ids')),
    seenAt: Date.now(),
    buffer: Buffer.alloc(0),
    fragments: [],
  };

  clients.add(client);
  log('client joined:', client.dmy || '-', client.ids.size, 'cards —', clients.size, 'open');

  // `clients` همان لحظه هم در `ready` می‌آید تا چیپِ پنل بدونِ انتظار برای
  // پیامِ بعدی عدد درست را داشته باشد.
  send(client, JSON.stringify({ type: 'ready', watching: client.ids.size, clients: clients.size }));
  broadcastPeers();

  if (head && head.length) client.buffer = Buffer.concat([client.buffer, head]);

  socket.on('data', (chunk) => {
    client.seenAt = Date.now();
    client.buffer = Buffer.concat([client.buffer, chunk]);

    const { frames, rest } = readFrames(client.buffer);
    client.buffer = rest;

    for (const frame of frames) {
      /* ۰x۸ بستن، ۰x۹ پینگ، ۰xA پونگ؛ متن و ادامهٔ متن هم پشتیبانی می‌شوند. */
      if (frame.opcode === 0x8) {
        dropClient(client, 'client closed');
        return;
      }

      if (frame.opcode === 0x9) {
        try {
          socket.write(pongFrame(frame.payload));
        } catch (error) {
          dropClient(client, 'pong failed');
        }
        continue;
      }

      if (frame.opcode === 0xa) {
        client.seenAt = Date.now();
        continue;
      }

      if (frame.opcode === 0x1 || frame.opcode === 0x0) {
        client.fragments.push(frame.payload);

        if (!frame.fin) continue;

        const raw = Buffer.concat(client.fragments).toString('utf8');
        client.fragments = [];
        handleClientMessage(client, raw);
        continue;
      }

      if (frame.opcode === 0x2) {
        dropClient(client, 'binary not supported');
        return;
      }
    }
  });

  socket.on('error', () => dropClient(client, 'socket error'));
  socket.on('close', () => dropClient(client, 'socket closed'));
}

/* ---------------------------------------------------------------- انتشار */

/**
 * تغییر را به پنل‌هایی می‌رساند که همان کارت را زیر نظر دارند.
 *
 * چرا تاریخ ملاک نیست: پنل «تاریخ فعال سامانه» را در نشستِ خودش نگه می‌دارد و
 * ثبتِ گوشی روی روزِ واقعی می‌نشیند؛ اگر ملاکِ تطبیق تاریخ باشد، پنلی که مدیر
 * روی ماهِ قبل گذاشته هیچ خبری نمی‌گیرد. تاریخ در پیام می‌آید تا خودِ پنل
 * تصمیم بگیرد، ولی برای رساندنِ «عوض شد» کافی است همان کارت را بشناسیم.
 *
 * گران نیست: هر ثبت حداکثر یک درخواستِ کوچک برای یک کارت است، نه یک درخواست
 * در هر ثانیه برای تمام صفحه.
 */
function broadcast(change) {
  const message = JSON.stringify({
    type: 'change',
    dmy: change.dmy,
    id: change.id,
    revision: change.revision,
  });

  let delivered = 0;

  for (const client of clients) {
    if (!client.ids.has(String(change.id))) continue;

    if (send(client, message)) delivered++;
  }

  return delivered;
}

/**
 * «کارتِ فلانی را بزرگ نشان بده» (`qr-focus`) یا «جمعش کن» (`qr-blur`) — بدونِ
 * شرطِ تحتِ نظر داشتنِ آن کارت.
 *
 * چه زمانی می‌آید: کارمند در اپ روی «اسکن QR کارتِ من» می‌زند و کارتِ QR را
 * باید روی صفحهٔ دفتر پیدا کند. اپ از راهِ سرور همین را می‌گوید و هاب به همهٔ
 * پنل‌های باز خبر می‌دهد؛ هر پنلی که آن کارت را دارد کارتش را روشن و بزرگ
 * می‌کند. مثل `change` فقط یک شناسه می‌رود، پس این مسیر هم هیچ دادهٔ خصوصی
 * جابه‌جا نمی‌کند.
 */
function broadcastFocus(type, id) {
  const message = JSON.stringify({ type, id });

  let delivered = 0;

  for (const client of clients) {
    if (send(client, message)) delivered++;
  }

  return delivered;
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY) {
        request.destroy();
        resolve(null);
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', () => resolve(null));
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://hub');

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        clients: clients.size,
        uptime: Math.round((Date.now() - startedAt) / 1000),
      }),
    );
    return;
  }

  if (url.pathname === '/publish' && request.method === 'POST') {
    if (!SECRET || request.headers['x-meraat-secret'] !== SECRET) {
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'forbidden' }));
      return;
    }

    const body = await readBody(request);
    let change = null;

    try {
      change = JSON.parse(body || '');
    } catch (error) {
      change = null;
    }

    const hasId = change && (typeof change.id === 'number' || /^\d+$/.test(String(change.id)));

    // `type` نیامده یعنی همان پیامِ قدیمیِ «عوض شد»؛ پس نسخهٔ قدیمیِ PHP با
    // هابِ تازه هم بی‌دردسر کار می‌کند.
    const type = !change || change.type === undefined ? 'change' : String(change.type);

    const valid =
      change &&
      hasId &&
      (type === 'qr-focus' ||
        type === 'qr-blur' ||
        (type === 'change' && typeof change.dmy === 'string'));

    if (!valid) {
      response.writeHead(422, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'bad_request' }));
      return;
    }

    const delivered =
      type === 'qr-focus' || type === 'qr-blur'
        ? broadcastFocus(type, Number(change.id))
        : broadcast({
            dmy: change.dmy,
            id: Number(change.id),
            revision: String(change.revision === undefined ? '' : change.revision),
          });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, delivered }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.on('upgrade', handleUpgrade);

/* نگهبانِ اتصال‌ها: پینگِ دوره‌ای و بستنِ کلاینتِ خفه. */
const heartbeat = setInterval(() => {
  const now = Date.now();

  for (const client of clients) {
    if (now - client.seenAt > CLIENT_TIMEOUT_MS) {
      dropClient(client, 'timed out');
      continue;
    }

    send(client, JSON.stringify({ type: 'ping' }));
  }
}, PING_MS);

heartbeat.unref();

server.listen(PORT, () => {
  log('listening on', PORT, SECRET ? '(publish protected)' : '(publish DISABLED: HUB_SECRET is empty)');
});

/* خاموشیِ تمیز: به کلاینت‌ها بگو و سوکت‌ها را ببند. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log('shutting down on', signal);
    clearInterval(heartbeat);

    for (const client of clients) {
      try {
        client.socket.write(Buffer.from([0x88, 0x00]));
        client.socket.end();
      } catch (error) {
        /* بی‌اهمیت */
      }
    }

    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
