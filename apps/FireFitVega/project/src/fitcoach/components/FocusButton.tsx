import React, { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, type as t } from '../lib/theme';
import { tvStyles } from '../lib/scale';

interface Props {
  label: string;
  onPress: () => void;
  /** Filled lime button for the main action on a screen. */
  primary?: boolean;
  /** Chip that stays highlighted when chosen (option pickers). */
  selected?: boolean;
  /** Request initial focus when the screen mounts (D-pad starts here). */
  autoFocus?: boolean;
  sublabel?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
}

/**
 * React Native TV doesn't draw a focus ring for you, so every
 * focusable control on screen goes through this component: it grows and gets a
 * lime outline when the D-pad lands on it.
 */
export function FocusButton({ label, onPress, primary, selected, autoFocus, sublabel, style, size = 'md' }: Props) {
  const [focused, setFocused] = useState(false);

  const bg = primary ? colors.accent : selected ? colors.surfaceRaised : colors.surface;
  const fg = primary ? colors.accentInk : colors.text;

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={autoFocus}
      style={[
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: bg, borderColor: focused ? colors.accent : selected ? colors.textDim : colors.border },
        focused && styles.focused,
        style,
      ]}
    >
      <View style={styles.row}>
        {selected && !primary ? <View style={styles.dot} /> : null}
        <Text style={[styles.label, size === 'lg' && styles.labelLg, { color: fg }]}>{label}</Text>
      </View>
      {sublabel ? <Text style={[styles.sub, { color: primary ? colors.accentInk : colors.textDim }]}>{sublabel}</Text> : null}
    </Pressable>
  );
}

const styles = tvStyles({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
    marginBottom: 18,
  },
  lg: { paddingVertical: 24, paddingHorizontal: 48 },
  focused: { transform: [{ scale: 1.08 }] },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, marginRight: 12 },
  label: { fontSize: t.body, fontWeight: '700' },
  labelLg: { fontSize: t.h2 },
  sub: { fontSize: t.small, marginTop: 4 },
});
