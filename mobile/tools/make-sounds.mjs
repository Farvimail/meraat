/**
 * ساخت صدای ثبتِ ورود و خروج — بدون هیچ وابستگی.
 *
 * صدای اپ باید کوتاه، خوش‌لحن و بی‌طرف باشد: فقط تأیید می‌کند که ثبت انجام شد.
 * دو نُتِ کوتاه کافی است، ولی جهتشان برعکس هم است تا بدون نگاه‌کردن بشود فهمید
 * کدام ثبت شد: ورود بالا می‌رود، خروج پایین می‌آید.
 *
 * چرا چند سبک ساخته می‌شود: سینوسِ خالصِ ساده («بوق») زنگِ ارزان و کمی خشنی
 * می‌دهد. اینجا هر صدا از چند هم‌ساز ساخته می‌شود (همان کاری که زنگ و ماریمبا
 * می‌کنند)، با پوشِ نرم و یک فیلتر پایین‌گذر، و حجمش نرمال می‌شود. سبک‌ها
 * می‌مانند تا بشود انتخاب کرد:
 *
 *   chime    — زنگی گرم و کم‌درخشش (پیش‌فرض)
 *   bell     — زنگی روشن‌تر با هم‌سازهای ناساده، کشیده
 *   marimba  — کوبشی و کوتاه، شبیه ماریمبا
 *   soft     — خیلی نرم و کم‌حجم، مناسب محیط ساکت
 *
 * سبکِ فعال در `src/lib/feedback.ts` با یک ثابت انتخاب می‌شود.
 *
 * اجرا:
 *   node tools/make-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../assets/sounds');

const RATE = 44100;

/** یک WAV مونو ۱۶ بیتی از نمونه‌های `-1..1`. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);

  samples.forEach((value, index) => {
    const clamped = Math.max(-1, Math.min(1, value));
    data.writeInt16LE(Math.round(clamped * 32767), index * 2);
  });

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // اندازهٔ بلوک fmt
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // مونو
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // بایت بر ثانیه
  header.writeUInt16LE(2, 32); // بایت بر فریم
  header.writeUInt16LE(16, 34); // بیت بر نمونه
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

/**
 * یک نُت با چند هم‌ساز.
 *
 * `partials` جفت‌های [ضریبِ بسامد، دامنه] هستند. ضرایبِ ناساده (۲٫۰۱ و ۲٫۹۸ و
 * ۴٫۱۶) عمدی‌اند: هم‌سازهای کاملاً مضاعف صدای «سینت» می‌دهند، ولی کمی ناهماهنگی
 * همان چیزی است که به گوش، زنگ و چوب می‌آورد.
 */
function note(frequency, seconds, { partials, decay, gain, attack = 0.004 }) {
  const total = Math.floor(RATE * seconds);
  const samples = new Float64Array(total);

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    // هر چه این عدد بزرگ‌تر باشد، شروعِ نُت نرم‌تر است؛ ۴ میلی‌ثانیه یعنی
    // «ضربه» و ۱۲ میلی‌ثانیه یعنی «نوازش». سبکِ پیش‌فرض عمداً نرم‌تر است.
    const rise = Math.min(1, i / (RATE * attack));
    let value = 0;

    for (const [multiple, amplitude] of partials) {
      // هم‌سازهای بالاتر زودتر محو می‌شوند؛ همان رفتار سازهای واقعی.
      const extraDecay = 1 + (multiple - 1) * 0.55;
      value += amplitude * Math.sin(2 * Math.PI * frequency * multiple * t) * Math.exp(-t * decay * extraDecay);
    }

    samples[i] = value * gain * rise;
  }

  return samples;
}

/** فیلتر پایین‌گذرِ یک‌قطبی؛ لبه‌های تیز و «سوت» را می‌گیرد. */
function lowpass(samples, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = (1 / RATE) / (rc + 1 / RATE);
  let previous = 0;

  return samples.map((sample) => {
    previous += alpha * (sample - previous);
    return previous;
  });
}

function concat(parts) {
  return parts.flatMap((part) => Array.from(part));
}

function silence(seconds) {
  return new Float64Array(Math.floor(RATE * seconds));
}

/**
 * پایانی: نرمال‌سازی، پوشِ ابتدا/انتها و جلوگیری از کلیکِ پایانی.
 *
 * بدون این پوش، بلندگوی کوچکِ گوشی یک «تق»ِ ناخوشایند در ابتدا و انتها پخش
 * می‌کند؛ این بیشترین چیزی است که «بی‌کیفیت» به نظر می‌رسد.
 *
 * `level` سقفِ بلندیِ نهایی است. صداهای تیزتر با همان ۰٫۷۲ آزاردهنده‌تر
 * شنیده می‌شوند، پس سبک‌ها می‌توانند بلندیِ خودشان را کمی پایین‌تر بگذارند.
 */
function finish(samples, level = 0.72) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));

  const scale = peak > 0 ? level / peak : 1;
  const total = samples.length;
  const fade = Math.floor(RATE * 0.006);

  return samples.map((sample, index) => {
    let value = sample * scale;

    if (index < fade) value *= index / fade;
    if (index > total - fade) value *= (total - index) / fade;

    return value;
  });
}

/**
 * سبک‌ها، هر کدام با یک زوج بسامد برای ورود و خروج.
 *
 * ترتیب مهم است: `chime` پیش‌فرضِ اپ است و بقیه فقط جایگزین‌های انتخابی‌اند.
 */
const STYLES = {
  /**
   * پیش‌فرضِ اپ: زنگی گرم و کم‌درخشش.
   *
   * «bell» همسازهای ناسادهٔ ۲٫۹۸ و ۴٫۱۶ داشت و دقیقاً همین‌ها در حساس‌ترین
   * بازهٔ گوش (۲ تا ۴ کیلوهرتز) می‌افتند؛ روی بلندگوی کوچکِ گوشی صدای تیز و
   * کمی آزاردهنده‌ای می‌داد. این سبک برعکس است: فقط همسازهای ۱ و ۲ با دامنهٔ
   * کم، حملهٔ سه برابر نرم‌تر، فیلتر پایین‌گذر در ۳۲۰۰ هرتز، نت‌ها یک اکتاو
   * پایین‌تر (لا۴ ← می۵ = فاصلهٔ پنجمِ درست) و بلندیِ کمی کمتر. حاصل صدایی
   * گرم و «شیک» است که تأیید می‌کند بدون آنکه تو ذوق بزند.
   */
  chime: {
    partials: [[1, 1], [2.003, 0.16], [3.001, 0.03]],
    decay: 8,
    gain: 0.5,
    attack: 0.012,
    cutoff: 3200,
    level: 0.62,
    length: 0.38,
    gap: 0.05,
    notes: { in: [440, 659.25], out: [659.25, 440] },
  },
  bell: {
    partials: [[1, 1], [2.01, 0.42], [2.98, 0.2], [4.16, 0.09]],
    decay: 7.6,
    gain: 0.5,
    cutoff: 7200,
    // کوتاه نگه داشته می‌شود: صدای تأییدِ رابط باید سریع تمام شود، وگرنه
    // ثبت‌های پشت‌سرهم روی هم می‌افتند و به هم می‌ریزند.
    length: 0.4,
    gap: 0.055,
    notes: { in: [659, 988], out: [988, 659] },
  },
  marimba: {
    partials: [[1, 1], [3.9, 0.32], [9.2, 0.1]],
    decay: 13,
    gain: 0.55,
    cutoff: 6500,
    length: 0.34,
    gap: 0.05,
    notes: { in: [523, 784], out: [784, 523] },
  },
  soft: {
    partials: [[1, 1], [2.7, 0.18]],
    decay: 22,
    gain: 0.45,
    cutoff: 2600,
    length: 0.22,
    gap: 0.04,
    notes: { in: [587, 880], out: [880, 587] },
  },
};

mkdirSync(OUT_DIR, { recursive: true });

const written = [];

for (const [name, style] of Object.entries(STYLES)) {
  for (const intent of ['in', 'out']) {
    const [first, second] = style.notes[intent];

    const rendered = finish(
      lowpass(
        concat([
          note(first, style.length, style),
          silence(style.gap),
          note(second, style.length * 1.15, { ...style, gain: style.gain * 0.95 }),
        ]),
        style.cutoff,
      ),
      style.level,
    );

    const file = resolve(OUT_DIR, `punch-${intent === 'in' ? 'in' : 'out'}-${name}.wav`);
    writeFileSync(file, wav(rendered));
    written.push({ file: `punch-${intent}-${name}.wav`, seconds: (rendered.length / RATE).toFixed(2) });
  }
}

console.log(`[sounds] ${written.length} فایل در ${OUT_DIR}`);
for (const item of written) console.log(`   ${item.file}  ~${item.seconds}s`);
