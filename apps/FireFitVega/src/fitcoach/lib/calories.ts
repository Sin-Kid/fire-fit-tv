// Calorie estimate from the user's body data and each move's MET value.
//
//   kcal per minute = MET × resting burn per minute
//
// Resting burn (BMR) uses the Mifflin-St Jeor equation, so weight, height, age and
// sex all count. MET values follow the Compendium of Physical Activities ranges for
// calisthenics, circuit training and stretching. It's an estimate (shown as "est."),
// not a heart-rate measurement.
import type { Exercise, Profile } from './types';

export const DEFAULT_PROFILE: Profile = { weightKg: 70, heightCm: 170, age: 25, sex: 'unspecified' };

export const LIMITS = {
  weightKg: { min: 30, max: 200 },
  heightCm: { min: 120, max: 220 },
  age: { min: 13, max: 90 },
};

/** Resting kcal per day (Mifflin-St Jeor). "unspecified" uses the midpoint of the two sex constants. */
export function bmr(p: Profile): number {
  const k = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return Math.max(800, 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + k);
}

export const bmi = (p: Profile) => p.weightKg / (p.heightCm / 100) ** 2;

const MAIN_MET = [0, 3.5, 5, 6.5, 8, 9.5]; // by intensity 1–5
export const REST_MET = 1.8; // standing, catching your breath

/** MET for a move. "Make it easier" knocks a quarter off. */
export function metFor(ex: Exercise, easier = false): number {
  const i = Math.max(1, Math.min(5, Math.round(ex.intensity || 3)));
  const base = ex.phase === 'warmup' ? 3.5 : ex.phase === 'cooldown' ? 2.3 : MAIN_MET[i];
  return easier ? base * 0.75 : base;
}

export const kcalPerSec = (p: Profile, met: number) => (met * bmr(p)) / 86400;

/** Estimated kcal for the whole workout if every move and rest is done as planned. */
export function workoutKcal(p: Profile, exercises: Exercise[]): number {
  return exercises.reduce((sum, ex) => sum + kcalPerSec(p, metFor(ex)) * ex.durationSec + kcalPerSec(p, REST_MET) * ex.restSec, 0);
}
