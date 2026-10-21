import {
  EQUIPMENT,
  GOALS,
  LEVELS,
  type Equipment,
  type Exercise,
  type Phase,
  type WorkoutRequest,
} from './types.js';

export class BadRequest extends Error {}

const ALLOWED_MINUTES = [10, 15, 20, 30, 45];

export function parseWorkoutRequest(body: unknown): WorkoutRequest {
  if (!body || typeof body !== 'object') throw new BadRequest('Body must be a JSON object');
  const b = body as Record<string, unknown>;

  const goal = b.goal;
  if (typeof goal !== 'string' || !GOALS.includes(goal as never)) {
    throw new BadRequest(`goal must be one of ${GOALS.join(', ')}`);
  }
  const level = b.level ?? 'beginner';
  if (typeof level !== 'string' || !LEVELS.includes(level as never)) {
    throw new BadRequest(`level must be one of ${LEVELS.join(', ')}`);
  }
  const minutes = Number(b.minutes);
  if (!ALLOWED_MINUTES.includes(minutes)) {
    throw new BadRequest(`minutes must be one of ${ALLOWED_MINUTES.join(', ')}`);
  }
  const rawEq = Array.isArray(b.equipment) ? b.equipment : ['none'];
  const equipment = rawEq.filter((e): e is Equipment => EQUIPMENT.includes(e as never));
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 200) : undefined;

  return {
    goal: goal as WorkoutRequest['goal'],
    level: level as WorkoutRequest['level'],
    minutes,
    equipment: equipment.length ? equipment : ['none'],
    notes,
  };
}

const PHASES: Phase[] = ['warmup', 'main', 'cooldown'];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const text = (v: unknown, fallback: string, max = 90) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback;

/**
 * Model output is untrusted: coerce every field into range so the TV player
 * can never be handed a 0-second or 2-hour interval.
 */
export function sanitizeExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  const out: Exercise[] = [];
  for (const item of raw.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = text(r.name, '', 40);
    if (!name) continue;
    const phase = PHASES.includes(r.phase as Phase) ? (r.phase as Phase) : 'main';
    out.push({
      name,
      phase,
      durationSec: Math.round(clamp(Number(r.durationSec) || 30, 15, 120)),
      restSec: Math.round(clamp(Number(r.restSec) || 0, 0, 60)),
      cue: text(r.cue, 'Move with control and keep breathing.'),
      easier: text(r.easier, 'Slow it down and reduce the range of motion.'),
      intensity: Math.round(clamp(Number(r.intensity) || 3, 1, 5)),
    });
  }
  // Keep the warmup → main → cooldown order even if the model shuffled it.
  return out.sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase));
}

export function totalSeconds(exercises: Exercise[]): number {
  return exercises.reduce((s, e) => s + e.durationSec + e.restSec, 0);
}
