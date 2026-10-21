import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { fetchRecap } from '../lib/api';
import { formNotes, getCoachState } from '../lib/coachApi';
import { say } from '../lib/speech';
import { useFormCoach } from '../lib/useFormCoach';
import { parseScreenCommand } from '../lib/voiceCommands';
import { colors, formatClock, type as t } from '../lib/theme';
import type { Workout } from '../lib/types';
import type { SessionStats } from './PlayerScreen';
import { tvStyles } from '../lib/scale';

interface Props {
  workout: Workout;
  stats: SessionStats;
  goal?: string;
  coachCode?: string | null;
  onAgain: () => void;
  onNew: () => void;
}

export function SummaryScreen({ workout, stats, goal, coachCode = null, onAgain, onNew }: Props) {
  const [recap, setRecap] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof formNotes>>([]);
  // Phone mic: "again" / "do it again", "new workout".
  useFormCoach(coachCode, undefined, (heard) => {
    const cmd = parseScreenCommand(heard);
    if (cmd === 'again') onAgain();
    else if (cmd === 'newWorkout' || cmd === 'newVersion' || cmd === 'back') onNew();
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      // Pull what the phone camera saw (if it was used) so the coach can comment on form.
      const notes = coachCode ? formNotes((await getCoachState(coachCode).catch(() => null))?.stats) : [];
      if (!alive) return;
      setForm(notes);
      const text = await fetchRecap({ title: workout.title, goal, ...stats, form: notes });
      if (!alive) return;
      setRecap(text);
      say(text);
    })();
    return () => {
      alive = false;
    };
  }, [workout, stats, goal, coachCode]);

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>WORKOUT COMPLETE</Text>
      <Text style={styles.title}>{workout.title}</Text>

      <View style={styles.stats}>
        <Big value={`${stats.completed}/${stats.total}`} label="moves done" />
        <Big value={String(stats.kcal)} label="kcal burned (est.)" accent />
        <Big value={formatClock(stats.activeSec)} label="active time" />
        <Big value={String(stats.easierUsed)} label="scaled down" />
        <Big value={String(stats.skipped)} label="skipped" />
      </View>

      {form.length ? (
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>FORM CAMERA</Text>
          {form.slice(0, 4).map((f) => (
            <View key={f.exercise} style={styles.formChip}>
              <Text style={styles.formName}>{f.exercise}</Text>
              <Text style={[styles.formScore, { color: f.goodReps / f.reps >= 0.8 ? colors.accent : colors.warmup }]}>
                {f.goodReps}/{f.reps} good
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.coach}>
        <Text style={styles.coachLabel}>COACH SAYS</Text>
        <Text style={styles.coachText}>{recap ?? 'Thinking about how that went…'}</Text>
      </View>

      <View style={styles.buttons}>
        <FocusButton primary size="lg" label="New workout" onPress={onNew} autoFocus />
        <FocusButton size="lg" label="Do it again" onPress={onAgain} />
      </View>
    </View>
  );
}

function Big({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent && { color: colors.warmup }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 96, paddingVertical: 54, justifyContent: 'center' },
  kicker: { color: colors.accent, fontSize: t.body, fontWeight: '900', letterSpacing: 4 },
  title: { color: colors.text, fontSize: t.h1 + 8, fontWeight: '900', marginTop: 8 },
  stats: { flexDirection: 'row', marginTop: 48 },
  statBox: { backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 28, paddingHorizontal: 36, marginRight: 20, minWidth: 240 },
  statValue: { color: colors.text, fontSize: t.h1 + 8, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textDim, fontSize: t.small, marginTop: 4 },
  coach: { marginTop: 48, borderLeftWidth: 6, borderLeftColor: colors.accent, paddingLeft: 28, maxWidth: 1400 },
  coachLabel: { color: colors.textDim, fontSize: t.small, fontWeight: '800', letterSpacing: 2 },
  coachText: { color: colors.text, fontSize: t.h2 - 4, lineHeight: 52, marginTop: 8 },
  buttons: { flexDirection: 'row', marginTop: 56 },
  formRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 32 },
  formLabel: { color: colors.textDim, fontSize: t.small, fontWeight: '800', letterSpacing: 2, marginRight: 20 },
  formChip: { backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, marginRight: 14 },
  formName: { color: colors.text, fontSize: t.small, fontWeight: '700' },
  formScore: { fontSize: t.small, fontWeight: '800', marginTop: 2 },
});
