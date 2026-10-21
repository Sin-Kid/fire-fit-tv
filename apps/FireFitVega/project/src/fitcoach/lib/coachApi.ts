// TV side of the phone form camera: pairing session + polling.
import { API_BASE_URL, COACH_BASE_URL, HOSTED_WEB_DEMO } from './config';

export type CueKind = 'good' | 'fix' | 'info';

export interface FormSummary {
  exercise: string;
  family: string;
  reps: number;
  goodReps: number;
  holdSec: number;
  cues: Record<string, number>;
}

export interface CoachState {
  code: string;
  exercise: { name: string; key: string; phase: string; index: number } | null;
  phoneConnected: boolean;
  camera: boolean;
  feedback: { id: number; text: string; kind: CueKind; at: number } | null;
  live: { exercise: string; reps: number; at: number } | null;
  stats: Record<string, FormSummary>;
  voiceConnected?: boolean;
  voice?: { id: number; text: string; at: number }[];
}

const TIMEOUT_MS = 6000;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctl?.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl?.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface CoachSession {
  code: string;
  /** Phone form camera page. */
  url: string;
  /** Voice remote page. */
  voiceUrl: string;
}

export async function createCoachSession(): Promise<CoachSession | null> {
  if (HOSTED_WEB_DEMO) return null;
  try {
    const r = await req<{ code: string; coachPath: string; coachUrl?: string | null; voicePath?: string; voiceUrl?: string | null }>('POST', '/session');
    return {
      code: r.code,
      url: r.coachUrl || `${COACH_BASE_URL}${r.coachPath}`,
      // 10.0.2.2 is how an emulator reaches the computer it runs on; in that computer's browser it's localhost.
      voiceUrl: (r.voiceUrl || `${COACH_BASE_URL}${r.voicePath ?? `/voice?code=${r.code}`}`).replace('//10.0.2.2:', '//localhost:'),
    };
  } catch {
    return null; // backend unreachable: the app works without the camera
  }
}

export const getCoachState = (code: string) => req<CoachState>('GET', `/session/${code}`);

export function setCoachExercise(code: string, ex: { name: string; key: string; phase: string; index: number } | null) {
  return req('PUT', `/session/${code}/exercise`, ex ?? { name: null }).catch(() => undefined);
}

/** Condense the camera's per-exercise stats for the recap. */
export function formNotes(stats: Record<string, FormSummary> | undefined) {
  return Object.values(stats ?? {})
    .filter((s) => s.reps > 0)
    .map((s) => {
      const top = Object.entries(s.cues).sort((a, b) => b[1] - a[1])[0];
      return { exercise: s.exercise, reps: s.reps, goodReps: s.goodReps, topCue: top?.[0] };
    });
}
