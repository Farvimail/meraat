import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError, createApiClient } from './lib/api';
import type { ApiClient } from './lib/api';
import { getBiometricStatus, verifyBiometric } from './lib/biometrics';
import type { BiometricStatus } from './lib/biometrics';
import { API_BASE_URL, API_ORIGIN, REQUEST_TIMEOUT_MS, STORAGE_KEYS } from './lib/config';
import { reachableFromError } from './lib/connection';
import type { ConnectionState } from './lib/connection';
import { getDeviceIdentity } from './lib/device';
import { NO_PRESENCE, presenceOf } from './lib/presence';
import type { PresenceState } from './lib/presence';
import { notifyPunchRecorded, punchFailureHaptic, punchPressHaptic } from './lib/feedback';
import { BIOMETRIC_MESSAGES, messageForError } from './lib/messages';
import { parseClock } from './lib/jalali';
import { hubSocketUrl, watchTimer } from './lib/realtime';
import {
  checkPhoto,
  photoFileName,
  photoMimeType,
  photoRejectionMessage,
} from './lib/profile-photo';
import type { PickedPhoto } from './lib/profile-photo';
import { deriveToday, PUNCH_LABEL } from './lib/punch';
import type { TodayState } from './lib/punch';
import type { Employee, PunchRow, TodayPayload } from './lib/types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  employee: Employee | null;
  /** کلاینت HTTP با توکنِ همین نشست؛ صفحهٔ سابقه مستقیم از آن استفاده می‌کند. */
  api: ApiClient;
  today: TodayState;
  /** آخرین ساعتی که سرور فرستاد، به شکل `H:i:s` (ناحیهٔ زمانی تهران). */
  serverClock: string | null;
  /**
   * همان ساعت، ولی زنده و هر ثانیه جلو‌رونده. لنگر همان پاسخ سرور است و فقط
   * گذشت زمانِ گوشی به آن اضافه می‌شود، پس ساعتِ اشتباه گوشی آن را خراب نمی‌کند.
   */
  liveClock: string;
  /** آمادگی اثر انگشتِ همین گوشی؛ تا وقتی خوانده نشده `null`. */
  biometric: BiometricStatus | null;
  /**
   * «به سرور می‌رسیم یا نه» — از نتیجهٔ آخرین درخواست‌ها به‌روز می‌شود.
   *
   * صفحهٔ ورود روی همین حالت کارتِ «اتصال به سرور برقرار نیست» را نشان می‌دهد
   * و تا وقتی `offline` است اجازهٔ فرستادنِ فرم نمی‌دهد؛ ولی تلاش خودکار در
   * خودِ صفحه اجرا می‌شود (`CONNECTION_RETRY_MS`).
   */
  connection: ConnectionState;
  error: string | null;
  busy: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  punch(): Promise<void>;
  /** در حال فرستادن یا حذفِ عکس پروفایل؛ تا تمام شدن، دکمه‌ها باید قفل باشند. */
  photoBusy: boolean;
  /**
   * پیشرفتِ آپلودِ عکس، صفر تا یک — عدد فقط حینِ آپلود است و بقیهٔ
   * وقت‌ها `null` (حذفِ عکس پیشرفت ندارد). کارتِ پروفایل همین را به
   * نوارِ درصد تبدیل می‌کند تا کاربر ببیند عکس دارد می‌رود یا گیر کرده.
   */
  photoProgress: number | null;
  /**
   * فرستادنِ عکس انتخاب‌شده. `false` یعنی نشد و پیامِ خطا در `error` نشسته
   * است. عکس بعد از پذیرشِ سرور، هم در اپ عوض می‌شود و هم در پنل وب — چون
   * سرور همان جدولی را به‌روز می‌کند که پنل می‌خواند.
   */
  setPhoto(photo: PickedPhoto, onProgress?: (fraction: number) => void): Promise<boolean>;
  /** حذفِ عکس؛ بعدش اپ و پنل هر دو عکسِ پیش‌فرض را نشان می‌دهند. */
  removePhoto(): Promise<boolean>;
  /** وضعیتِ تأییدِ حضورِ امروز با QR — مرجع آن سرور است. */
  presence: PresenceState;
  /** در حال فرستادنِ کدِ اسکن‌شده به سرور. */
  presenceBusy: boolean;
  /**
   * تأییدِ حضور با کدِ خوانده‌شده از کارتِ کارمند در پنل. `false` یعنی نشد و
   * `error` پیام را دارد.
   */
  confirmPresence(code: string): Promise<boolean>;
  /** یک تستِ سبکِ اتصال؛ `true` یعنی سرور جواب داد (حتی با ۴۰۱). */
  checkConnection(): Promise<boolean>;
  clearError(): void;
}

const SessionContext = createContext<SessionValue | null>(null);

async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  try {
    if (token === null) await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
    else await SecureStore.setItemAsync(STORAGE_KEYS.token, token);
  } catch {
    // ذخیره‌نشدن توکن نباید جلوی کار کردن این نشست را بگیرد.
  }
}

function secondsOfDay(clock: string | null): number {
  if (!clock) return 0;

  const parsed = parseClock(clock);
  return parsed ? parsed.h * 3600 + parsed.m * 60 + parsed.s : 0;
}

function toClockString(totalSeconds: number): string {
  const seconds = ((totalSeconds % 86400) + 86400) % 86400;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [rows, setRows] = useState<PunchRow[]>([]);
  const [dmy, setDmy] = useState<number | null>(null);
  const [serverClock, setServerClock] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const [liveClock, setLiveClock] = useState('');
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [presence, setPresence] = useState<PresenceState>(NO_PRESENCE);
  const [presenceBusy, setPresenceBusy] = useState(false);

  const tokenRef = useRef<string | null>(null);

  /**
   * ساعت سرور لنگر می‌شود، نه ساعت گوشی: زمانِ رسیدن پاسخ را نگه می‌داریم و
   * از آن به بعد فقط «گذشت زمان» را اضافه می‌کنیم. این‌طور ساعتِ اشتباه گوشی
   * یا ناحیهٔ زمانیِ دستگاه روی محاسبهٔ کارکرد اثر نمی‌گذارد.
   */
  const anchorRef = useRef<{ at: number; clockSeconds: number } | null>(null);

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        getToken: () => tokenRef.current,
        timeoutMs: REQUEST_TIMEOUT_MS,
      }),
    [],
  );

  const currentClock = useCallback((): string => {
    const anchor = anchorRef.current;
    if (!anchor) return '';

    const elapsed = Math.floor((Date.now() - anchor.at) / 1000);
    return toClockString(anchor.clockSeconds + elapsed);
  }, []);

  /** نتیجهٔ هر درخواست، وضعیت اتصال را تازه می‌کند. */
  const noteFailure = useCallback((failure: unknown) => {
    setConnection(reachableFromError(failure) ? 'online' : 'offline');
  }, []);

  const checkConnection = useCallback(async () => {
    // وقتی می‌دانیم قطع است، حالت را به «در حال بررسی» برنمی‌گردانیم تا کارتِ
    // قرمز در هر تلاشِ خودکار چشمک نزند؛ فقط وقتی جواب گرفتیم عوض می‌شود.
    setConnection((current) => (current === 'offline' ? current : 'checking'));

    try {
      // بدون توکن این درخواست ۴۰۱ می‌گیرد و همین کافی است: «سرور جواب داد».
      await client.me();
      setConnection('online');
      return true;
    } catch (failure) {
      const online = reachableFromError(failure);
      setConnection(online ? 'online' : 'offline');
      return online;
    }
  }, [client]);

  const applyToday = useCallback((payload: TodayPayload) => {
    setRows(payload.punches);
    setDmy(payload.dmy);
    setServerClock(payload.server_time.clock);
    // وضعیتِ تأییدِ حضور با هر پاسخِ تازه (ورود/ثبت/تازه‌سازی) از سرور خوانده
    // می‌شود؛ اپ از خودش حدس نمی‌زند که تأیید شده یا نه.
    setPresence(presenceOf(payload.qr));
    anchorRef.current = {
      at: Date.now(),
      clockSeconds: secondsOfDay(payload.server_time.clock),
    };
  }, []);

  /**
   * تیکِ یک‌ثانیه‌ای.
   *
   * سه چیز به آن وابسته‌اند: ساعتِ زندهٔ سرصفحه، تایمرِ کارکرد، و «کارکرد تا
   * این لحظه». یک ثانیه کوتاه‌ترین دقتی است که کاربر حس زنده‌بودن می‌گیرد و
   * هزینهٔ رندرِ یک درختِ کوچک در هر ثانیه روی این اپ ناچیز است.
   */
  useEffect(() => {
    if (status !== 'signedIn') {
      setLiveClock('');
      return;
    }

    const tick = () => setLiveClock(currentClock());
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status, currentClock]);

  /**
   * آمادگی اثر انگشت همین گوشی.
   *
   * قیدِ امنیتیِ اپ در لحظهٔ ثبت هم دوباره بررسی می‌شود، ولی نمایشِ آن پیش از
   * ضربه لازم است: اگر روی گوشی اثری ثبت نشده باشد، کاربر باید بداند که الان
   * نمی‌تواند ثبت کند، نه اینکه بعد از ضربه پیام خطا بگیرد.
   */
  useEffect(() => {
    if (status !== 'signedIn') {
      setBiometric(null);
      return;
    }

    let cancelled = false;

    void getBiometricStatus().then((value) => {
      if (!cancelled) setBiometric(value);
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await readToken();

      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }

      tokenRef.current = stored;

      try {
        const me = await client.me();
        const today = await client.today();

        if (cancelled) return;

        setEmployee(me.employee);
        applyToday(today);
        setConnection('online');
        setStatus('signedIn');
      } catch {
        // توکن منقضی یا دستگاه آزادشده: بی‌صدا به صفحهٔ ورود برگرد.
        if (cancelled) return;

        tokenRef.current = null;
        await writeToken(null);
        setStatus('signedOut');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, applyToday]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setBusy(true);
      setError(null);

      try {
        const device = await getDeviceIdentity();

        const response = await client.login({
          email: email.trim(),
          password,
          device_id: device.deviceId,
          // مدلِ واقعیِ گوشی (مثل `Pixel 8`) و اگر دستگاه گزارش نداد، همان
          // نامِ پیش‌فرض؛ سرور آن را در `tbl_mobile_device.device_name` می‌ریزد
          // تا مدیر بداند کدام کارمند روی کدام گوشی نشسته است.
          device_name: device.label,
          platform: device.platform,
        });

        tokenRef.current = response.token;
        await writeToken(response.token);

        setEmployee(response.employee);
        applyToday(response.today);
        setConnection('online');
        setStatus('signedIn');
      } catch (failure) {
        // اگر ورود به‌خاطرِ نبودِ اینترنت رد شد، صفحهٔ ورود باید حالتِ «قطع»
        // را نشان بدهد و خودش دوباره تلاش کند — نه اینکه کاربر فقط یک جملهٔ
        // خطا ببیند و دوباره دکمه را بزند.
        noteFailure(failure);
        setError(messageForError(failure));
      } finally {
        setBusy(false);
      }
    },
    [client, applyToday, noteFailure],
  );

  const signOut = useCallback(async () => {
    setBusy(true);

    try {
      await client.logout();
    } catch {
      // خروج محلی حتی اگر سرور جواب ندهد باید انجام شود.
    } finally {
      tokenRef.current = null;
      await writeToken(null);
      anchorRef.current = null;
      setEmployee(null);
      setRows([]);
      setDmy(null);
      setServerClock(null);
      setLiveClock('');
      setError(null);
      setStatus('signedOut');
      setBusy(false);
    }
  }, [client]);

  const refresh = useCallback(async () => {
    if (status !== 'signedIn') return;

    try {
      const today = await client.today();
      applyToday(today);
      setConnection('online');
    } catch (failure) {
      noteFailure(failure);
      setError(messageForError(failure));
    }
  }, [client, status, applyToday, noteFailure]);

  const employeeId = employee ? employee.id : null;

  /**
   * تایمرِ زنده — «شروع/توقف از داخلِ سایت، همان لحظه روی گوشی».
   *
   * تا پیش از این، اپ فقط با ورود، ضربهٔ خودِ کاربر و کشیدنِ دستیِ صفحه تازه
   * می‌شد؛ اگر مدیر از پنل شروع یا توقف می‌زد، روی گوشی تا تازه‌سازیِ بعدی
   * خبری نمی‌شد. اینجا همان کاری می‌شود که پنلِ وب می‌کند: سوکتِ هاب
   * (لحظه‌ای)، و اگر سوکت وصل نشد پرسشِ سبکِ «انگشتِ تغییر» و خواندنِ کاملِ
   * `today` فقط وقتی واقعاً چیزی عوض شده است.
   *
   * جای این افکند در نشست است و نه در صفحهٔ داشبورد: حالا که کاربر در صفحهٔ
   * سابقه یا کارتِ پروفایل است هم وضعیت زنده می‌ماند و به‌محضِ برگشتن، عدد
   * درست همان‌جا نشسته است.
   */
  useEffect(() => {
    if (status !== 'signedIn' || employeeId === null) {
      return;
    }

    return watchTimer({
      url: hubSocketUrl(API_ORIGIN, employeeId, dmy),
      customerId: employeeId,
      onChange: () => {
        void refresh();
      },
      readRevision: async () => (await client.revision()).revision,
    });
  }, [status, employeeId, dmy, client, refresh]);

  /**
   * برگشتن به اپ = تازه‌سازیِ فوری.
   *
   * گوشی در پس‌زمینه سوکت را می‌خواباند و تایمرها را کند می‌کند؛ اگر کاربر
   * قفل گوشی را باز کند باید عددِ همین لحظه را ببیند، نه عددِ چند دقیقه پیش.
   */
  useEffect(() => {
    if (status !== 'signedIn') {
      return;
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [status, refresh]);

  const setPhoto = useCallback(
    async (photo: PickedPhoto, onProgress?: (fraction: number) => void) => {
      // همان قواعدی که سرور دارد، اول روی گوشی بررسی می‌شود: پیامِ فوری و
      // بدونِ آپلودِ فایلی که آخرش رد می‌شود.
      const rejection = checkPhoto(photo);

      if (rejection !== null) {
        setError(photoRejectionMessage(rejection));
        return false;
      }

      setPhotoBusy(true);
      setError(null);
      setPhotoProgress(0);

      try {
        const response = await client.uploadPhoto(
          {
            uri: photo.uri,
            name: photoFileName(photo),
            type: photoMimeType(photo),
          },
          (fraction) => {
            setPhotoProgress(fraction);
            onProgress?.(fraction);
          },
        );

        // کارمندِ برگشتی از سرور مرجع است؛ اپ از خودش حدس نمی‌زند.
        setEmployee(response.employee);
        setConnection('online');
        return true;
      } catch (failure) {
        noteFailure(failure);
        setError(messageForError(failure));
        return false;
      } finally {
        setPhotoBusy(false);
        setPhotoProgress(null);
      }
    },
    [client, noteFailure],
  );

  const removePhoto = useCallback(async () => {
    setPhotoBusy(true);
    setError(null);

    try {
      const response = await client.deletePhoto();

      setEmployee(response.employee);
      setConnection('online');
      return true;
    } catch (failure) {
      noteFailure(failure);
      setError(messageForError(failure));
      return false;
    } finally {
      setPhotoBusy(false);
    }
  }, [client, noteFailure]);

  const confirmPresence = useCallback(
    async (code: string) => {
      setPresenceBusy(true);
      setError(null);

      try {
        const response = await client.confirmPresence(code);

        setPresence(presenceOf(response.qr));
        setEmployee(response.employee);
        setConnection('online');
        return true;
      } catch (failure) {
        noteFailure(failure);
        setError(messageForError(failure));
        return false;
      } finally {
        setPresenceBusy(false);
      }
    },
    [client, noteFailure],
  );

  const today = useMemo<TodayState>(
    () => deriveToday(rows, { dmy, now: currentClock() || null }),
    // currentClock عمداً در وابستگی‌ها نیست؛ با هر تغییر rows/dmy مقدار تازه می‌گیرد.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, dmy, serverClock],
  );

  const punch = useCallback(async () => {
    setError(null);
    setBusy(true);

    // لرزشِ فوریِ «دکمه را گرفتم»: تأییدِ اثر انگشت و رفت‌وبرگشتِ شبکه چند
    // ثانیه طول می‌کشد و بدون این، کاربر فکر می‌کند ضربه‌اش ثبت نشده است.
    punchPressHaptic();

    try {
      const intent = today.nextIntent;
      const outcome = await verifyBiometric(PUNCH_LABEL[intent]);

      if (!outcome.ok) {
        // انگشت تطبیق نخورد: لرزشِ کوتاه خبر می‌دهد ثبت انجام نشد، بدون اینکه
        // کاربر لازم باشد متن خطا را بخواند.
        punchFailureHaptic();
        setError(BIOMETRIC_MESSAGES[outcome.reason]);
        return;
      }

      const device = await getDeviceIdentity();

      const response = await client.punch({
        device_id: device.deviceId,
        intent,
        biometric_verified_at: outcome.at,
        biometric_kind: outcome.kind,
      });

      // سرور مرجع است: ممکن است کاری غیر از آنچه خواستیم ثبت کرده باشد.
      applyToday(response.today);

      // صدا و لرزش با کاری که **سرور** ثبت کرده هم‌خوان است، نه با خواستهٔ اپ.
      notifyPunchRecorded(response.action);
    } catch (failure) {
      punchFailureHaptic();

      // «قبلاً ثبت شده» یعنی حالت اپ از سرور عقب افتاده (مثلاً یک ضربهٔ دیگر
      // همان لحظه ثبت شده). اول وضعیت را از سرور تازه کن تا دکمه به کارِ درست
      // برگردد — وگرنه کاربر با همان برچسب قدیمی دوباره ضربه می‌زند و باز ۴۰۹
      // می‌گیرد.
      if (failure instanceof ApiError && failure.code === 'duplicate_punch') {
        try {
          applyToday(await client.today());
        } catch {
          // تازه‌سازی هم نشد؛ همان پیام خطا برای کاربر کافی است.
        }
      }

      noteFailure(failure);
      setError(messageForError(failure));
    } finally {
      setBusy(false);
    }
  }, [client, today.nextIntent, applyToday, noteFailure]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      employee,
      api: client,
      today,
      serverClock,
      liveClock,
      biometric,
      connection,
      error,
      busy,
      photoBusy,
      photoProgress,
      presence,
      presenceBusy,
      signIn,
      signOut,
      refresh,
      punch,
      setPhoto,
      removePhoto,
      confirmPresence,
      checkConnection,
      clearError: () => setError(null),
    }),
    [
      status,
      employee,
      client,
      today,
      serverClock,
      liveClock,
      biometric,
      connection,
      error,
      busy,
      photoBusy,
      photoProgress,
      presence,
      presenceBusy,
      signIn,
      signOut,
      refresh,
      punch,
      setPhoto,
      removePhoto,
      confirmPresence,
      checkConnection,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession بیرون از SessionProvider صدا زده شده است.');
  }

  return value;
}
