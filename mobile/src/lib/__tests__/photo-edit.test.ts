import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampPan,
  cropRect,
  displaySize,
  normalizeAngle,
  panLimit,
  safeSide,
  tiltFactor,
} from '../photo-edit.ts';
import type { Size, CropRect } from '../photo-edit.ts';

/** پیش‌بینیِ اندازهٔ بومِ چرخیده — همان قراردادی که پلتفرم‌ها می‌سازند. */
function predictRotated(size: Size, angle: number): Size {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  return {
    width: Math.ceil(size.width * cos + size.height * sin),
    height: Math.ceil(size.width * sin + size.height * cos),
  };
}

test('normalizeAngle زاویه را در بازهٔ نیم‌دایره نگه می‌دارد', () => {
  assert.equal(normalizeAngle(0), 0);
  assert.equal(normalizeAngle(45), 45);
  assert.equal(normalizeAngle(90), 90);
  assert.equal(normalizeAngle(370), 10);
  assert.equal(normalizeAngle(-190), 170);
  assert.equal(normalizeAngle(450), 90);
  assert.equal(normalizeAngle(180), -180, '۱۸۰ و −۱۸۰ یکی‌اند؛ نماینده همیشه یکی است');
  assert.equal(normalizeAngle(-180), -180);
  assert.equal(normalizeAngle(Number.NaN), 0, 'عددِ خراب نباید زاویه را خراب کند');
});

test('tiltFactor و safeSide: صاف و ۹۰ درجه هیچ برشِ اضافه‌ای نمی‌خورند', () => {
  assert.equal(tiltFactor(0), 1);
  assert.equal(tiltFactor(90), 1);
  assert.equal(tiltFactor(-90), 1);
  assert.ok(Math.abs(tiltFactor(45) - Math.SQRT2) < 1e-9);

  const portrait: Size = { width: 3000, height: 4000 };

  assert.equal(safeSide(portrait, 0), 3000, 'عکسِ صاف تا کوچک‌ترین ضلع بریده می‌شود');
  assert.equal(safeSide(portrait, 90), 3000, 'چرخشِ ۹۰ فقط عرض و ارتفاع را جابه‌جا می‌کند');

  const at45 = safeSide(portrait, 45);
  assert.ok(Math.abs(at45 - 3000 / Math.SQRT2) < 1e-9, 'در ۴۵ درجه گوشه‌های خالی از برش بیرون می‌مانند');

  // مربعِ صاف: همان عکس، هیچ اتلافی.
  assert.equal(safeSide({ width: 1000, height: 1000 }, 0), 1000);
});

test('panLimit: در zoom=۱ جا نیست و با بزرگ‌نمایی خطی باز می‌شود', () => {
  assert.equal(ZOOM_MIN, 1);
  assert.equal(ZOOM_MAX, 3);

  assert.equal(panLimit(1, 320), 0);
  assert.equal(panLimit(2, 320), 160);
  assert.equal(panLimit(3, 320), 320);
  assert.equal(panLimit(2, 0), 0, 'قابِ صفر یعنی چیزی برای جابه‌جایی نیست');
});

test('clampPan از حد بیرون نمی‌رود و داخلِ حد دست نمی‌خورد', () => {
  const frame = 320;

  assert.deepEqual(clampPan({ x: 40, y: -40 }, 2, frame), { x: 40, y: -40 });
  assert.deepEqual(clampPan({ x: 99999, y: -99999 }, 2, frame), { x: 160, y: -160 });
  assert.deepEqual(clampPan({ x: Number.NaN, y: 5 }, 2, frame), { x: 0, y: 5 });
  assert.deepEqual(clampPan({ x: 999, y: 0 }, 1, frame), { x: 0, y: 0 });
});

test('displaySize عکس را طوری بزرگ می‌کند که برش دقیقاً اندازهٔ قاب شود', () => {
  const frame = 320;

  // عکسِ صافِ ۳۰۰۰×۴۰۰۰ با zoom=۱: برش ۳۰۰۰ است، پس k = ۳۲۰/۳۰۰۰.
  assert.deepEqual(displaySize({ width: 3000, height: 4000 }, 0, 1, frame), {
    width: 320,
    height: 427, // ceil(320 · 4000/3000)
  });

  // با بزرگ‌نماییِ ۲ نصفِ برش، یعنی دو برابر بزرگ‌تر.
  assert.deepEqual(displaySize({ width: 3000, height: 4000 }, 0, 2, frame), {
    width: 640,
    height: 854,
  });

  // در ۴۵ درجه ضلعِ برش کوچک‌تر می‌شود (بخش ۱) پس نمایش بزرگ‌تر:
  const shown = displaySize({ width: 1000, height: 1000 }, 45, 1, 320);
  assert.equal(shown.width, shown.height, 'مربع باید مربع بماند');
  assert.ok(shown.width >= 453, 'k = 320·√2/1000 → ضلع ۱۰۰۰ → حداقل ۴۵۳ پیکسل');
});

test('cropRect روی عکسِ صاف دقیقاً وسط‌چین و مربع است', () => {
  const source: Size = { width: 3000, height: 4000 };
  const frame = 320;

  assert.deepEqual(cropRect(source, source, 0, 1, { x: 0, y: 0 }, frame), {
    originX: 0,
    originY: 500,
    width: 3000,
    height: 3000,
  });

  assert.deepEqual(cropRect(source, { width: 4000, height: 3000 }, 90, 1, { x: 0, y: 0 }, frame), {
    originX: 500,
    originY: 0,
    width: 3000,
    height: 3000,
  });

  assert.deepEqual(cropRect(source, source, 0, 2, { x: 0, y: 0 }, frame), {
    originX: 750,
    originY: 1250,
    width: 1500,
    height: 1500,
  });
});

test('cropRect پانِ بیرون از حد را به لبهٔ مربعِ امن می‌چسباند', () => {
  const source: Size = { width: 3000, height: 4000 };
  const frame = 320;

  // zoom=۲ → برش ۱۵۰۰، مربعِ امن ۳۰۰۰، پس جابه‌جایی تا ۷۵۰ مجاز است؛
  // پانِ ۹۹۹۹ باید به همان حد بچسبد: مبدأ x به ۰ و y به ۲۰۰۰.
  const rect = cropRect(source, source, 0, 2, { x: 99999, y: -99999 }, frame);

  assert.deepEqual(rect, { originX: 0, originY: 2000, width: 1500, height: 1500 });
});

test('cropRect در همهٔ زاویه‌ها داخلِ بوم می‌ماند و مربع است', () => {
  const angles = [0, 15, 30, 45, 67, 90, 123, -40, -90, 179];
  const zooms = [ZOOM_MIN, 1.3, 2, ZOOM_MAX];
  const sources: Size[] = [
    { width: 3000, height: 4000 },
    { width: 1000, height: 1000 },
    { width: 400, height: 300 },
    { width: 1080, height: 2400 },
  ];
  const pans = [
    { x: 0, y: 0 },
    { x: 100, y: -50 },
    { x: -10000, y: 10000 },
  ];

  for (const source of sources) {
    for (const angle of angles) {
      const rotated = predictRotated(source, angle);

      for (const zoom of zooms) {
        for (const pan of pans) {
          const rect = cropRect(source, rotated, angle, zoom, pan, 320);

          assert.equal(rect.width, rect.height, 'برش باید مربع بماند');
          assert.ok(rect.width >= 1, 'برش نباید خالی شود');
          assert.ok(rect.originX >= 0 && rect.originY >= 0, 'مبدأ نباید منفی شود');
          assert.ok(
            rect.originX + rect.width <= rotated.width,
            `بُعد x باید داخلِ بوم بماند (${JSON.stringify({ source, angle, zoom, rect, rotated })})`,
          );
          assert.ok(
            rect.originY + rect.height <= rotated.height,
            `بُعد y باید داخلِ بوم بماند (${JSON.stringify({ source, angle, zoom, rect, rotated })})`,
          );

          const safe = safeSide(source, angle);
          assert.ok(
            rect.width <= safe + 1,
            'برش نباید از مربعِ امن بزرگ‌تر شود — وگرنه گوشهٔ خالی می‌افتد',
          );
        }
      }
    }
  }
});

test('گوشه‌های برش بعد از برگرداندنِ چرخش داخلِ عکسِ اصلی‌اند', () => {
  const cases: Array<{ source: Size; angle: number; zoom: number }> = [
    { source: { width: 1000, height: 1000 }, angle: 45, zoom: 1 },
    { source: { width: 3000, height: 4000 }, angle: 30, zoom: 1 },
    { source: { width: 3000, height: 4000 }, angle: -60, zoom: 1.7 },
    { source: { width: 1080, height: 2400 }, angle: 12, zoom: 2.4 },
  ];

  for (const { source, angle, zoom } of cases) {
    const rotated = predictRotated(source, angle);
    const rect: CropRect = cropRect(source, rotated, angle, zoom, { x: 0, y: 0 }, 320);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners: Array<[number, number]> = [
      [rect.originX, rect.originY],
      [rect.originX + rect.width, rect.originY],
      [rect.originX, rect.originY + rect.height],
      [rect.originX + rect.width, rect.originY + rect.height],
    ];

    for (const [x, y] of corners) {
      // مرکز بوم = مرکز عکس (بوم بسته‌بندی‌شده دورِ خودِ عکس است)؛ برگرداندنِ
      // چرخش باید گوشه را داخلِ W×H بنشاند.
      const dx = x - rotated.width / 2;
      const dy = y - rotated.height / 2;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;

      assert.ok(
        Math.abs(u) <= source.width / 2 + 1e-6,
        `گوشه (${x},${y}) در θ=${angle} باید داخلِ عکس باشد، u=${u}`,
      );
      assert.ok(
        Math.abs(v) <= source.height / 2 + 1e-6,
        `گوشه (${x},${y}) در θ=${angle} باید داخلِ عکس باشد، v=${v}`,
      );
    }
  }
});
