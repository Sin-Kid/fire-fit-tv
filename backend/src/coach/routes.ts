// HTTP routes for the form coach:
//
//   POST /session                    TV   → { code, coachPath, coachUrl }
//   GET  /session/:code              TV   → session state (polled ~every 700 ms)
//   PUT  /session/:code/exercise     TV   → tell the phone which move is on screen
//   POST /session/:code/phone        phone→ hello / heartbeat / cue / rep (returns current exercise)
//   POST /session/:code/voice        voice remote → { heard?: "more rest" } (also a heartbeat)
//   GET  /voice                      voice remote page (browser speech recognition as the TV's microphone)
//   GET  /coach                      phone camera page (MediaPipe Pose Landmarker)
//   GET  /coach/form-rules.js        the form rules, bundled for the browser
//   GET  /tv                         the TV app built for the browser (testing without a Fire TV)

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CoachSummary, CueKind } from './formRules.js';
import { createSession, PHONE_TIMEOUT_MS, sessionStore, type SessionState } from './sessions.js';

export interface RouteResponse {
  status: number;
  body: unknown;
  /** Set for non-JSON responses (HTML/JS): body is sent as-is with this content type. */
  contentType?: string;
}

class Invalid extends Error {}

const KINDS: CueKind[] = ['good', 'fix', 'info'];
const str = (v: unknown, max: number, field: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw new Invalid(`${field} is required`);
  return v.trim().slice(0, max);
};
const int = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

function cleanStats(raw: unknown): Record<string, CoachSummary> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, CoachSummary> = {};
  for (const [name, v] of Object.entries(raw as Record<string, Record<string, unknown>>).slice(0, 60)) {
    if (!v || typeof v !== 'object') continue;
    const cues: Record<string, number> = {};
    if (v.cues && typeof v.cues === 'object') {
      for (const [t, n] of Object.entries(v.cues as Record<string, unknown>).slice(0, 10)) cues[t.slice(0, 140)] = int(n, 0, 999);
    }
    out[name.slice(0, 60)] = {
      exercise: name.slice(0, 60),
      family: String(v.family ?? 'active').slice(0, 20) as CoachSummary['family'],
      reps: int(v.reps, 0, 999),
      goodReps: int(v.goodReps, 0, 999),
      holdSec: int(v.holdSec, 0, 3600),
      cues,
    };
  }
  return out;
}

/** What the TV sees: the stored state plus whether the phone is live. */
export function publicState(s: SessionState, now = Date.now()) {
  return {
    code: s.code,
    exercise: s.exercise ?? null,
    phoneConnected: !!s.phone && now - s.phone.lastSeen < PHONE_TIMEOUT_MS,
    camera: !!s.phone?.camera,
    feedback: s.feedback ?? null,
    live: s.live ?? null,
    stats: s.stats ?? {},
    voiceConnected: !!s.voice && now - s.voice.lastSeen < PHONE_TIMEOUT_MS,
    voice: s.voice?.heard ?? [],
  };
}

// ---------- static files for the phone page ----------

const staticCache = new Map<string, string>();
// Cache only on Lambda, where files never change; locally, rebuilt pages show up immediately.
const CACHE_STATIC = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
function readPublic(file: string): string | null {
  if (CACHE_STATIC && staticCache.has(file)) return staticCache.get(file)!;
  // src/coach/routes.ts → backend/public ; dist-lambda/index.mjs → dist-lambda/public
  for (const rel of ['../../public/', './public/', '../public/']) {
    const p = fileURLToPath(new URL(rel + file, import.meta.url));
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf8');
      if (CACHE_STATIC) staticCache.set(file, text);
      return text;
    }
  }
  return null;
}

export async function handleCoach(method: string, path: string, body: unknown, now = Date.now()): Promise<RouteResponse | null> {
  try {
    // Browser build of the TV app (handy for testing without a Fire TV): /tv
    if (method === 'GET' && (path === '/tv' || path === '/tv/')) {
      const html = readPublic('tv/index.html');
      return html
        ? { status: 200, body: html, contentType: 'text/html; charset=utf-8' }
        : { status: 404, body: { error: 'TV web build missing. Run: cd apps/FireFitTV && npx expo export --platform web --output-dir ../../backend/public/tv' } };
    }
    if (method === 'GET' && path.startsWith('/_expo/') && !path.includes('..')) {
      const js = readPublic('tv' + path);
      return js ? { status: 200, body: js, contentType: 'text/javascript; charset=utf-8' } : { status: 404, body: { error: 'Not found' } };
    }

    if (method === 'GET' && (path === '/coach' || path === '/coach/')) {
      const html = readPublic('coach.html');
      return html ? { status: 200, body: html, contentType: 'text/html; charset=utf-8' } : { status: 500, body: { error: 'coach page missing' } };
    }
    if (method === 'GET' && (path === '/voice' || path === '/voice/')) {
      const html = readPublic('voice.html');
      return html ? { status: 200, body: html, contentType: 'text/html; charset=utf-8' } : { status: 500, body: { error: 'voice page missing' } };
    }
    if (method === 'GET' && path === '/coach/form-rules.js') {
      const js = readPublic('form-rules.js');
      return js ? { status: 200, body: js, contentType: 'text/javascript; charset=utf-8' } : { status: 500, body: { error: 'form rules missing' } };
    }

    if (method === 'POST' && path === '/session') {
      const code = await createSession(sessionStore(), now);
      const coachPath = `/coach?code=${code}`;
      const voicePath = `/voice?code=${code}`;
      // PUBLIC_URL (e.g. an https tunnel) lets a phone open the camera page; phones only allow cameras over https.
      const base = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
      return { status: 201, body: { code, coachPath, coachUrl: base ? base + coachPath : null, voicePath, voiceUrl: base ? base + voicePath : null } };
    }

    const m = path.match(/^\/session\/(\d{4})(\/exercise|\/phone|\/voice)?$/);
    if (!m) return null;
    const [, code, sub] = m;
    const store = sessionStore();
    const b = (body ?? {}) as Record<string, unknown>;

    if (method === 'GET' && !sub) {
      const s = await store.get(code);
      return s ? { status: 200, body: publicState(s, now) } : { status: 404, body: { error: 'Session not found' } };
    }

    if (method === 'PUT' && sub === '/exercise') {
      const exercise = b.name == null ? null : {
        name: str(b.name, 60, 'name'),
        key: typeof b.key === 'string' ? b.key.slice(0, 30) : '',
        phase: typeof b.phase === 'string' ? b.phase.slice(0, 12) : 'main',
        index: int(b.index, 0, 200),
        at: now,
      };
      const ok = await store.update(code, { exercise });
      return ok ? { status: 200, body: { ok: true } } : { status: 404, body: { error: 'Session not found' } };
    }

    if (method === 'POST' && sub === '/voice') {
      const s = await store.get(code);
      if (!s) return { status: 404, body: { error: 'Session not found. Check the code on your TV.' } };
      const heard = (s.voice?.heard ?? []).slice(-7);
      if (typeof b.heard === 'string' && b.heard.trim()) heard.push({ id: Math.max(now, (heard.at(-1)?.id ?? 0) + 1), text: b.heard.trim().slice(0, 120), at: now });
      await store.update(code, { voice: { lastSeen: now, heard } });
      return { status: 200, body: { ok: true, tvExercise: s.exercise?.name ?? null } };
    }

    if (method === 'POST' && sub === '/phone') {
      const type = String(b.type ?? 'heartbeat');
      if (!['hello', 'heartbeat', 'cue', 'rep'].includes(type)) throw new Invalid('type must be hello, heartbeat, cue or rep');
      const fields: Partial<SessionState> = { phone: { lastSeen: now, camera: !!b.camera } };
      if (type === 'cue') {
        const kind = KINDS.includes(b.kind as CueKind) ? (b.kind as CueKind) : 'info';
        fields.feedback = { id: now, text: str(b.text, 140, 'text'), kind, at: now };
      }
      if (type === 'rep' || type === 'heartbeat' || type === 'cue') {
        if (typeof b.exercise === 'string') fields.live = { exercise: b.exercise.slice(0, 60), reps: int(b.reps, 0, 999), at: now };
      }
      const stats = cleanStats(b.stats);
      if (stats) fields.stats = stats;
      if (!(await store.update(code, fields))) return { status: 404, body: { error: 'Session not found. Check the code on your TV.' } };
      const s = await store.get(code);
      return { status: 200, body: { ok: true, exercise: s?.exercise ?? null } };
    }

    return { status: 405, body: { error: 'Method not allowed' } };
  } catch (e) {
    if (e instanceof Invalid) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
