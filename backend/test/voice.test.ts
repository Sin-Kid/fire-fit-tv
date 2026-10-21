import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScreenCommand, parseVoiceCommand } from '../../apps/FireFitTV/src/lib/voiceCommands.ts';

process.env.USE_BEDROCK = 'false';
const { handle } = await import('../src/handler.js');

const cases: [string, ReturnType<typeof parseVoiceCommand>][] = [
  ['skip', 'skip'], ['Next.', 'skip'], ['skip this one', 'skip'], ['next exercise please', 'skip'],
  ['wait', 'pause'], ['Pause!', 'pause'], ['hold on', 'pause'], ['stop', 'pause'],
  ['go', 'resume'], ['resume', 'resume'], ["let's go", 'resume'], ['continue', 'resume'],
  ['more rest', 'moreRest'], ['increase rest', 'moreRest'], ['I need a break', 'restNow'], ['rest', 'restNow'], ['take a rest', 'restNow'], ['slow down', 'slower'], ['too fast', 'slower'], ['speed up', 'faster'], ['skip the rest', 'skip'], ['add some rest', 'moreRest'], ['longer rest', 'moreRest'],
  ['less rest', 'lessRest'], ['shorter rest', 'lessRest'], ['reduce the rest', 'lessRest'],
  ['easier', 'easier'], ['make it easy', 'easier'], ['this is too hard', 'easier'],
  ['normal', 'standard'], ['harder', 'standard'],
  ['mute', 'mute'], ['unmute', 'unmute'], ['voice on', 'unmute'],
  ['end workout', 'end'], ["I'm done", 'end'], ['stop the workout', 'end'], ['finish the session', 'end'],
  ['what a nice day', null], ['', null],
];
for (const [said, want] of cases) {
  test(`voice: "${said}" → ${want}`, () => assert.equal(parseVoiceCommand(said), want));
}

const screen: [string, ReturnType<typeof parseScreenCommand>][] = [
  ['start start', 'start'], ["let's go", 'start'], ['begin', 'start'], ['new version', 'newVersion'], ['give me a different one', 'newVersion'],
  ['do it again', 'again'], ['new workout', 'newWorkout'], ['go back', 'back'], ['hello there', null],
];
for (const [said, want] of screen) test(`screen voice: "${said}" → ${want}`, () => assert.equal(parseScreenCommand(said), want));

test('voice remote: page is served and phrases reach the TV session in order', async () => {
  const page = await handle('GET', '/voice', undefined);
  assert.equal(page.status, 200);
  assert.match(String(page.body), /Voice Remote/);

  const created = await handle('POST', '/session', undefined);
  const { code, voicePath } = created.body as { code: string; voicePath: string };
  assert.equal(voicePath, `/voice?code=${code}`);

  let s = (await handle('GET', `/session/${code}`, undefined)).body as { voiceConnected: boolean; voice: unknown[] };
  assert.equal(s.voiceConnected, false);

  assert.equal((await handle('POST', `/session/${code}/voice`, JSON.stringify({}))).status, 200); // heartbeat
  for (const heard of ['wait', 'go', 'more rest']) await handle('POST', `/session/${code}/voice`, JSON.stringify({ heard }));
  s = (await handle('GET', `/session/${code}`, undefined)).body as { voiceConnected: boolean; voice: { id: number; text: string }[] };
  assert.equal(s.voiceConnected, true);
  assert.deepEqual(s.voice.map((v) => v.text), ['wait', 'go', 'more rest']);
  assert.ok(s.voice[0].id < s.voice[1].id && s.voice[1].id < s.voice[2].id, 'ids strictly increase');

  for (let i = 0; i < 12; i++) await handle('POST', `/session/${code}/voice`, JSON.stringify({ heard: `skip ${i}` }));
  s = (await handle('GET', `/session/${code}`, undefined)).body as { voiceConnected: boolean; voice: { id: number; text: string }[] };
  assert.equal(s.voice.length, 8, 'keeps only the latest 8 phrases');

  assert.equal((await handle('POST', '/session/0000/voice', JSON.stringify({ heard: 'skip' }))).status, 404);
});
