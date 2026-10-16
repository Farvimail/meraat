/**
 * سرور آزمایشی API حضور — بدون هیچ وابستگی.
 *
 * تا وقتی مسیرهای واقعی روی meraat پیاده نشده‌اند، این سرور اجازه می‌دهد اپ
 * را کامل امتحان کنید: ورود، ثبت، سابقه. همین‌طور یک پیاده‌سازی مرجع از
 * قاعده‌های `docs/API.md` است.
 *
 * اجرا:
 *   node tools/mock-api.mjs            # روی پورت 8099
 *   EXPO_PUBLIC_API_URL=http://localhost:8099/api/v1 npx expo start
 *
 * اثر انگشت روی وب وجود ندارد، پس دکمهٔ ثبت اینجا به پیام «این گوشی اثر انگشت
 * ندارد» می‌رسد؛ بقیهٔ جریان کامل کار می‌کند.
 */
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';

// `|| 8099` عمدی است: در بعضی شل‌ها PORT خالی تعریف شده و Number('') صفر
// می‌شود؛ آن‌وقت سرور روی یک پورت تصادفی گوش می‌دهد و پیداکردنش سخت است.
const PORT = Number(process.env.PORT) || 8099;

const pad = (value) => String(value).padStart(2, '0');

/**
 * ساعت دیوار به وقت تهران بدون وابستگی به ناحیهٔ زمانی سیستم.
 *
 * تهران از ۲۰۲۲ ساعت تابستانی ندارد، پس همیشه و فقط ۳:۳۰ جلوتر از UTC است:
 * کافیست همان اندازه به لحظهٔ مطلق اضافه شود و بعد اجزای UTC خوانده شوند.
 * قبلاً `date.getTimezoneOffset()` هم جمع می‌شد و روی ماشینی که خودش روی
 * Tehran بود، دو تصحیح یکدیگر را خنثی می‌کردند و ساعتِ mock به UTC برمی‌گشت
 * (سه‌ونیم ساعت عقب، با یک روز تاریخِ اشتباه).
 */
function tehran(date = new Date()) {
  const shifted = new Date(date.getTime() + 210 * 60000);

  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
  };
}

const clock = (date) => {
  const p = tehran(date);
  return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
};
const dmyOf = (date) => {
  const p = tehran(date);
  return Number(`${pad(p.d)}${pad(p.m)}${p.y}`);
};
const isoOf = (date) => {
  const p = tehran(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}+03:30`;
};

/** فاصلهٔ دو ساعت `H:i:s` به دقیقه — همان کاری که سرور می‌کند. */
function minutesOf(from, to) {
  if (!from || !to) return null;

  const seconds = (value) => {
    const [h, m, s] = value.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };

  return Math.max(0, Math.floor((seconds(to) - seconds(from)) / 60));
}

/** @type {{id:number,name:string,email:string,national_code:string,role:string,avatar:string|null}} */
const employee = {
  id: 12,
  name: 'حسین قربانی',
  email: 'ghorbani@example.com',
  national_code: '0079123456',
  role: 'کارشناس مالی',
  // نام فایل عکس پروفایل (docs/API.md)؛ خودِ سرور آزمایشی همین فایل را زیر
  // `/images/users/` سرو می‌کند تا مسیرِ کاملِ تصویر در اپ قابل‌آزمایش باشد.
  // PNG است نه SVG: `Image` در ری‌اکت‌نیتیو SVG را نمی‌کشد و حالت آزمایشی
  // به‌جای عکس، حروف اول را نشان می‌داد — یعنی مسیرِ واقعیِ عکس هرگز تست نمی‌شد.
  // با `MOCK_NO_AVATAR=1 node tools/mock-api.mjs` این فیلد `null` می‌شود تا
  // حالتِ «کارمند عکس ندارد» هم قابل‌آزمایش باشد: اپ باید به‌جای دایرهٔ حروفِ
  // اول، عکسِ پیش‌فرضِ سرور (`images/users/PRP.jpg`) را بخواهد.
  avatar: process.env.MOCK_NO_AVATAR ? null : 'mock.png',
};

/** رکوردهای امروز؛ با هر ثبت رشد می‌کند. */
const today = [];

/**
 * چند روز گذشته برای صفحهٔ سابقه.
 *
 * هر روز `punches` هم دارد — همان چیزی که اپ برای باز کردن جزئیات روز
 * می‌خواند. یکی از روزها عمداً نیمه‌کاره است (ورود بدون خروج) تا حالت «شیفت
 * باز» هم در تست دیده شود.
 */
const history = [1, 2, 3].map((back) => {
  const date = new Date(Date.now() - back * 86400000);
  const entry = back === 2 ? null : '08:0' + back + ':00';
  const exit = back === 2 ? null : '17:1' + back + ':00';

  return {
    dmy: dmyOf(date),
    entry,
    exit,
    // از همان تیک‌ها حساب می‌شود تا سابقه با جزئیاتِ باز‌شدهٔ روز یکی باشد.
    minutes: minutesOf(entry, exit),
    punches: [
      ...(entry ? [{ time: entry, start: 1, pause: 0 }] : []),
      ...(exit ? [{ time: exit, start: 0, pause: 1 }] : []),
    ],
  };
});

const state = {
  token: null,
  deviceId: null,
  punches: today,
  /** شمارندهٔ آپلودِ عکس؛ نامِ هر عکسِ تازه از همین ساخته می‌شود. */
  photos: 0,
};

function todayPayload() {
  const now = new Date();
  const punches = state.punches.map((row) => ({ ...row }));

  return {
    dmy: dmyOf(now),
    punches,
    server_time: { iso: isoOf(now), dmy: dmyOf(now), clock: clock(now) },
  };
}

/**
 * همان قاعدهٔ `SavedTimeController::noDuplicate()`: اگر آخرین رکورد یک ورود
 * باشد، ورود دوم ثبت نمی‌شود.
 */
function allowedAction() {
  const last = state.punches[state.punches.length - 1];
  if (!last) return 'start';
  return last.start === 1 ? 'pause' : 'start';
}

function send(response, status, body) {
  const payload = body === null ? '' : JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** جدول CRC32 برای ساختِ چانک‌های PNG (استاندارد PNG، بدون وابستگی). */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);

  return Buffer.concat([head, data, crc]);
}

/**
 * یک عکسِ پروفایلِ نمونهٔ ۱۴۴×۱۴۴ (سرمهٔ سبز + سیلوئت روشن) به شکل PNG.
 *
 * فقط برای اینکه مسیرِ «عکس پروفایل» در حالت آزمایشی واقعاً یک تصویرِ رستری
 * باشد؛ روی سرورِ واقعی این فایل را آپلودِ کاربر می‌سازد.
 */
function avatarPng(size = 144) {
  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  // پوششِ لبه: فاصله تا مرزِ شکل، برای نرم شدنِ خطِ دور.
  const cover = (distance, radius) => Math.min(1, Math.max(0, radius + 0.5 - distance));

  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // فیلترِ هیچ

    for (let x = 0; x < size; x++) {
      const at = (px, py) => Math.hypot(x - px, y - py);
      const body = cover(at(size / 2, size * 1.08), size * 0.37);
      const head = cover(at(size / 2, size * 0.4), size * 0.19);
      const skin = Math.max(head, body);

      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw[offset] = mix(15, 234, skin);
      raw[offset + 1] = mix(107, 243, skin);
      raw[offset + 2] = mix(63, 238, skin);
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // عمقِ بیت
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const AVATAR_PNG = avatarPng();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/api\/v1/, '');

  if (request.method === 'OPTIONS') return send(response, 204, null);

  // عکس پروفایل عمومی است — nginx هم بدون توکن سرو می‌کند و `<img>` هدر
  // Authorization نمی‌فرستد. همان مسیرِ `images/users/` سرور واقعی.
  if (request.method === 'GET' && url.pathname.startsWith('/images/users/')) {
    response.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': AVATAR_PNG.length,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    return response.end(AVATAR_PNG);
  }

  // این سرور آزمایشی است: هر توکن غیرخالی پذیرفته می‌شود تا بتوانید با curl
  // هم بدون گرفتن توکن اپ را دور بزنید. احراز هویت واقعی در docs/API.md است.
  const authorized = (request.headers.authorization ?? '').startsWith('Bearer ');

  if (path === '/login' && request.method === 'POST') {
    const body = await readBody(request);

    if (!body.email || !body.password) {
      return send(response, 401, { error: 'invalid_credentials', message: 'اطلاعات ناقص است.' });
    }

    state.token = `mock-${Date.now()}`;
    state.deviceId = body.device_id ?? null;

    console.log(`[mock] login ${body.email} device=${state.deviceId}`);

    return send(response, 200, {
      token: state.token,
      employee,
      device: { id: state.deviceId, bound_at: isoOf(new Date()) },
      today: todayPayload(),
    });
  }

  if (!authorized) {
    return send(response, 401, { error: 'unauthenticated', message: 'توکن نامعتبر است.' });
  }

  if (path === '/logout' && request.method === 'POST') {
    state.token = null;
    return send(response, 204, null);
  }

  if (path === '/me' && request.method === 'GET') {
    return send(response, 200, {
      employee,
      device: { id: state.deviceId, bound_at: isoOf(new Date()) },
      server_time: { iso: isoOf(new Date()), dmy: dmyOf(new Date()), clock: clock(new Date()) },
    });
  }

  if (path === '/today' && request.method === 'GET') {
    return send(response, 200, todayPayload());
  }

  if (path === '/history' && request.method === 'GET') {
    const days = [...history];
    if (state.punches.length > 0) {
      days.unshift({
        dmy: dmyOf(new Date()),
        entry: state.punches.find((row) => row.start === 1)?.time ?? null,
        exit: [...state.punches].reverse().find((row) => row.pause === 1)?.time ?? null,
        minutes: null,
        punches: state.punches.map((row) => ({ ...row })),
      });
    }

    return send(response, 200, {
      days,
      server_time: { iso: isoOf(new Date()), dmy: dmyOf(new Date()), clock: clock(new Date()) },
    });
  }

  /*
   * عکس پروفایل — همان دو مسیر واقعی (`docs/API.md`).
   *
   * بدنهٔ `multipart` اینجا واقعاً تفسیر نمی‌شود و هدف هم همان نیست: کارِ این
   * سرور آزمایشی سنجیدنِ سمتِ اپ است. پس هر آپلود پذیرفته می‌شود و یک نامِ
   * تازه برمی‌گردد تا اپ نشانِ «نشانیِ عکس و کارمندِ تازه‌شده از سرور
   * می‌آید» را ببیند؛ حذف هم همان کاری را می‌کند که سرور واقعی (`avatar`
   * را `null` می‌کند و اپ به عکسِ پیش‌فرض برمی‌گردد).
   */
  if (path === '/profile/photo' && request.method === 'POST') {
    // بدنه دور ریخته می‌شود؛ فقط باید خوانده شود تا سوکت بسته نشود.
    for await (const _chunk of request) {
      void _chunk;
    }

    state.photos += 1;
    employee.avatar = `uploaded-${state.photos}.png`;
    console.log(`[mock] photo uploaded → ${employee.avatar}`);

    return send(response, 200, { avatar: employee.avatar, employee });
  }

  if (path === '/profile/photo' && request.method === 'DELETE') {
    employee.avatar = null;
    console.log('[mock] photo removed');

    return send(response, 200, { avatar: null, employee });
  }

  if (path === '/punch' && request.method === 'POST') {
    const body = await readBody(request);
    const expected = allowedAction();

    if (body.intent !== expected) {
      return send(response, 409, {
        error: 'duplicate_punch',
        expected,
        message: 'این ثبت قبلاً انجام شده است.',
      });
    }

    const row = {
      time: clock(new Date()),
      start: expected === 'start' ? 1 : 0,
      pause: expected === 'pause' ? 1 : 0,
    };

    state.punches.push(row);
    console.log(`[mock] punch ${expected} at ${row.time}`);

    return send(response, 200, { action: expected, punch: row, today: todayPayload() });
  }

  return send(response, 404, { error: 'not_found', message: `مسیر ${path} وجود ندارد.` });
});

server.listen(PORT, () => {
  console.log(`[mock] meraat attendance API on http://localhost:${PORT}/api/v1`);
});
