// Spoken commands for the workout player ("skip", "wait", "more rest", "easier"…).
// Pure TypeScript so it can be unit-tested and shared by every microphone source:
// the voice remote page (laptop/phone browser) and the browser build's own mic.

export type VoiceCommand =
  | 'skip' | 'pause' | 'resume' | 'restNow' | 'moreRest' | 'lessRest'
  | 'slower' | 'faster' | 'easier' | 'standard' | 'mute' | 'unmute' | 'end';

// Order matters: more specific phrases first ("end workout" before "stop", "skip rest" before "rest").
const RULES: [VoiceCommand, RegExp][] = [
  ['end', /\b(end|finish|quit)( the)? (workout|session)\b|\bi'?m (done|finished)\b|\bstop (the )?(workout|session)\b|\bend workout\b/],
  ['moreRest', /\b(more|longer|extra|increase|add|extend)( the| some| a)? (rest|break|time)\b|\brest (more|longer)\b|\bneed more (rest|time)\b/],
  ['lessRest', /\b(less|shorter|reduce|decrease|cut)( the)? (rest|break)\b|\brest less\b/],
  ['skip', /\b(skip|next( one| exercise| move)?)\b/],
  ['slower', /\bslow(er)?( it)? down\b|\bslower\b|\btoo fast\b|\b(take it|go) slow\b/],
  ['faster', /\bspeed( it)? up\b|\bfaster\b|\btoo slow\b/],
  ['restNow', /\b(rest|break|breather|catch my breath)\b/],
  ['unmute', /\bun ?mute\b|\b(voice|sound) on\b/],
  ['mute', /\bmute\b|\b(voice|sound) off\b|\bbe quiet\b/],
  ['pause', /\b(wait|pause|stop|hold( on)?|freeze)\b/],
  ['resume', /\b(resume|continue|go|start|play|ready|unpause|carry on|let'?s go)\b/],
  ['easier', /\b(easier|easy|too hard|simpler|modify|modified|tired)\b/],
  ['standard', /\b(harder|normal|standard|original|regular)( version| move)?\b/],
];

/** Map a transcript to a command, or null if it isn't one. */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  for (const [cmd, re] of RULES) if (re.test(t)) return cmd;
  return null;
}

/** Commands for the screens around the workout (preview and summary). */
export type ScreenCommand = 'start' | 'newVersion' | 'again' | 'newWorkout' | 'back';
export function parseScreenCommand(transcript: string): ScreenCommand | null {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  if (/\b(new|different|another)( version| one| plan)?\b|\bregenerate\b|\bchange it\b/.test(t) && !/\bnew workout\b/.test(t)) return 'newVersion';
  if (/\bnew workout\b|\bstart over\b|\bhome\b/.test(t)) return 'newWorkout';
  if (/\b(again|repeat|one more time)\b/.test(t)) return 'again';
  if (/\b(back|go back|cancel)\b/.test(t)) return 'back';
  if (/\b(start|begin|go|let'?s go|ready|play|let'?s do it)\b/.test(t)) return 'start';
  return null;
}

/** Seconds added or removed by "more rest" / "less rest". */
export const REST_STEP_SEC = 15;
