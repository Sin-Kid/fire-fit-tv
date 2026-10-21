// Netlify Function: the phone-companion pairing API for the hosted demo
// (https://fire-fit-tv.netlify.app), so the TV-mode QR code works without a local backend.
//
// It reuses the backend's routes (backend/src/coach/routes.ts) and keeps sessions in
// Netlify Blobs. Each side writes its own key (TV / phone / voice) so the TV's
// "current move" and the phone's reps never overwrite each other.
import { getStore } from '@netlify/blobs';
import { handleCoach } from '../../../../backend/src/coach/routes.ts';
import { setSessionStore, type SessionState, type SessionStore } from '../../../../backend/src/coach/sessions.ts';

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const OWNER: Record<string, 'tv' | 'phone' | 'voice'> = {
  exercise: 'tv', phone: 'phone', feedback: 'phone', live: 'phone', stats: 'phone', voice: 'voice',
};

class BlobsSessionStore implements SessionStore {
  private store = getStore({ name: 'fitcoach-sessions', consistency: 'strong' });
  async create(code: string, now: number) {
    const meta = (await this.store.get(`${code}/meta`, { type: 'json' })) as { createdAt: number } | null;
    if (meta && now - meta.createdAt < SESSION_TTL_MS) return false;
    await Promise.all([
      this.store.setJSON(`${code}/meta`, { createdAt: now }),
      this.store.delete(`${code}/tv`),
      this.store.delete(`${code}/phone`),
      this.store.delete(`${code}/voice`),
    ]);
    return true;
  }
  async get(code: string): Promise<SessionState | null> {
    const [meta, tv, phone, voice] = await Promise.all(
      ['meta', 'tv', 'phone', 'voice'].map((k) => this.store.get(`${code}/${k}`, { type: 'json' })),
    );
    if (!meta || Date.now() - (meta as { createdAt: number }).createdAt > SESSION_TTL_MS) return null;
    return { code, createdAt: (meta as { createdAt: number }).createdAt, ...(tv ?? {}), ...(phone ?? {}), ...(voice ?? {}) } as SessionState;
  }
  async update(code: string, fields: Partial<SessionState>) {
    if (!(await this.store.get(`${code}/meta`))) return false;
    const groups: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(fields)) (groups[OWNER[k] ?? 'phone'] ??= {})[k] = v;
    await Promise.all(
      Object.entries(groups).map(async ([owner, part]) => {
        const prev = ((await this.store.get(`${code}/${owner}`, { type: 'json' })) ?? {}) as Record<string, unknown>;
        await this.store.setJSON(`${code}/${owner}`, { ...prev, ...part });
      }),
    );
    return true;
  }
}

export default async (req: Request) => {
  setSessionStore(new BlobsSessionStore());
  const url = new URL(req.url);
  let body: unknown;
  if (req.method !== 'GET') {
    try {
      body = JSON.parse((await req.text()) || '{}');
    } catch {
      return Response.json({ error: 'Body is not valid JSON' }, { status: 400 });
    }
  }
  const res = await handleCoach(req.method, url.pathname, body);
  if (!res) return Response.json({ error: 'Not found' }, { status: 404 });
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  return res.contentType
    ? new Response(String(res.body), { status: res.status, headers: { ...headers, 'Content-Type': res.contentType } })
    : Response.json(res.body, { status: res.status, headers });
};

export const config = { path: ['/session', '/session/*'] };
