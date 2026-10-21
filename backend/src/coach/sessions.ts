// Pairing sessions between the TV and the phone camera.
//
// The TV creates a session and shows a 4-digit code (and QR). The phone joins
// with that code, watches the user through MediaPipe and posts reps/cues; the
// TV polls the session to caption and speak them.
//
// Each side owns different fields, so concurrent writes never clobber each other:
//   TV    → exercise
//   phone → phone, feedback, live, stats

import { randomInt } from 'node:crypto';
import type { CoachSummary, CueKind } from './formRules.js';

export interface CurrentExercise {
  name: string;
  key: string;
  phase: string;
  index: number;
  at: number;
}

export interface SessionState {
  code: string;
  createdAt: number;
  exercise?: CurrentExercise | null;
  phone?: { lastSeen: number; camera: boolean } | null;
  feedback?: { id: number; text: string; kind: CueKind; at: number } | null;
  live?: { exercise: string; reps: number; at: number } | null;
  stats?: Record<string, CoachSummary> | null;
  /** Voice remote (laptop/phone browser used as the TV's microphone). */
  voice?: { lastSeen: number; heard: { id: number; text: string; at: number }[] } | null;
}

export interface SessionStore {
  create(code: string, now: number): Promise<boolean>;
  get(code: string): Promise<SessionState | null>;
  update(code: string, fields: Partial<Omit<SessionState, 'code' | 'createdAt'>>): Promise<boolean>;
}

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export class MemorySessionStore implements SessionStore {
  private map = new Map<string, SessionState>();
  constructor(private clock: () => number = Date.now) {}
  private sweep() {
    const now = this.clock();
    for (const [k, v] of this.map) if (now - v.createdAt > SESSION_TTL_MS) this.map.delete(k);
  }
  async create(code: string, now: number) {
    this.sweep();
    if (this.map.has(code)) return false;
    this.map.set(code, { code, createdAt: now });
    return true;
  }
  async get(code: string) {
    this.sweep();
    const s = this.map.get(code);
    return s ? structuredClone(s) : null;
  }
  async update(code: string, fields: Partial<SessionState>) {
    const s = this.map.get(code);
    if (!s) return false;
    Object.assign(s, structuredClone(fields));
    return true;
  }
}

/** DynamoDB-backed store for AWS Lambda, where instances don't share memory. */
export class DynamoSessionStore implements SessionStore {
  private doc: Promise<import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient>;
  constructor(private table: string) {
    this.doc = (async () => {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
      return DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
    })();
  }
  async create(code: string, now: number) {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      await (await this.doc).send(
        new PutCommand({
          TableName: this.table,
          Item: { code, createdAt: now, ttl: Math.floor((now + SESSION_TTL_MS) / 1000) },
          ConditionExpression: 'attribute_not_exists(code)',
        }),
      );
      return true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }
  async get(code: string) {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await (await this.doc).send(new GetCommand({ TableName: this.table, Key: { code }, ConsistentRead: true }));
    if (!res.Item) return null;
    const { ttl: _ttl, ...state } = res.Item;
    return state as SessionState;
  }
  async update(code: string, fields: Partial<SessionState>) {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const keys = Object.keys(fields);
    if (!keys.length) return true;
    try {
      await (await this.doc).send(
        new UpdateCommand({
          TableName: this.table,
          Key: { code },
          UpdateExpression: 'SET ' + keys.map((_, i) => `#f${i} = :v${i}`).join(', '),
          ExpressionAttributeNames: Object.fromEntries(keys.map((k, i) => [`#f${i}`, k])),
          ExpressionAttributeValues: Object.fromEntries(keys.map((k, i) => [`:v${i}`, (fields as Record<string, unknown>)[k] ?? null])),
          ConditionExpression: 'attribute_exists(code)',
        }),
      );
      return true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }
}

let store: SessionStore | undefined;
export function sessionStore(): SessionStore {
  store ??= process.env.SESSIONS_TABLE ? new DynamoSessionStore(process.env.SESSIONS_TABLE) : new MemorySessionStore();
  return store;
}
/** For tests. */
export function setSessionStore(s: SessionStore) {
  store = s;
}

export async function createSession(s: SessionStore = sessionStore(), now = Date.now()): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(1000, 10000));
    if (await s.create(code, now)) return code;
  }
  throw new Error('Could not allocate a session code');
}

export const PHONE_TIMEOUT_MS = 6000;
