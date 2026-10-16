import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GLOW_MAX, glowShares, pushGlows } from '../glow.ts';
import type { Point } from '../glow.ts';

const SIZE = { width: 360, height: 180 };

/** دو لکه، مثل خودِ سرصفحه: یکی بالا-راست و یکی پایین-چپ. */
const CENTERS: Point[] = [
  { x: 0.88, y: 0 },
  { x: 0.12, y: 1 },
];

test('نزدیک‌ترین لکه همیشه سهم کامل می‌گیرد', () => {
  const shares = glowShares({ x: 316, y: 0 }, SIZE, CENTERS);

  assert.equal(shares.length, 2);
  assert.equal(shares[0], 1);
  assert.ok(shares[1] < 0.3, `لکهٔ دور باید سهم کم بگیرد، گرفت ${shares[1]}`);
});

test('در وسط کادر هر دو لکه یک‌اندازه سهم می‌گیرند', () => {
  const shares = glowShares({ x: 180, y: 90 }, SIZE, CENTERS);

  assert.ok(Math.abs(shares[0] - shares[1]) < 0.06);
  assert.ok(Math.abs(shares[0] - 1) < 0.06);
});

test('کشیدن انگشت به راست، لکه‌ها را به چپ می‌برد', () => {
  const push = pushGlows({ x: 200, y: 90 }, { x: 140, y: 90 }, SIZE, CENTERS);

  for (const value of push) {
    assert.ok(value.x < 0, 'جهت باید مخالف کشیدن باشد');
  }
  // لکهٔ نزدیک‌تر بیشتر جابه‌جا می‌شود.
  assert.ok(Math.abs(push[0].x) > Math.abs(push[1].x));
});

test('کشیدن انگشت به پایین، جابه‌جایی رو به بالا می‌دهد', () => {
  const push = pushGlows({ x: 300, y: 160 }, { x: 300, y: 60 }, SIZE, CENTERS);

  assert.ok(push[0].y < 0);
  assert.ok(push[1].y < 0);
});

test('جابه‌جایی از سقف بیرون نمی‌زند', () => {
  const push = pushGlows({ x: 359, y: 179 }, { x: 0, y: 0 }, SIZE, CENTERS);

  for (const value of push) {
    assert.ok(Math.abs(value.x) <= GLOW_MAX);
    assert.ok(Math.abs(value.y) <= GLOW_MAX);
  }
  assert.equal(push[0].x, -GLOW_MAX);
});

test('انگشتِ بی‌حرکت لکه‌ها را تکان نمی‌دهد', () => {
  const push = pushGlows({ x: 180, y: 90 }, { x: 180, y: 90 }, SIZE, CENTERS);

  assert.deepEqual(push, [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
});

test('کادرِ اندازه‌ندیده خطا نمی‌دهد', () => {
  const shares = glowShares({ x: 10, y: 10 }, { width: 0, height: 0 }, CENTERS);

  assert.equal(shares.length, 2);
  assert.ok(shares.every((value) => Number.isFinite(value)));
  assert.deepEqual(glowShares({ x: 0, y: 0 }, SIZE, []), []);
});
