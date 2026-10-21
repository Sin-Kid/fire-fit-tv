import React from 'react';
import { View } from 'react-native';
import { colors } from '../lib/theme';
import { tvStyles, u } from '../lib/scale';

export function IntensityBar({ level, color = colors.accent }: { level: number; color?: string }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.pip, { height: u(10 + i * 6), backgroundColor: i <= level ? color : colors.border }]} />
      ))}
    </View>
  );
}

const styles = tvStyles({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  pip: { width: 14, borderRadius: 4, marginRight: 6 },
});
