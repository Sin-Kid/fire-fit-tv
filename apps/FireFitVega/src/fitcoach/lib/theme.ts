import type { Phase } from './types';

// Designed for 1920x1080 viewed from ~3 m away: big type, high contrast,
// and a focus state you can't miss.
export const colors = {
  bg: '#0B0F14',
  surface: '#151B23',
  surfaceRaised: '#1E2631',
  border: '#2A3441',
  text: '#F4F7FA',
  textDim: '#B3BFCC', // brighter than a typical UI grey so small text holds up on TVs
  accent: '#C6F432', // lime: primary action + focus
  accentInk: '#0B0F14',
  danger: '#FF6B6B',
  warmup: '#FFB547',
  main: '#C6F432',
  cooldown: '#5CD6FF',
  rest: '#8B95A5',
  prop: '#E8EDF2',
  band: '#FF7AB6',
};

export const phaseColor = (p: Phase) => colors[p];

export const phaseLabel: Record<Phase, string> = {
  warmup: 'WARM-UP',
  main: 'WORKOUT',
  cooldown: 'COOL-DOWN',
};

export const type = {
  hero: 96,
  h1: 56,
  h2: 40,
  body: 28,
  small: 22,
};

export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
