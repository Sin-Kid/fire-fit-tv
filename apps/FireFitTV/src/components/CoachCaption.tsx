import React from 'react';
import { Text, View } from 'react-native';
import type { CueKind } from '../lib/coachApi';
import { colors } from '../lib/theme';
import { tvStyles } from '../lib/scale';

const KIND_COLOR: Record<CueKind, string> = { good: colors.accent, fix: colors.warmup, info: colors.cooldown };
const KIND_LABEL: Record<CueKind, string> = { good: 'NICE', fix: 'FORM TIP', info: 'CAMERA' };

/** Live caption of the latest spoken form cue. */
export function CoachCaption({ text, kind, label }: { text: string | null; kind: CueKind; label?: string }) {
  if (!text) return <View style={styles.spacer} />;
  return (
    <View style={[styles.bar, { borderLeftColor: KIND_COLOR[kind] }]} accessibilityLiveRegion="polite">
      <Text style={[styles.label, { color: KIND_COLOR[kind] }]}>{label ?? KIND_LABEL[kind]}</Text>
      <Text style={styles.text} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = tvStyles({
  spacer: { height: 84, marginBottom: 20 },
  bar: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', minHeight: 84, marginBottom: 20,
    backgroundColor: 'rgba(21,27,35,0.92)', borderRadius: 16, borderLeftWidth: 10, paddingHorizontal: 28, paddingVertical: 14, maxWidth: 1500,
  },
  label: { fontSize: 20, fontWeight: '900', letterSpacing: 3, marginRight: 22 },
  text: { color: colors.text, fontSize: 38, fontWeight: '700', flexShrink: 1 },
});
