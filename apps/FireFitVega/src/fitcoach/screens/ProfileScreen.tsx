import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { bmi, bmr, LIMITS } from '../lib/calories';
import { tvStyles } from '../lib/scale';
import { colors, type as t } from '../lib/theme';
import type { Profile, Sex } from '../lib/types';

const SEXES: { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'unspecified', label: 'Prefer not to say' },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * "About you": body data for the calorie counter. No typing on a remote, so every
 * number is changed with big −/+ buttons (±1 and ±5/±10 for speed).
 */
export function ProfileScreen({ initial, onSave }: { initial: Profile; onSave: (p: Profile) => void }) {
  const [p, setP] = useState<Profile>(initial);
  const bump = (key: 'weightKg' | 'heightCm' | 'age', d: number) =>
    setP((cur) => ({ ...cur, [key]: clamp(cur[key] + d, LIMITS[key].min, LIMITS[key].max) }));

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>STEP 1 OF 2 · ABOUT YOU</Text>
      <Text style={styles.title}>Let&apos;s set up your calorie counter</Text>
      <Text style={styles.sub}>Used only to estimate calories burned. It stays on this TV.</Text>

      <Stepper label="Body weight" value={p.weightKg} unit="kg" big={5} onBump={(d) => bump('weightKg', d)} autoFocus />
      <Stepper label="Height" value={p.heightCm} unit="cm" big={5} onBump={(d) => bump('heightCm', d)} />
      <Stepper label="Age" value={p.age} unit="years" big={5} onBump={(d) => bump('age', d)} />

      <View style={styles.row}>
        <Text style={styles.label}>Sex</Text>
        <View style={styles.chips}>
          {SEXES.map((s) => (
            <FocusButton key={s.id} label={s.label} selected={p.sex === s.id} onPress={() => setP({ ...p, sex: s.id })} />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <FocusButton primary size="lg" label="Save and continue" onPress={() => onSave(p)} />
        <View style={styles.facts}>
          <Fact value={bmi(p).toFixed(1)} label="BMI" />
          <Fact value={String(Math.round(bmr(p))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} label="kcal/day at rest" />
        </View>
      </View>
    </View>
  );
}

function Stepper({ label, value, unit, big, onBump, autoFocus }: { label: string; value: number; unit: string; big: number; onBump: (d: number) => void; autoFocus?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        <FocusButton label={`−${big}`} onPress={() => onBump(-big)} />
        <FocusButton label="−1" onPress={() => onBump(-1)} autoFocus={autoFocus} />
        <View style={styles.valueBox}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        <FocusButton label="+1" onPress={() => onBump(1)} />
        <FocusButton label={`+${big}`} onPress={() => onBump(big)} />
      </View>
    </View>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 96, paddingVertical: 54, justifyContent: 'center' },
  kicker: { color: colors.accent, fontSize: t.small, fontWeight: '900', letterSpacing: 3 },
  title: { color: colors.text, fontSize: t.h1 + 8, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  sub: { color: colors.textDim, fontSize: t.body, marginTop: 8, marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label: { color: colors.textDim, fontSize: t.body, fontWeight: '800', width: 260, marginBottom: 18 },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  valueBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', width: 280, marginRight: 18, marginBottom: 18 },
  value: { color: colors.text, fontSize: 72, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  unit: { color: colors.textDim, fontSize: t.body, fontWeight: '700', marginLeft: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  facts: { flexDirection: 'row', marginLeft: 40 },
  fact: { marginRight: 48 },
  factValue: { color: colors.text, fontSize: t.h2, fontWeight: '900', fontVariant: ['tabular-nums'] },
  factLabel: { color: colors.textDim, fontSize: t.small },
});
