// Deterministic offline workout builder. Used when Bedrock isn't configured or a
// call fails, so the TV demo never dead-ends on a network error.

import type { Equipment, Exercise, Goal, Workout, WorkoutRequest } from './types.js';
import { totalSeconds } from './validate.js';

type Move = Omit<Exercise, 'phase' | 'durationSec' | 'restSec'> & {
  goals: Goal[];
  needs?: Equipment;
};

const WARMUP: Omit<Exercise, 'phase' | 'durationSec' | 'restSec'>[] = [
  { name: 'March in Place', cue: 'Drive the knees up, swing the arms.', easier: 'Slow, small steps.', intensity: 1 },
  { name: 'Arm Circles', cue: 'Big circles, shoulders down.', easier: 'Smaller circles.', intensity: 1 },
  { name: 'Hip Openers', cue: 'Lift the knee and rotate it out.', easier: 'Hold a wall for balance.', intensity: 1 },
];

const COOLDOWN: Omit<Exercise, 'phase' | 'durationSec' | 'restSec'>[] = [
  { name: 'Standing Quad Stretch', cue: 'Knees together, hips forward.', easier: 'Use a wall for balance.', intensity: 1 },
  { name: 'Forward Fold', cue: 'Soft knees, let the head hang.', easier: 'Hands on thighs.', intensity: 1 },
  { name: 'Deep Breathing', cue: 'In for 4, out for 6.', easier: 'Sit down if you like.', intensity: 1 },
];

const MAIN: Move[] = [
  { name: 'Bodyweight Squats', goals: ['strength', 'fat-burn'], cue: 'Chest up, push the floor away.', easier: 'Squat to a chair.', intensity: 3 },
  { name: 'Push-ups', goals: ['strength'], cue: 'Body in one straight line.', easier: 'Hands on a couch or knees down.', intensity: 4 },
  { name: 'Reverse Lunges', goals: ['strength', 'fat-burn'], cue: 'Step back, front knee over ankle.', easier: 'Shorter step, hold a wall.', intensity: 3 },
  { name: 'Glute Bridges', goals: ['strength', 'mobility'], cue: 'Squeeze at the top for a beat.', easier: 'Smaller lift.', intensity: 2 },
  { name: 'Plank Hold', goals: ['strength', 'fat-burn'], cue: 'Ribs down, squeeze the glutes.', easier: 'Knees down.', intensity: 3 },
  { name: 'Jumping Jacks', goals: ['cardio', 'fat-burn'], cue: 'Land softly, stay light.', easier: 'Step jacks, no jump.', intensity: 4 },
  { name: 'High Knees', goals: ['cardio', 'fat-burn'], cue: 'Knees to hip height, pump the arms.', easier: 'March fast instead.', intensity: 5 },
  { name: 'Skater Hops', goals: ['cardio', 'fat-burn'], cue: 'Land on one leg, reach across.', easier: 'Step side to side.', intensity: 4 },
  { name: 'Mountain Climbers', goals: ['cardio', 'fat-burn'], cue: 'Hips level, quick feet.', easier: 'Hands on a step, slow pace.', intensity: 5 },
  { name: 'Shadow Boxing', goals: ['cardio'], cue: 'Light on your toes, fast hands.', easier: 'Slow punches, feet planted.', intensity: 3 },
  { name: "World's Greatest Stretch", goals: ['mobility'], cue: 'Lunge, rotate, reach to the ceiling.', easier: 'Back knee down.', intensity: 2 },
  { name: 'Cat-Cow', goals: ['mobility'], cue: 'Move one vertebra at a time.', easier: 'Smaller range.', intensity: 1 },
  { name: 'Thoracic Rotations', goals: ['mobility'], cue: 'Follow your hand with your eyes.', easier: 'Lying on your side.', intensity: 1 },
  { name: 'Deep Squat Hold', goals: ['mobility'], cue: 'Heels down, elbows push knees out.', easier: 'Hold a door frame.', intensity: 2 },
  { name: 'Dumbbell Rows', goals: ['strength'], needs: 'dumbbells', cue: 'Pull the elbow to the hip.', easier: 'Lighter weight.', intensity: 3 },
  { name: 'Dumbbell Shoulder Press', goals: ['strength'], needs: 'dumbbells', cue: 'Brace the core, press straight up.', easier: 'Seated, lighter weight.', intensity: 3 },
  { name: 'Kettlebell Swings', goals: ['strength', 'fat-burn', 'cardio'], needs: 'kettlebell', cue: 'Snap the hips, arms just guide.', easier: 'Deadlift the bell instead.', intensity: 5 },
  { name: 'Dumbbell Thrusters', goals: ['fat-burn', 'cardio', 'strength'], needs: 'dumbbells', cue: 'Squat, then drive the weights overhead.', easier: 'Lighter weights, smaller squat.', intensity: 4 },
  { name: 'Dumbbell Halos', goals: ['mobility'], needs: 'dumbbells', cue: 'Circle the weight slowly around your head.', easier: 'Use a lighter weight.', intensity: 1 },
  { name: 'Kettlebell Halos', goals: ['mobility'], needs: 'kettlebell', cue: 'Bell close to the head, ribs down.', easier: 'Hold the bell by the horns, go slower.', intensity: 1 },
  { name: 'Band Squat to Press', goals: ['fat-burn', 'cardio', 'strength'], needs: 'resistance-band', cue: 'Stand on the band, squat, press up.', easier: 'Shorter range, lighter band.', intensity: 3 },
  { name: 'Band Pull-Aparts', goals: ['strength', 'mobility', 'fat-burn'], needs: 'resistance-band', cue: 'Squeeze the shoulder blades.', easier: 'Hold the band wider.', intensity: 2 },
];

const LEVEL = {
  beginner: { work: 30, rest: 20, bump: -1 },
  intermediate: { work: 40, rest: 15, bump: 0 },
  advanced: { work: 45, rest: 10, bump: 1 },
} as const;

export function buildFallbackWorkout(req: WorkoutRequest): Workout {
  const lv = LEVEL[req.level];
  const budget = req.minutes * 60;
  const warmup: Exercise[] = WARMUP.map((m) => ({ ...m, phase: 'warmup', durationSec: 30, restSec: 0 }));
  const cooldown: Exercise[] = COOLDOWN.map((m) => ({ ...m, phase: 'cooldown', durationSec: 30, restSec: 0 }));

  const pool = MAIN.filter(
    (m) => m.goals.includes(req.goal) && (!m.needs || req.equipment.includes(m.needs)),
  );
  // Put equipment moves first so the user sees their kit get used.
  pool.sort((a, b) => Number(!!b.needs) - Number(!!a.needs));

  const main: Exercise[] = [];
  const mainBudget = budget - totalSeconds(warmup) - totalSeconds(cooldown);
  let i = 0;
  while (pool.length && totalSeconds(main) + lv.work + lv.rest <= mainBudget && i < 40) {
    const { goals: _g, needs: _n, ...m } = pool[i % pool.length];
    main.push({
      ...m,
      phase: 'main',
      durationSec: lv.work,
      restSec: lv.rest,
      intensity: Math.max(1, Math.min(5, m.intensity + lv.bump)),
    });
    i++;
  }

  const exercises = [...warmup, ...main, ...cooldown];
  const goalName = req.goal === 'fat-burn' ? 'Fat Burn' : req.goal[0].toUpperCase() + req.goal.slice(1);
  const kit = req.equipment.filter((e) => e !== 'none');
  const kitText = kit.length ? `using your ${kit.join(' and ').replace(/-/g, ' ')}` : 'with no equipment needed';
  return {
    id: `fb-${Date.now().toString(36)}`,
    title: `${req.minutes}-Minute ${goalName}`,
    coachIntro: `${req.level === 'intermediate' ? 'An' : 'A'} ${req.level} ${req.goal.replace('-', ' ')} session ${kitText}. Grab some water and let's go.`,
    totalSec: totalSeconds(exercises),
    exercises,
    source: 'fallback',
  };
}
