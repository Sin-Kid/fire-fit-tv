import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from '@amazon-devices/react-native-svg';
import {
  GROUND,
  animationFor,
  shapesFor,
  skeletonAtTime,
  type Role,
  type Vec,
} from '../lib/exerciseAnimations';
import { u } from '../lib/scale';
import { colors } from '../lib/theme';
import type { Phase } from '../lib/types';

interface Props {
  /** Exercise name; Bedrock-generated names are matched to the closest animation. */
  name: string;
  phase?: Phase;
  size?: number;
  /** Main figure colour (defaults to the accent). */
  color?: string;
  playing?: boolean;
  /** 1 = normal tempo, 0.5 = half speed (used for the "up next" preview). */
  speed?: number;
  style?: StyleProp<ViewStyle>;
}

const FRAME_MS = 1000 / 30; // ~30 fps is plenty for a stick figure and easy on a TV stick

const pathOf = (pts: Vec[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');

/** Animated stick figure demonstrating an exercise. */
export function ExerciseFigure({ name, phase, size: designSize = 360, color = colors.accent, playing = true, speed = 1, style }: Props) {
  const size = u(designSize);
  const anim = useMemo(() => animationFor(name, phase), [name, phase]);
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef({ elapsed: 0, last: 0 });

  // Restart from the first pose whenever the exercise changes.
  useEffect(() => {
    clock.current = { elapsed: 0, last: 0 };
    const id = setTimeout(() => setElapsed(0), 0);
    return () => clearTimeout(id);
  }, [anim]);

  useEffect(() => {
    if (!playing) return;
    clock.current.last = 0;
    const id = setInterval(() => {
      const now = Date.now();
      const c = clock.current;
      if (c.last) c.elapsed += (now - c.last) * speed;
      c.last = now;
      setElapsed(c.elapsed);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [playing, speed, anim]);

  const shapes = shapesFor(anim, skeletonAtTime(anim, elapsed));
  const fill = (r: Role) =>
    r === 'near' ? color : r === 'far' ? color : r === 'band' ? colors.band : colors.prop;

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityLabel={`${anim.label} demonstration`}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Line x1={14} y1={GROUND + 6} x2={186} y2={GROUND + 6} stroke={colors.border} strokeWidth={3} strokeLinecap="round" />
        {shapes.map((s, i) =>
          s.kind === 'poly' ? (
            <Path
              key={i}
              d={pathOf(s.pts)}
              fill="none"
              stroke={fill(s.role)}
              strokeOpacity={s.role === 'far' ? 0.45 : 1}
              strokeWidth={s.w}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.r} fill={fill(s.role)} fillOpacity={s.role === 'far' ? 0.45 : 1} />
          ),
        )}
      </Svg>
    </View>
  );
}
