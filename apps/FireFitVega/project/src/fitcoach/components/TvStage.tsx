import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { DESIGN_H, DESIGN_W, SCALE } from '../lib/scale';
import { colors } from '../lib/theme';

export { DESIGN_H, DESIGN_W };

/**
 * Centres the 16:9 app area on the screen. Sizes are already converted to the
 * screen's units by tvStyles()/u() (see lib/scale.ts), so nothing is scaled with a
 * transform and text stays sharp. TVs that aren't exactly 16:9 get a thin letterbox.
 */
export function TvStage({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const w = DESIGN_W * SCALE;
  const h = DESIGN_H * SCALE;
  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { width: w, height: h, left: Math.max(0, (width - w) / 2), top: Math.max(0, (height - h) / 2) }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  canvas: { position: 'absolute', backgroundColor: colors.bg, overflow: 'hidden' },
});
