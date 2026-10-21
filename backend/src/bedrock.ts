// Amazon Bedrock integration (AWS Builder mini challenge).
//
// Uses the Bedrock Runtime Converse API. To get reliable JSON back we declare a
// single tool, `emit_workout`, whose input schema is the workout shape, and force
// the model to call it (toolChoice: any). The tool input *is* the workout.

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import type { Workout, WorkoutRequest } from './types.js';
import { sanitizeExercises, totalSeconds } from './validate.js';

export const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'global.amazon.nova-2-lite-v1:0';
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

let client: BedrockRuntimeClient | undefined;
function getClient() {
  client ??= new BedrockRuntimeClient({ region: REGION });
  return client;
}

/** Set USE_BEDROCK=false to force the offline generator (handy for demos without AWS). */
export const bedrockEnabled = () => process.env.USE_BEDROCK !== 'false';

/** Moves the TV app has a dedicated animation for (see app/src/lib/exerciseAnimations.ts). */
export const ANIMATED_MOVES = [
  'March in Place',
  'Arm Circles',
  'Hip Openers',
  'Standing Quad Stretch',
  'Forward Fold',
  'Deep Breathing',
  'Bodyweight Squats',
  'Push-ups',
  'Reverse Lunges',
  'Glute Bridges',
  'Plank Hold',
  'Deep Squat Hold',
  'Jumping Jacks',
  'High Knees',
  'Skater Hops',
  'Mountain Climbers',
  'Shadow Boxing',
  "World's Greatest Stretch",
  'Cat-Cow',
  'Thoracic Rotations',
  'Dumbbell Rows',
  'Dumbbell Shoulder Press',
  'Kettlebell Swings',
  'Band Pull-Aparts',
  'Dumbbell Thrusters',
  'Band Squat to Press',
  'Bicep Curls',
  'Romanian Deadlift',
  'Burpees',
  'Crunches',
  'Dumbbell Halos',
  'Kettlebell Halos',
];

const SYSTEM_PROMPT = `You are FitCoach, an upbeat certified personal trainer designing follow-along home workouts that are shown on a living-room TV.
Rules:
- Structure: 2-4 warmup moves, then main moves, then 2-3 cooldown moves.
- The sum of every durationSec + restSec must be within 60 seconds of the requested total.
- Only use the equipment listed. "none" means bodyweight only.
- Respect the notes (injuries, noise limits, space) and pick safe alternatives.
- Exercise names are short (max 4 words). Cues are one punchy sentence a viewer can read from the couch.
- "easier" is a concrete regression of the same move.
- intensity is 1 (gentle) to 5 (all-out).
- The TV shows an animated demo for each move. Prefer these exact names when they fit the user's goal, equipment and notes: ${ANIMATED_MOVES.join(', ')}.
Always answer by calling the emit_workout tool.`;

const EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    phase: { type: 'string', enum: ['warmup', 'main', 'cooldown'] },
    durationSec: { type: 'integer', minimum: 15, maximum: 120 },
    restSec: { type: 'integer', minimum: 0, maximum: 60 },
    cue: { type: 'string' },
    easier: { type: 'string' },
    intensity: { type: 'integer', minimum: 1, maximum: 5 },
  },
  required: ['name', 'phase', 'durationSec', 'restSec', 'cue', 'easier', 'intensity'],
};

const WORKOUT_TOOL: Tool = {
  toolSpec: {
    name: 'emit_workout',
    description: 'Return the finished workout plan to the TV app.',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Catchy title, max 6 words' },
          coachIntro: { type: 'string', description: 'Two friendly sentences the coach says before starting' },
          exercises: { type: 'array', items: EXERCISE_SCHEMA },
        },
        required: ['title', 'coachIntro', 'exercises'],
      } as never,
    },
  },
};

export async function generateWorkoutWithBedrock(req: WorkoutRequest): Promise<Workout> {
  const prompt = [
    `Goal: ${req.goal}`,
    `Fitness level: ${req.level}`,
    `Total length: ${req.minutes} minutes (${req.minutes * 60} seconds)`,
    `Equipment: ${req.equipment.join(', ')}`,
    req.notes ? `Notes from the user: ${req.notes}` : 'Notes from the user: none',
  ].join('\n');

  const res = await getClient().send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      toolConfig: { tools: [WORKOUT_TOOL], toolChoice: { any: {} } },
      inferenceConfig: { maxTokens: 3000, temperature: 0.7 },
    }),
  );

  const toolUse = res.output?.message?.content?.find((c) => c.toolUse)?.toolUse;
  const input = (toolUse?.input ?? {}) as Record<string, unknown>;
  const exercises = sanitizeExercises(input.exercises);
  if (exercises.length < 3) throw new Error('Model returned too few exercises');

  return {
    id: `br-${Date.now().toString(36)}`,
    title: typeof input.title === 'string' ? input.title.slice(0, 60) : `${req.minutes}-Minute Workout`,
    coachIntro: typeof input.coachIntro === 'string' ? input.coachIntro.slice(0, 300) : "Let's get moving!",
    totalSec: totalSeconds(exercises),
    exercises,
    source: 'bedrock',
    model: MODEL_ID,
  };
}

export interface FormNote {
  exercise: string;
  reps: number;
  goodReps: number;
  /** The correction the camera gave most often, if any. */
  topCue?: string;
}

export interface RecapRequest {
  title: string;
  completed: number;
  skipped: number;
  easierUsed: number;
  activeSec: number;
  goal?: string;
  /** Per-exercise results from the phone form camera, when it was used. */
  form?: FormNote[];
}

const formLines = (form: FormNote[] = []) =>
  form.length
    ? '\nForm camera results:\n' +
      form.map((f) => `- ${f.exercise}: ${f.goodReps}/${f.reps} reps with good form${f.topCue ? `; most common correction: "${f.topCue}"` : ''}`).join('\n')
    : '';

/** Short spoken-style recap + a suggestion for next time. Plain text Converse call. */
export async function generateRecapWithBedrock(r: RecapRequest): Promise<string> {
  const res = await getClient().send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [
        {
          text: 'You are FitCoach, an encouraging trainer. Reply with at most 3 short sentences: celebrate what they did, then one specific suggestion for the next session. If form camera results are given, mention the move with the best form and give one concrete form tip for the weakest move. No emojis, no markdown.',
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `Workout: ${r.title}\nGoal: ${r.goal ?? 'general'}\nExercises completed: ${r.completed}\nSkipped: ${r.skipped}\nUsed the easier option: ${r.easierUsed} times\nActive time: ${Math.round(r.activeSec / 60)} minutes${formLines(r.form)}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 200, temperature: 0.8 },
    }),
  );
  const text = res.output?.message?.content?.find((c) => c.text)?.text?.trim();
  if (!text) throw new Error('Empty recap');
  return text.slice(0, 400);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function fallbackRecap(r: RecapRequest): string {
  const mins = Math.max(1, Math.round(r.activeSec / 60));
  const done = r.completed > 0 ? `Great work: ${plural(r.completed, 'exercise')} and ${plural(mins, 'active minute')} done.` : 'Good start.';
  const next =
    r.skipped > 1
      ? 'Next time, try the easier version instead of skipping so you keep the momentum.'
      : r.easierUsed > 2
        ? 'Next time, try the standard version of one move you scaled today.'
        : 'Next time, bump the level up one notch or add five minutes.';
  const tracked = (r.form ?? []).filter((f) => f.reps > 0);
  if (tracked.length) {
    const rate = (f: FormNote) => f.goodReps / f.reps;
    const best = tracked.reduce((a, b) => (rate(b) > rate(a) ? b : a));
    const worst = tracked.reduce((a, b) => (rate(b) < rate(a) ? b : a));
    const tip = worst !== best && worst.topCue ? ` On ${worst.exercise}, remember: ${worst.topCue}` : '';
    return `${done} Your best form was on ${best.exercise}.${tip}`;
  }
  return `${done} ${next}`;
}
