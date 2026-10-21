import React from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { CoachPanel } from '../components/CoachPanel';
import { IntensityBar } from '../components/IntensityBar';
import type { CoachSession } from '../lib/coachApi';
import { FORM_CAMERA_ENABLED, HOSTED_WEB_DEMO, VOICE_REMOTE_ENABLED } from '../lib/config';
import { useFormCoach } from '../lib/useFormCoach';
import { parseScreenCommand } from '../lib/voiceCommands';
import { webMicAvailable } from '../lib/useWebMic';
import { VoicePanel } from '../components/VoicePanel';
import { colors, formatClock, phaseColor, phaseLabel, type as t } from '../lib/theme';
import { workoutKcal } from '../lib/calories';
import type { Profile, Workout } from '../lib/types';
import { tvStyles, u } from '../lib/scale';

interface Props {
  workout: Workout;
  profile: Profile;
  offline: boolean;
  coach: CoachSession | null;
  onStart: () => void;
  onRegenerate: () => void;
  onBack: () => void;
}

const LIST_H = 1080 - 2 * 54 - 2 * 24 - 44; // canvas minus safe area, panel padding and legend

export function PreviewScreen({ workout, profile, offline, coach, onStart, onRegenerate, onBack }: Props) {
  // Phone mic works here too: "start", "new version", "back".
  const coachState = useFormCoach(coach?.code, undefined, (heard) => {
    const cmd = parseScreenCommand(heard);
    if (cmd === 'start') onStart();
    else if (cmd === 'newVersion') onRegenerate();
    else if (cmd === 'back' || cmd === 'newWorkout') onBack();
  });
  const n = workout.exercises.length;
  const cols = n <= 18 ? 1 : n <= 38 ? 2 : 3;
  const perCol = Math.ceil(n / cols);
  const rowH = Math.min(52, Math.floor(LIST_H / perCol));
  const nameSize = Math.max(18, Math.min(26, Math.round(rowH * 0.5)));
  const indexed = workout.exercises.map((e, i) => ({ e, i }));
  const columns = Array.from({ length: cols }, (_, c) => indexed.slice(c * perCol, (c + 1) * perCol));
  const counts = {
    warmup: workout.exercises.filter((e) => e.phase === 'warmup').length,
    main: workout.exercises.filter((e) => e.phase === 'main').length,
    cooldown: workout.exercises.filter((e) => e.phase === 'cooldown').length,
  };

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <View style={[styles.badge, { borderColor: workout.source === 'bedrock' ? colors.accent : colors.border }]}>
          <Text style={[styles.badgeText, { color: workout.source === 'bedrock' ? colors.accent : colors.textDim }]}>
            {workout.source === 'bedrock' ? `AI-generated · Amazon Bedrock` : HOSTED_WEB_DEMO ? 'Browser demo · built on this device' : offline ? 'Offline workout' : 'Standard workout'}
          </Text>
        </View>
        <Text style={styles.title}>{workout.title}</Text>
        <Text style={styles.intro}>{workout.coachIntro}</Text>

        <View style={styles.stats}>
          <Stat value={formatClock(workout.totalSec)} label="total" />
          <Stat value={String(workout.exercises.length)} label="moves" />
          <Stat value={`≈${Math.round(workoutKcal(profile, workout.exercises))}`} label="kcal (est.)" />
          <Stat value={`${counts.warmup}/${counts.main}/${counts.cooldown}`} label="warm/main/cool" />
        </View>

        <View style={styles.buttons}>
          <FocusButton primary size="lg" label="Start" onPress={onStart} autoFocus />
          <FocusButton label="New version" onPress={onRegenerate} />
          <FocusButton label="Back" onPress={onBack} />
        </View>

        {FORM_CAMERA_ENABLED ? (
          <CoachPanel session={coach} phoneConnected={!!coachState?.phoneConnected} camera={!!coachState?.camera && !!coachState?.phoneConnected} voice={!!coachState?.voiceConnected} />
        ) : null}
        {VOICE_REMOTE_ENABLED && (!FORM_CAMERA_ENABLED || HOSTED_WEB_DEMO) ? <VoicePanel session={coach} connected={!!coachState?.voiceConnected} webMic={webMicAvailable()} /> : null}
      </View>

      <View style={styles.right}>
        <View style={styles.legend}>
          {(['warmup', 'main', 'cooldown'] as const).map((ph) => (
            <View key={ph} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: phaseColor(ph) }]} />
              <Text style={styles.legendText}>{phaseLabel[ph]}</Text>
            </View>
          ))}
        </View>
        {/* The remote can't scroll a list, so every move must fit: more moves → more, denser columns. */}
        <View style={styles.columns}>
          {columns.map((col, c) => (
            <View key={c} style={[styles.column, c > 0 && styles.columnGap]}>
              {col.map(({ e, i }) => (
                <View key={`${e.name}-${i}`} style={[styles.row, { height: u(rowH) }]}>
                  <View style={[styles.stripe, { backgroundColor: phaseColor(e.phase), height: u(rowH * 0.55) }]} />
                  <Text style={[styles.rowName, { fontSize: u(nameSize) }]} numberOfLines={1}>
                    {e.name}
                  </Text>
                  {cols === 1 ? <IntensityBar level={e.intensity} color={phaseColor(e.phase)} /> : null}
                  {cols < 3 ? (
                    <Text style={[styles.rowTime, { fontSize: u(nameSize - 4) }]}>
                      {e.durationSec}s{e.restSec ? ` +${e.restSec}` : ''}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg, flexDirection: 'row', paddingHorizontal: 96, paddingVertical: 54 },
  left: { flex: 1.05, paddingRight: 48, justifyContent: 'center' },
  right: { flex: 1, backgroundColor: colors.surface, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 24 },
  badge: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 20 },
  badgeText: { fontSize: t.small, fontWeight: '700' },
  title: { color: colors.text, fontSize: t.h1 + 8, fontWeight: '900', letterSpacing: -1 },
  intro: { color: colors.textDim, fontSize: t.body + 2, marginTop: 16, lineHeight: 42 },
  stats: { flexDirection: 'row', marginTop: 28, marginBottom: 28 },
  stat: { marginRight: 48 },
  statValue: { color: colors.text, fontSize: t.h2, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textDim, fontSize: t.small },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  legend: { flexDirection: 'row', height: 44, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 28 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  legendText: { color: colors.textDim, fontSize: 18, fontWeight: '800', letterSpacing: 1.5 },
  columns: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  columnGap: { marginLeft: 24 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  stripe: { width: 6, borderRadius: 3, marginRight: 14 },
  rowName: { flex: 1, color: colors.text, fontWeight: '700' },
  rowTime: { color: colors.textDim, width: 100, textAlign: 'right' },
});
