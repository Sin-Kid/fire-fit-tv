import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

process.env.USE_BEDROCK = 'false';
delete process.env.SESSIONS_TABLE;

const { handle } = await import('../src/handler.js');
const { handler: lambdaHandler } = await import('../src/lambda.js');
const { MemorySessionStore, DynamoSessionStore, setSessionStore, PHONE_TIMEOUT_MS } = await import('../src/coach/sessions.js');

const call = async (method: string, path: string, body?: unknown) => {
  const r = await handle(method, path, body === undefined ? undefined : JSON.stringify(body));
  return { status: r.status, body: r.body as any, contentType: r.contentType };
};

beforeEach(() => setSessionStore(new MemorySessionStore()));

test('TV creates a session with a 4-digit code', async () => {
  const r = await call('POST', '/session');
  assert.equal(r.status, 201);
  assert.match(r.body.code, /^\d{4}$/);
  assert.equal(r.body.coachPath, `/coach?code=${r.body.code}`);
  const s = await call('GET', `/session/${r.body.code}`);
  assert.equal(s.status, 200);
  assert.equal(s.body.phoneConnected, false);
  assert.equal(s.body.exercise, null);
});

test('full flow: TV sets exercise, phone joins, sends a rep and a cue, TV sees them', async () => {
  const { code } = (await call('POST', '/session')).body;
  assert.equal((await call('PUT', `/session/${code}/exercise`, { name: 'Bodyweight Squats', key: 'squat', phase: 'main', index: 3 })).status, 200);

  const hello = await call('POST', `/session/${code}/phone`, { type: 'hello' });
  assert.equal(hello.status, 200);
  assert.equal(hello.body.exercise.name, 'Bodyweight Squats');
  assert.equal(hello.body.exercise.key, 'squat');

  await call('POST', `/session/${code}/phone`, { type: 'rep', camera: true, exercise: 'Bodyweight Squats', reps: 1 });
  await call('POST', `/session/${code}/phone`, { type: 'cue', camera: true, text: 'Sit a little deeper.', kind: 'fix', exercise: 'Bodyweight Squats', reps: 1 });

  const s = (await call('GET', `/session/${code}`)).body;
  assert.equal(s.phoneConnected, true);
  assert.equal(s.camera, true);
  assert.equal(s.live.reps, 1);
  assert.equal(s.feedback.text, 'Sit a little deeper.');
  assert.equal(s.feedback.kind, 'fix');
  assert.ok(s.feedback.id > 0);
});

test('heartbeat carries form stats; they are sanitised', async () => {
  const { code } = (await call('POST', '/session')).body;
  await call('POST', `/session/${code}/phone`, {
    type: 'heartbeat', camera: true,
    stats: { 'Push-ups': { family: 'pushup', reps: 12, goodReps: 9, holdSec: 0, cues: { "Don't let your hips sag.": 3 } }, Bad: 'nope' },
  });
  const s = (await call('GET', `/session/${code}`)).body;
  assert.deepEqual(Object.keys(s.stats), ['Push-ups']);
  assert.equal(s.stats['Push-ups'].goodReps, 9);
  assert.equal(s.stats['Push-ups'].cues["Don't let your hips sag."], 3);
});

test('phone goes "disconnected" after it stops sending', async () => {
  const store = new MemorySessionStore();
  setSessionStore(store);
  const { code } = (await call('POST', '/session')).body;
  await call('POST', `/session/${code}/phone`, { type: 'hello' });
  const { publicState } = await import('../src/coach/routes.js');
  const s = (await store.get(code))!;
  assert.equal(publicState(s, s.phone!.lastSeen + 1000).phoneConnected, true);
  assert.equal(publicState(s, s.phone!.lastSeen + PHONE_TIMEOUT_MS + 1).phoneConnected, false);
});

test('TV clears the exercise during rest', async () => {
  const { code } = (await call('POST', '/session')).body;
  await call('PUT', `/session/${code}/exercise`, { name: 'Plank Hold', key: 'plank', phase: 'main', index: 1 });
  await call('PUT', `/session/${code}/exercise`, { name: null });
  assert.equal((await call('GET', `/session/${code}`)).body.exercise, null);
});

test('bad requests are rejected', async () => {
  assert.equal((await call('GET', '/session/9999')).status, 404);
  assert.equal((await call('POST', '/session/9999/phone', { type: 'hello' })).status, 404);
  assert.equal((await call('GET', '/session/12')).status, 404);
  const { code } = (await call('POST', '/session')).body;
  assert.equal((await call('POST', `/session/${code}/phone`, { type: 'hack' })).status, 400);
  assert.equal((await call('POST', `/session/${code}/phone`, { type: 'cue' })).status, 400);
  const long = await call('POST', `/session/${code}/phone`, { type: 'cue', text: 'x'.repeat(500), kind: 'evil' });
  assert.equal(long.status, 200);
  const s = (await call('GET', `/session/${code}`)).body;
  assert.equal(s.feedback.text.length, 140);
  assert.equal(s.feedback.kind, 'info');
});

test('codes are unique while sessions are live', async () => {
  const codes = new Set<string>();
  for (let i = 0; i < 200; i++) codes.add((await call('POST', '/session')).body.code);
  assert.equal(codes.size, 200);
});

test('phone page and form rules are served', async () => {
  const page = await call('GET', '/coach');
  assert.equal(page.status, 200);
  assert.match(page.contentType!, /text\/html/);
  assert.match(page.body, /FitCoach Phone Companion/);
  assert.match(page.body, /pose_landmarker_lite\.task/);
  assert.match(page.body, /\/coach\/form-rules\.js/);
  const js = await call('GET', '/coach/form-rules.js');
  assert.equal(js.status, 200);
  assert.match(js.contentType!, /javascript/);
  assert.match(js.body, /FormCoach/);
});

test('Lambda serves the phone page as HTML', async () => {
  const r = await lambdaHandler({ rawPath: '/coach', requestContext: { http: { method: 'GET' } } });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers['Content-Type'], /text\/html/);
  assert.match(r.body, /<html/);
});

test('public/form-rules.js is up to date with src/coach/formRules.ts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fr-'));
  const out = join(dir, 'fr.js');
  execFileSync('npx', ['esbuild', 'src/coach/formRules.ts', '--bundle', '--format=iife', '--global-name=FormRules', '--target=es2019', `--outfile=${out}`], { stdio: 'pipe' });
  assert.equal(readFileSync('public/form-rules.js', 'utf8'), readFileSync(out, 'utf8'), 'run `npm run build:coach`');
});

// ---------- DynamoDB store (client mocked) ----------

test('DynamoDB store issues conditional put/update and strips ttl on read', async () => {
  const sent: { name: string; input: any }[] = [];
  const items = new Map<string, any>();
  const orig = DynamoDBDocumentClient.prototype.send;
  (DynamoDBDocumentClient.prototype as any).send = async function (cmd: any) {
    const name = cmd.constructor.name;
    sent.push({ name, input: cmd.input });
    const err = () => Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' });
    if (name === 'PutCommand') {
      if (items.has(cmd.input.Item.code)) throw err();
      items.set(cmd.input.Item.code, { ...cmd.input.Item });
      return {};
    }
    if (name === 'GetCommand') return { Item: items.get(cmd.input.Key.code) };
    if (name === 'UpdateCommand') {
      const it = items.get(cmd.input.Key.code);
      if (!it) throw err();
      for (const [k, f] of Object.entries(cmd.input.ExpressionAttributeNames as Record<string, string>)) it[f] = cmd.input.ExpressionAttributeValues[k.replace('#f', ':v')];
      return {};
    }
    throw new Error('unexpected ' + name);
  };
  try {
    const store = new DynamoSessionStore('sessions-table');
    assert.equal(await store.create('4321', 1_000_000), true);
    assert.equal(await store.create('4321', 1_000_000), false);
    assert.equal(await store.update('4321', { exercise: { name: 'Push-ups', key: 'pushup', phase: 'main', index: 2, at: 5 } }), true);
    assert.equal(await store.update('0000', { exercise: null }), false);
    const s = await store.get('4321');
    assert.equal(s!.exercise!.name, 'Push-ups');
    assert.equal((s as any).ttl, undefined);

    const put = sent.find((c) => c.name === 'PutCommand')!.input;
    assert.equal(put.TableName, 'sessions-table');
    assert.equal(put.ConditionExpression, 'attribute_not_exists(code)');
    assert.equal(put.Item.ttl, Math.floor((1_000_000 + 6 * 3600 * 1000) / 1000));
    const upd = sent.find((c) => c.name === 'UpdateCommand')!.input;
    assert.equal(upd.UpdateExpression, 'SET #f0 = :v0');
    assert.equal(upd.ExpressionAttributeNames['#f0'], 'exercise');
    assert.equal(upd.ConditionExpression, 'attribute_exists(code)');
    assert.equal(sent.find((c) => c.name === 'GetCommand')!.input.ConsistentRead, true);
  } finally {
    DynamoDBDocumentClient.prototype.send = orig;
  }
});

test('PUBLIC_URL puts a phone-reachable https link in the session', async () => {
  process.env.PUBLIC_URL = 'https://abc-123.trycloudflare.com/';
  try {
    const r = await call('POST', '/session');
    assert.equal(r.body.coachUrl, `https://abc-123.trycloudflare.com/coach?code=${r.body.code}`);
  } finally {
    delete process.env.PUBLIC_URL;
  }
  assert.equal((await call('POST', '/session')).body.coachUrl, null);
});
