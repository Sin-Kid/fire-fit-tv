import React from 'react';
import { Text, View } from 'react-native';
import type { CoachSession } from '../lib/coachApi';
import { colors, type as t } from '../lib/theme';
import { QrCode } from './QrCode';
import { tvStyles, u } from '../lib/scale';

/** "Voice commands" card: how to pair the voice remote page, plus live status. */
export function VoicePanel({ session, connected, webMic }: { session: CoachSession | null; connected: boolean; webMic: boolean }) {
  if (!session && !webMic) return null;
  const link = session?.voiceUrl.replace(/^https?:\/\//, '').replace(/\?code=\d+$/, '');
  return (
    <View style={styles.card}>
      {session && session.voiceUrl.startsWith('https:') ? (
        <View style={styles.qr}>
          <QrCode value={session.voiceUrl} size={u(150)} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.kicker}>VOICE COMMANDS</Text>
        <Text style={styles.title}>Say “skip”, “wait”, “more rest”, “easier”</Text>
        {session ? (
          <Text style={styles.body}>
            Open <Text style={styles.link}>{link}</Text> in Chrome on your laptop or phone and enter code <Text style={styles.code}>{session.code}</Text>
          </Text>
        ) : (
          <Text style={styles.body}>Press “Mic on” in the player and allow the microphone.</Text>
        )}
        {session ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connected ? colors.accent : colors.textDim }]} />
            <Text style={[styles.status, { color: connected ? colors.accent : colors.textDim }]}>{connected ? 'Voice remote connected' : 'Waiting for the voice remote…'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = tvStyles({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginTop: 28, maxWidth: 840 },
  qr: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 6, marginRight: 24 },
  text: { flex: 1 },
  kicker: { color: colors.textDim, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: t.body, fontWeight: '800', marginTop: 4 },
  body: { color: colors.textDim, fontSize: t.small, marginTop: 6, lineHeight: 30 },
  link: { color: colors.cooldown, fontWeight: '700' },
  code: { color: colors.text, fontWeight: '900', letterSpacing: 4, fontSize: t.body },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  status: { fontSize: t.small, fontWeight: '700' },
});
