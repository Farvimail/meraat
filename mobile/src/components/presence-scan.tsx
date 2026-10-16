/*
 * شیتِ اسکنِ QR تأییدِ حضور.
 *
 * چرا مودالِ تمام‌صفحه و نه یک دکمه: کارِ این صفحه «گرفتنِ دوربین به سمتِ
 * کارتِ خودت در پنل» است؛ هر چیزی جز دوربینِ بزرگ، فقط حواس را پرت می‌کند.
 *
 * چهار قرارِ این کامپوننت:
 *   ۱) هر کد فقط **یک بار** به سرور می‌رود. دوربین ده‌ها فریم در ثانیه
 *      می‌خواند؛ بدونِ این قید، یک اسکن یعنی ده‌ها درخواستِ هم‌زمان.
 *   ۲) اگر درخواست رد شد، قفل باز می‌شود تا کارمند دوباره امتحان کند (کدِ
 *      عوض‌شده، دستِ کج، نور کم).
 *   ۳) کدِ نامربوط **پیش از** درخواست رد می‌شود (اسکنِ کارتِ همکار) — پیامِ
 *      روشن، بدونِ رفت‌وبرگشتِ بی‌فایده به سرور.
 *   ۴) اجازهٔ دوربین تنها چیزی است که به کاربر توضیح داده می‌شود؛ بقیهٔ
 *      پیام‌ها از سرور می‌آیند.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { localCodeProblem } from '../lib/presence';
import { colors, radius, spacing } from '../theme';

export function PresenceScanSheet({
  visible,
  busy,
  employeeId,
  note,
  onCode,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  /** شناسهٔ کارمندِ وارد‌شده — برای رد کردنِ QR همکار پیش از درخواست. */
  employeeId: number | null;
  /** پیامِ نتیجه/خطای آخرین تلاش. */
  note?: string | null;
  /** کدِ خوانده‌شده و سالم؛ برگرداندنِ `false` یعنی قفل باز بماند. */
  onCode: (code: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [sent, setSent] = useState<string | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);

  // هر بار که شیت باز می‌شود، وضعیتِ اسکنِ قبلی پاک شود؛ وگرنه بعد از یک
  // تلاشِ ناموفق، باز کردنِ دوباره هیچ کدی نمی‌پذیرد.
  useEffect(() => {
    if (visible) {
      setSent(null);
      setLocalNote(null);
    }
  }, [visible]);

  const handleScan = (value: string) => {
    if (sent !== null) return;

    const problem = employeeId === null ? null : localCodeProblem(value, employeeId);

    if (problem !== null) {
      setLocalNote(problem);
      return;
    }

    setLocalNote(null);
    setSent(value);

    void onCode(value).then((ok) => {
      if (!ok) {
        // درخواست رد شد: اجازه بده دوباره اسکن کند.
        setSent(null);
      }
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.sheet}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleScan(data)}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permissionTitle}>اجازهٔ دوربین لازم است</Text>
            <Text style={styles.permissionText}>
              برای خواندنِ QR روی کارتِ خودت در پنل، اپ به دوربین نیاز دارد. تصویری ذخیره
              نمی‌شود؛ فقط کد خوانده می‌شود.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void requestPermission()}
              style={styles.primary}
            >
              <Text style={styles.primaryLabel}>اجازه دادن</Text>
            </Pressable>
          </View>
        )}

        {/* قابِ راهنما: بدونِ آن، کاربر نمی‌داند کد را کجای صفحه بگیرد. */}
        <View pointerEvents="none" style={styles.frame} />

        <View style={styles.footer}>
          <Text style={styles.hint}>QR روی کارتِ خودت در پنل را داخلِ قاب بگیر.</Text>

          {localNote || note ? <Text style={styles.note}>{localNote ?? note}</Text> : null}
          {busy ? <Text style={styles.busy}>در حال ثبتِ تأیید…</Text> : null}
        </View>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <Text style={styles.closeLabel}>بستن</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#0b1a12',
  },
  camera: {
    flex: 1,
  },
  frame: {
    position: 'absolute',
    top: '28%',
    left: '12%',
    right: '12%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,.85)',
    borderRadius: radius.lg,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(11,26,18,.86)',
  },
  hint: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  note: {
    marginTop: spacing.sm,
    color: '#ffd9d2',
    textAlign: 'center',
    fontSize: 13,
  },
  busy: {
    marginTop: spacing.sm,
    color: colors.onDark,
    textAlign: 'center',
    fontSize: 13,
  },
  close: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  closeLabel: {
    color: '#fff',
    fontSize: 13,
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  permissionText: {
    color: 'rgba(255,255,255,.8)',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 22,
  },
  primary: {
    marginTop: spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 14,
  },
});
