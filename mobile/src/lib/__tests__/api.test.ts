import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiError, createApiClient } from '../api.ts';
import type { ApiErrorCode } from '../api.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failingFetch(code: ApiErrorCode) {
  // assert.rejects فقط وقتی قبول می‌کند که اعتبارسنج **همگام** مقدار true
  // برگرداند؛ تابع async یک Promise می‌دهد و خطا محسوب می‌شود.
  return (error: unknown): boolean => {
    // `assert.ok` تایپ را برای تایپ‌اسکریپت باریک نمی‌کند، پس صریح بررسی می‌کنیم.
    if (!(error instanceof ApiError)) {
      throw new Error(`باید ApiError باشد، ولی ${String(error)} آمد`);
    }

    assert.equal(error.code, code);
    return true;
  };
}

test('login به آدرس درست و با بدنهٔ JSON می‌رود', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1/',
    fetchImpl: (async (input: unknown, init: RequestInit) => {
      seenUrl = String(input);
      seenInit = init;
      return jsonResponse({ token: 'tok' });
    }) as unknown as typeof fetch,
  });

  const result = await client.login({
    email: 'a@b.c',
    password: 'p',
    device_id: 'd1',
    device_name: 'phone',
    platform: 'android',
  });

  // اسلش انتهایی baseUrl نباید در آدرس تکرار شود.
  assert.equal(seenUrl, 'https://example.test/api/v1/login');
  assert.equal(seenInit?.method, 'POST');
  assert.deepEqual(JSON.parse(String(seenInit?.body)), {
    email: 'a@b.c',
    password: 'p',
    device_id: 'd1',
    device_name: 'phone',
    platform: 'android',
  });
  assert.deepEqual(result, { token: 'tok' });
});

test('توکن روی درخواست‌های بعدی می‌نشیند', async () => {
  let headers: Record<string, string> = {};

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    getToken: () => 'tok',
    fetchImpl: (async (_input: unknown, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return jsonResponse({ dmy: 1, punches: [], server_time: { iso: '', dmy: 1, clock: '00:00:00' } });
    }) as unknown as typeof fetch,
  });

  await client.today();

  assert.equal(headers.Authorization, 'Bearer tok');
  assert.equal(headers.Accept, 'application/json');
});

test('بدون توکن، هدر Authorization فرستاده نمی‌شود', async () => {
  let headers: Record<string, string> = {};

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async (_input: unknown, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return jsonResponse({ dmy: 1, punches: [], server_time: { iso: '', dmy: 1, clock: '00:00:00' } });
    }) as unknown as typeof fetch,
  });

  await client.today();

  assert.equal(headers.Authorization, undefined);
});

test('کدهای خطای سرور به کدهای داخلی اپ ترجمه می‌شوند', async () => {
  const cases: Array<[number, string, ApiErrorCode]> = [
    [401, 'invalid_credentials', 'invalid_credentials'],
    [409, 'device_already_bound', 'device_already_bound'],
    [403, 'device_mismatch', 'device_mismatch'],
    [403, 'outside_office_network', 'outside_office_network'],
    [409, 'duplicate_punch', 'duplicate_punch'],
    [422, 'biometric_required', 'biometric_required'],
    [422, 'gps_required', 'gps_required'],
    [500, 'server_error', 'server'],
    [418, 'teapot', 'bad_response'],
  ];

  for (const [status, serverError, expected] of cases) {
    const client = createApiClient({
      baseUrl: 'https://example.test/api/v1',
      fetchImpl: (async () => jsonResponse({ error: serverError, message: 'پيام' }, status)) as unknown as typeof fetch,
    });

    await assert.rejects(
      () =>
        client.punch({
          device_id: 'd1',
          intent: 'start',
          biometric_verified_at: 1,
          biometric_kind: 'fingerprint',
        }),
      failingFetch(expected),
      `status ${status} / ${serverError}`,
    );
  }
});

test('۴۰۱ بدون فیلد error هم unauthorized می‌شود', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async () => jsonResponse({ message: 'Unauthenticated.' }, 401)) as unknown as typeof fetch,
  });

  await assert.rejects(() => client.today(), failingFetch('unauthorized'));
});

test('قطع ارتباط → network', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch,
  });

  await assert.rejects(() => client.today(), failingFetch('network'));
});

test('سرور بی‌پاسخ → timeout', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    timeoutMs: 10,
    fetchImpl: ((_input: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as unknown as typeof fetch,
  });

  await assert.rejects(() => client.today(), failingFetch('timeout'));
});

test('پاسخ ۲۰۰ ولی غیر JSON → bad_response', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async () => new Response('<html>oops</html>', { status: 200 })) as unknown as typeof fetch,
  });

  await assert.rejects(() => client.today(), failingFetch('bad_response'));
});

test('۲۰۴ بدون بدنه برای logout خطا نیست', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
  });

  assert.equal(await client.logout(), undefined);
});

test('آپلودِ عکس با multipart می‌رود و Content-Type دستی نمی‌گذارد', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    getToken: () => 'tok',
    fetchImpl: (async (input: unknown, init: RequestInit) => {
      seenUrl = String(input);
      seenInit = init;
      return jsonResponse({ avatar: 'u1-1.jpg', employee: { id: 1 } });
    }) as unknown as typeof fetch,
  });

  const result = await client.uploadPhoto({
    uri: 'file:///tmp/IMG_1.jpg',
    name: 'IMG_1.jpg',
    type: 'image/jpeg',
  });

  assert.equal(seenUrl, 'https://example.test/api/v1/profile/photo');
  assert.equal(seenInit?.method, 'POST');
  assert.ok(seenInit?.body instanceof FormData, 'بدنه باید FormData باشد');

  const headers = seenInit?.headers as Record<string, string>;
  assert.equal(
    headers['Content-Type'],
    undefined,
    'اگر Content-Type دستی بنشیند، boundary ساخته نمی‌شود و سرور فایل را نمی‌فهمد',
  );
  assert.equal(headers.Authorization, 'Bearer tok');
  assert.equal(result.avatar, 'u1-1.jpg');
});

test('حذفِ عکس با متدِ DELETE می‌رود', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    getToken: () => 'tok',
    fetchImpl: (async (input: unknown, init: RequestInit) => {
      seenUrl = String(input);
      seenInit = init;
      return jsonResponse({ avatar: null, employee: { id: 1 } });
    }) as unknown as typeof fetch,
  });

  const result = await client.deletePhoto();

  assert.equal(seenUrl, 'https://example.test/api/v1/profile/photo');
  assert.equal(seenInit?.method, 'DELETE');
  assert.equal(result.avatar, null, 'بعد از حذف، سرور عکسی نمی‌دهد');
});

test('خطای عکس، کدِ خودش را می‌گیرد و پیامِ سرور می‌ماند', async () => {
  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    getToken: () => 'tok',
    fetchImpl: (async () =>
      jsonResponse(
        { error: 'photo_too_large', message: 'حجم عکس بیش از حد مجاز است.' },
        413,
      )) as unknown as typeof fetch,
  });

  await assert.rejects(
    () =>
      client.uploadPhoto({ uri: 'file:///tmp/big.jpg', name: 'big.jpg', type: 'image/jpeg' }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'photo_too_large');
      assert.equal(
        error.message,
        'حجم عکس بیش از حد مجاز است.',
        'پیامِ دقیقِ سرور نباید با ترجمهٔ عمومی جایگزین شود',
      );
      return true;
    },
  );
});

test('history شمارهٔ صفحه را در query می‌گذارد', async () => {
  let seenUrl = '';

  const client = createApiClient({
    baseUrl: 'https://example.test/api/v1',
    fetchImpl: (async (input: unknown) => {
      seenUrl = String(input);
      return jsonResponse({ days: [], server_time: { iso: '', dmy: 1, clock: '00:00:00' } });
    }) as unknown as typeof fetch,
  });

  await client.history(3);

  assert.equal(seenUrl, 'https://example.test/api/v1/history?page=3');
});
