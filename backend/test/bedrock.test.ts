// Tests the Bedrock code path with a mocked BedrockRuntimeClient.send, so the
// request we build and the way we parse responses are covered without AWS creds.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

process.env.USE_BEDROCK = 'true';
process.env.AWS_REGION = 'us-east-1';

type Sent = { input: Record<string, any> };
let sent: Sent[] = [];
let reply: (cmd: Sent) => unknown = () => ({});

(BedrockRuntimeClient.prototype as any).send = async function (cmd: Sent) {
  sent.push(cmd);
  const r = reply(cmd);
  if (r instanceof Error) throw r;
  return r;
};

const { handle } = await import('../src/handler.js');
const { handler: lambdaHandler } = await import('../src/lambda.js');

const toolReply = (input: unknown) => ({
  output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name: 'emit_workout', input } }] } },
});
const textReply = (text: string) => ({ output: { message: { role: 'assistant', content: [{ text }] } } });

const goodWorkout = {
  title: 'Quiet Dumbbell Burner',
  coachIntro: 'Let us build some heat without waking the neighbours.',
  exercises: [
    { name: 'Dumbbell Rows', phase: 'main', durationSec: 40, restSec: 15, cue: 'Elbow to hip.', easier: 'Lighter weight.', intensity: 3 },
    { name: 'March in Place', phase: 'warmup', durationSec: 45, restSec: 0, cue: 'Knees up.', easier: 'Slower.', intensity: 1 },
    { name: 'Goblet Squat', phase: 'main', durationSec: 40, restSec: 15, cue: 'Chest tall.', easier: 'To a chair.', intensity: 3 },
    { name: 'Forward Fold', phase: 'cooldown', durationSec: 40, restSec: 0, cue: 'Soft knees.', easier: 'Hands on thighs.', intensity: 1 },
  ],
};

const req = { goal: 'fat-burn', minutes: 15, level: 'beginner', equipment: ['dumbbells'], notes: 'Quiet, apartment friendly: no jumping' };

beforeEach(() => {
  sent = [];
  reply = () => ({});
});

test('workout request to Bedrock is built correctly', async () => {
  reply = () => toolReply(goodWorkout);
  const r = await handle('POST', '/workout', JSON.stringify(req));
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  const input = sent[0].input;
  assert.equal(input.modelId, 'global.amazon.nova-2-lite-v1:0');
  assert.deepEqual(input.toolConfig.toolChoice, { any: {} });
  assert.equal(input.toolConfig.tools[0].toolSpec.name, 'emit_workout');
  assert.ok(input.toolConfig.tools[0].toolSpec.inputSchema.json.properties.exercises);
  assert.match(input.system[0].text, /emit_workout/);
  assert.match(input.system[0].text, /Mountain Climbers, Shadow Boxing/, 'animated move list is in the prompt');
  const prompt: string = input.messages[0].content[0].text;
  assert.match(prompt, /900 seconds/);
  assert.match(prompt, /dumbbells/);
  assert.match(prompt, /no jumping/);
});

test('tool output is parsed, sanitized and re-ordered', async () => {
  reply = () => toolReply(goodWorkout);
  const r = await handle('POST', '/workout', JSON.stringify(req));
  const w = r.body as any;
  assert.equal(w.source, 'bedrock');
  assert.equal(w.title, 'Quiet Dumbbell Burner');
  assert.equal(w.exercises.length, 4);
  assert.deepEqual(w.exercises.map((e: any) => e.phase), ['warmup', 'main', 'main', 'cooldown']);
  assert.equal(w.totalSec, 45 + 55 + 55 + 40);
  assert.equal(w.model, 'global.amazon.nova-2-lite-v1:0');
});

test('Bedrock error falls back to the offline workout', async () => {
  reply = () => Object.assign(new Error('ThrottlingException'), { name: 'ThrottlingException' });
  const r = await handle('POST', '/workout', JSON.stringify(req));
  assert.equal(r.status, 200);
  assert.equal((r.body as any).source, 'fallback');
});

test('a reply without a tool call falls back', async () => {
  reply = () => textReply('Sure! Here is a workout: ...');
  const r = await handle('POST', '/workout', JSON.stringify(req));
  assert.equal((r.body as any).source, 'fallback');
});

test('too few exercises from the model falls back', async () => {
  reply = () => toolReply({ title: 'x', coachIntro: 'y', exercises: [goodWorkout.exercises[0]] });
  const r = await handle('POST', '/workout', JSON.stringify(req));
  assert.equal((r.body as any).source, 'fallback');
});

test('bad input is rejected before calling Bedrock', async () => {
  const r = await handle('POST', '/workout', JSON.stringify({ goal: 'yoga', minutes: 15 }));
  assert.equal(r.status, 400);
  assert.equal(sent.length, 0);
});

test('recap uses Bedrock text', async () => {
  reply = () => textReply('  Strong session. Next time add five minutes.  ');
  const r = await handle('POST', '/recap', JSON.stringify({ title: 'X', completed: 9, skipped: 1, easierUsed: 2, activeSec: 540 }));
  assert.deepEqual(r.body, { text: 'Strong session. Next time add five minutes.', source: 'bedrock' });
  assert.match(sent[0].input.messages[0].content[0].text, /Skipped: 1/);
});

test('empty recap falls back', async () => {
  reply = () => textReply('');
  const r = await handle('POST', '/recap', JSON.stringify({ title: 'X', completed: 3, skipped: 3, easierUsed: 0, activeSec: 120 }));
  assert.equal((r.body as any).source, 'fallback');
  assert.match((r.body as any).text, /easier version instead of skipping/);
});

test('Lambda handler routes Function URL events, including base64 bodies', async () => {
  reply = () => toolReply(goodWorkout);
  const health = await lambdaHandler({ rawPath: '/health', requestContext: { http: { method: 'GET' } } });
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).bedrock, true);

  const res = await lambdaHandler({
    rawPath: '/workout',
    requestContext: { http: { method: 'POST' } },
    isBase64Encoded: true,
    body: Buffer.from(JSON.stringify(req)).toString('base64'),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).source, 'bedrock');
});

test('recap includes form camera results in the prompt', async () => {
  reply = () => textReply('Great squats. Watch your hips on push-ups.');
  await handle('POST', '/recap', JSON.stringify({
    title: 'X', completed: 8, skipped: 0, easierUsed: 0, activeSec: 600,
    form: [{ exercise: 'Bodyweight Squats', reps: 12, goodReps: 11 }, { exercise: 'Push-ups', reps: 10, goodReps: 4, topCue: "Don't let your hips sag." }],
  }));
  const text = sent[0].input.messages[0].content[0].text as string;
  assert.match(text, /Form camera results/);
  assert.match(text, /Push-ups: 4\/10 reps with good form; most common correction: "Don't let your hips sag."/);
  assert.match(sent[0].input.system[0].text, /form camera/);
});

test('offline recap uses form results when Bedrock fails', async () => {
  reply = () => new Error('boom');
  const r = await handle('POST', '/recap', JSON.stringify({
    title: 'X', completed: 8, skipped: 0, easierUsed: 0, activeSec: 600,
    form: [{ exercise: 'Bodyweight Squats', reps: 12, goodReps: 11 }, { exercise: 'Push-ups', reps: 10, goodReps: 4, topCue: "Don't let your hips sag." }],
  }));
  const body = r.body as { text: string; source: string };
  assert.equal(body.source, 'fallback');
  assert.match(body.text, /best form was on Bodyweight Squats/);
  assert.match(body.text, /On Push-ups, remember: Don't let your hips sag\./);
});
