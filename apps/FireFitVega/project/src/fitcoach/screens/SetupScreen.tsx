import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { colors, type as t } from '../lib/theme';
import type { Equipment, Goal, Level, Profile, WorkoutRequest } from '../lib/types';
import { tvStyles } from '../lib/scale';

const GOALS: { id: Goal; label: string; sub: string }[] = [
  { id: 'strength', label: 'Strength', sub: 'Build muscle' },
  { id: 'cardio', label: 'Cardio', sub: 'Get the heart up' },
  { id: 'fat-burn', label: 'Fat Burn', sub: 'Intervals' },
  { id: 'mobility', label: 'Mobility', sub: 'Stretch & move' },
];
const MINUTES = [10, 15, 20, 30, 45];
const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];
const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'none', label: 'No equipment' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'resistance-band', label: 'Band' },
  { id: 'yoga-mat', label: 'Yoga mat' },
];
// Typing on a TV remote is painful, so "notes" are one-press presets.
const NOTES = [
  { id: '', label: 'Nothing special' },
  { id: 'Knee friendly: no jumping or deep lunges', label: 'Knee friendly' },
  { id: 'Quiet, apartment friendly: no jumping', label: 'Quiet / no jumping' },
  { id: 'Go easy on my lower back', label: 'Lower back care' },
  { id: 'Small space, I can only take one step in each direction', label: 'Small space' },
];

export function SetupScreen({ onGenerate, initial, profile, onEditProfile }: { onGenerate: (r: WorkoutRequest) => void; initial?: WorkoutRequest; profile: Profile; onEditProfile: () => void }) {
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'cardio');
  const [minutes, setMinutes] = useState(initial?.minutes ?? 15);
  const [level, setLevel] = useState<Level>(initial?.level ?? 'beginner');
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? ['none']);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const toggleEquipment = (e: Equipment) => {
    if (e === 'none') return setEquipment(['none']);
    setEquipment((prev) => {
      const without = prev.filter((x) => x !== 'none' && x !== e);
      const next = prev.includes(e) ? without : [...without, e];
      return next.length ? next : ['none'];
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>FitCoach<Text style={{ color: colors.accent }}> TV</Text></Text>
        <Text style={styles.tagline}>Tell your coach what you want. AI builds the workout. You follow along.</Text>
      </View>

      <Section title="Goal">
        {GOALS.map((g, i) => (
          <FocusButton key={g.id} label={g.label} sublabel={g.sub} selected={goal === g.id} onPress={() => setGoal(g.id)} autoFocus={i === 0 && !initial} />
        ))}
      </Section>

      <Section title="Time">
        {MINUTES.map((m) => (
          <FocusButton key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </Section>

      <Section title="Level">
        {LEVELS.map((l) => (
          <FocusButton key={l.id} label={l.label} selected={level === l.id} onPress={() => setLevel(l.id)} />
        ))}
      </Section>

      <Section title="Equipment">
        {EQUIPMENT.map((e) => (
          <FocusButton key={e.id} label={e.label} selected={equipment.includes(e.id)} onPress={() => toggleEquipment(e.id)} />
        ))}
      </Section>

      <Section title="Anything I should know?">
        {NOTES.map((n) => (
          <FocusButton key={n.label} label={n.label} selected={notes === n.id} onPress={() => setNotes(n.id)} />
        ))}
      </Section>

      <View style={styles.cta}>
        <FocusButton
          primary
          size="lg"
          label="Build my workout"
          sublabel="Tailored to your choices"
          autoFocus={!!initial}
          onPress={() => onGenerate({ goal, minutes, level, equipment, notes: notes || undefined })}
        />
        <FocusButton label={`You: ${profile.weightKg} kg · ${profile.heightCm} cm · ${profile.age} y`} sublabel="Edit for the calorie counter" onPress={onEditProfile} />
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 96, paddingVertical: 54 },
  header: { marginBottom: 24 },
  brand: { color: colors.text, fontSize: t.h1 + 8, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.textDim, fontSize: t.body, marginTop: 8, maxWidth: 1300 },
  section: { marginBottom: 6 },
  sectionTitle: { color: colors.textDim, fontSize: t.small, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  cta: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
});
