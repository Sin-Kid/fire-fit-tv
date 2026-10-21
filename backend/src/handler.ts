// Transport-agnostic request handling, shared by the local HTTP server and the
// AWS Lambda Function URL entry point.

import {
  bedrockEnabled,
  fallbackRecap,
  generateRecapWithBedrock,
  generateWorkoutWithBedrock,
  MODEL_ID,
  type RecapRequest,
} from './bedrock.js';
import { handleCoach } from './coach/routes.js';
import { buildFallbackWorkout } from './fallback.js';
import { BadRequest, parseWorkoutRequest } from './validate.js';

export interface ApiResponse {
  status: number;
  body: unknown;
  /** Non-JSON responses (the phone coach page): body is sent as-is. */
  contentType?: string;
}

const log = (msg: string, extra?: unknown) =>
  console.log(`[fitcoach] ${msg}`, extra === undefined ? '' : extra);

export async function handle(method: string, path: string, rawBody: string | undefined): Promise<ApiResponse> {
  try {
    if (method === 'GET' && (path === '/' || path === '/health')) {
      return { status: 200, body: { ok: true, bedrock: bedrockEnabled(), model: MODEL_ID } };
    }

    if (method === 'POST' && path === '/workout') {
      const req = parseWorkoutRequest(parseJson(rawBody));
      if (bedrockEnabled()) {
        try {
          const t0 = Date.now();
          const workout = await generateWorkoutWithBedrock(req);
          log(`bedrock workout in ${Date.now() - t0}ms`, { exercises: workout.exercises.length });
          return { status: 200, body: workout };
        } catch (err) {
          log('bedrock failed, using fallback', (err as Error).message);
        }
      }
      return { status: 200, body: buildFallbackWorkout(req) };
    }

    if (method === 'POST' && path === '/recap') {
      const b = parseJson(rawBody) as Omit<Partial<RecapRequest>, 'form'> & { form?: unknown };
      const r: RecapRequest = {
        title: String(b.title ?? 'Workout').slice(0, 60),
        goal: b.goal ? String(b.goal).slice(0, 20) : undefined,
        completed: Number(b.completed) || 0,
        skipped: Number(b.skipped) || 0,
        easierUsed: Number(b.easierUsed) || 0,
        activeSec: Number(b.activeSec) || 0,
        form: Array.isArray(b.form)
          ? b.form.slice(0, 30).map((f: Record<string, unknown>) => ({
              exercise: String(f?.exercise ?? '').slice(0, 60),
              reps: Math.max(0, Math.min(999, Number(f?.reps) || 0)),
              goodReps: Math.max(0, Math.min(999, Number(f?.goodReps) || 0)),
              topCue: f?.topCue ? String(f.topCue).slice(0, 140) : undefined,
            })).filter((f: { exercise: string }) => f.exercise)
          : undefined,
      };
      if (bedrockEnabled()) {
        try {
          return { status: 200, body: { text: await generateRecapWithBedrock(r), source: 'bedrock' } };
        } catch (err) {
          log('bedrock recap failed, using fallback', (err as Error).message);
        }
      }
      return { status: 200, body: { text: fallbackRecap(r), source: 'fallback' } };
    }

    if (path.startsWith('/coach') || path.startsWith('/voice') || path.startsWith('/session') || path.startsWith('/tv') || path.startsWith('/_expo/')) {
      const parsed = method === 'GET' ? undefined : parseJson(rawBody);
      const res = await handleCoach(method, path, parsed);
      if (res) return res;
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (err) {
    if (err instanceof BadRequest) return { status: 400, body: { error: err.message } };
    log('unexpected error', err);
    return { status: 500, body: { error: 'Internal error' } };
  }
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequest('Body is not valid JSON');
  }
}
