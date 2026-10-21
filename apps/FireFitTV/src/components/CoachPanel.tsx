import React from 'react';
import { Text, View } from 'react-native';
import { colors, type as t } from '../lib/theme';
import { QrCode } from './QrCode';
import { tvStyles, u } from '../lib/scale';

interface Props {
  session: { code: string; url: string } | null;
  phoneConnected: boolean;
  camera: boolean;
  /** The phone (or a laptop) is listening for voice commands. */
  voice?: boolean;
}

/** "Use your phone as a form camera" card with QR code, code and live status. */
export function CoachPanel({ session, phoneConnected, camera, voice = false }: Props) {
  if (!session) return null;
  const base = camera ? 'Camera on. Form coaching is live.' : phoneConnected ? 'Phone connected. Tap Start camera + mic on it.' : voice ? 'Voice remote connected.' : 'Waiting for your phone…';
  const status = voice && (camera || phoneConnected) ? `${base} Mic on.` : base;
  const statusColor = camera || voice ? colors.accent : phoneConnected ? colors.warmup : colors.textDim;
  return (
    <View style={styles.card}>
      <View style={styles.qr}>
        <QrCode value={session.url} size={u(170)} />
      </View>
      <View style={styles.text}>
        <Text style={styles.kicker}>PHONE COMPANION · CAMERA + VOICE</Text>
        <Text style={styles.title}>Scan with your phone</Text>
        <Text style={styles.body}>
          It checks your form and hears “start”, “skip”, “wait”, “rest”. Or open the link and enter code <Text style={styles.code}>{session.code}</Text>
        </Text>
        <Text style={styles.url} numberOfLines={1}>{session.url.replace(/^https?:\/\//, '')}</Text>
        {!/^https:|^http:\/\/localhost/.test(session.url) ? (
          <Text style={styles.warn}>Phones need https for the camera and mic: start the backend with “npm run phone”. Or use this computer at localhost:8787/coach.</Text>
        ) : null}
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.status, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = tvStyles({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginTop: 28, maxWidth: 820 },
  qr: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 6, marginRight: 24 },
  text: { flex: 1 },
  kicker: { color: colors.textDim, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: t.body + 2, fontWeight: '800', marginTop: 4 },
  body: { color: colors.textDim, fontSize: t.small, marginTop: 6, lineHeight: 30 },
  code: { color: colors.text, fontWeight: '900', letterSpacing: 4, fontSize: t.body },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  url: { color: colors.cooldown, fontSize: 18, marginTop: 6 },
  warn: { color: colors.warmup, fontSize: 17, marginTop: 6, lineHeight: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  status: { fontSize: t.small, fontWeight: '700' },
});
