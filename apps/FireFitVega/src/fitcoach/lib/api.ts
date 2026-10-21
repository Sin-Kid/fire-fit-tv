import { API_BASE_URL, HOSTED_WEB_DEMO, REQUEST_TIMEOUT_MS } from './config';
import { buildFallbackWorkout } from './fallback';
import type { Workout, WorkoutRequest } from './types';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (HOSTED_WEB_DEMO) throw new Error('hosted demo: no backend');
  const res = await withTimeout(
    fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    REQUEST_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Asks the backend (Amazon Bedrock) for a workout; falls back on-device if unreachable. */
export async function fetchWorkout(req: WorkoutRequest): Promise<{ workout: Workout; offline: boolean }> {
  try {
    const workout = await post<Workout>('/workout', req);
    if (!workout?.exercises?.length) throw new Error('empty workout');
    return { workout, offline: false };
  } catch (e) {
    console.warn('[fitcoach] API unreachable, using on-device workout:', (e as Error).message);
    return { workout: buildFallbackWorkout(req), offline: true };
  }
}

export interface RecapInput {
  title: string;
  goal?: string;
  completed: number;
  skipped: number;
  easierUsed: number;
  activeSec: number;
  form?: { exercise: string; reps: number; goodReps: number; topCue?: string }[];
}

export async function fetchRecap(r: RecapInput): Promise<string> {
  try {
    const out = await post<{ text: string }>('/recap', r);
    if (out?.text) return out.text;
  } catch {
    // fall through
  }
  const mins = Math.max(1, Math.round(r.activeSec / 60));
  return `Great work: ${r.completed} exercises and ${mins} active minutes done. See you next session.`;
}
