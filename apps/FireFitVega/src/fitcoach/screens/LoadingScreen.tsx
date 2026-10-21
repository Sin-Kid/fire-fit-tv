import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { colors, type as t } from '../lib/theme';
import type { WorkoutRequest } from '../lib/types';
import { tvStyles } from '../lib/scale';

const LINES = [
  'Reading your goal…',
  'Picking moves for your equipment…',
  'Balancing work and rest…',
  'Writing form cues…',
  'Almost ready…',
];

export function LoadingScreen({ request }: { request: WorkoutRequest }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, LINES.length - 1)), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.pulse} />
      <Text style={styles.title}>Your coach is building the workout</Text>
      <Text style={styles.line}>{LINES[i]}</Text>
      <Text style={styles.meta}>
        {request.minutes} min · {request.goal.replace('-', ' ')} · {request.level}
        {request.notes ? ` · ${request.notes.split(':')[0]}` : ''}
      </Text>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  pulse: { width: 120, height: 120, borderRadius: 60, borderWidth: 10, borderColor: colors.accent, marginBottom: 48 },
  title: { color: colors.text, fontSize: t.h1, fontWeight: '800' },
  line: { color: colors.accent, fontSize: t.h2, marginTop: 20 },
  meta: { color: colors.textDim, fontSize: t.body, marginTop: 32, textTransform: 'capitalize' },
});
