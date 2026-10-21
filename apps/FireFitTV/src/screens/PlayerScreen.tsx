import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CoachCaption } from '../components/CoachCaption';
import { FocusButton } from '../components/FocusButton';
import { ExerciseFigure } from '../components/ExerciseFigure';
import { IntensityBar } from '../components/IntensityBar';
import { formNotes, setCoachExercise, type CueKind } from '../lib/coachApi';
import { kcalPerSec, metFor, REST_MET } from '../lib/calories';
import { GET_READY_SEC } from '../lib/config';
import { tvStyles, u } from '../lib/scale';
import { coachKeyFor, countsReps } from '../lib/exerciseAnimations';
import { hasVoice, say, setVoiceEnabled } from '../lib/speech';
import { useFormCoach } from '../lib/useFormCoach';
import { parseVoiceCommand, REST_STEP_SEC, type VoiceCommand } from '../lib/voiceCommands';
import { useWebMic, webMicAvailable } from '../lib/useWebMic';
import { useLaptopCoach } from '../lib/useLaptopCoach';
import { colors, formatClock, phaseColor, phaseLabel, type as t } from '../lib/theme';
import type { Exercise, Profile, Workout } from '../lib/types';

type Segment =
  | { kind: 'ready'; sec: number; next: Exercise }
  | { kind: 'work'; sec: number; ex: Exercise; index: number }
  | { kind: 'rest'; sec: number; next: Exercise };

export interface SessionStats {
  completed: number;
  skipped: number;
  easierUsed: number;
  activeSec: number;
  total: number;
  /** Estimated calories burned (work + rest, not pauses). */
  kcal: number;
  /** Laptop-camera form results, when the laptop's webcam coached this session. */
  form?: ReturnType<typeof formNotes>;
}

function announcementFor(s: Segment): string {
  if (s.kind === 'ready') return `Get ready. First up: ${s.next.name}.`;
  if (s.kind === 'work') return `${s.ex.name}. ${s.ex.durationSec} seconds. ${s.ex.cue}`;
  return `Rest. Next up: ${s.next.name}.`;
}

function buildSegments(w: Workout): Segment[] {
  const segs: Segment[] = [{ kind: 'ready', sec: GET_READY_SEC, next: w.exercises[0] }];
  w.exercises.forEach((ex, index) => {
    segs.push({ kind: 'work', sec: ex.durationSec, ex, index });
    const next = w.exercises[index + 1];
    if (ex.restSec > 0 && next) segs.push({ kind: 'rest', sec: ex.restSec, next });
  });
  return segs;
}

export function PlayerScreen({ workout, profile, coachCode = null, laptop = false, onFinish }: { workout: Workout; profile: Profile; coachCode?: string | null; laptop?: boolean; onFinish: (s: SessionStats) => void }) {
  // A rest can be inserted by voice ("rest"), so the segment list is state, mirrored in a ref for handlers.
  const [segments, setSegments] = useState(() => buildSegments(workout));
  const segsRef = useRef(segments);
  const [figureSpeed, setFigureSpeed] = useState(1);
  const [segIdx, setSegIdx] = useState(0);
  const [remaining, setRemaining] = useState(segments[0].sec);
  const [paused, setPaused] = useState(false);
  const [showEasier, setShowEasier] = useState(false);
  const [cue, setCue] = useState<{ text: string; kind: CueKind } | null>(null);
  const [voice, setVoice] = useState(true);

  // Phone form camera: caption + speak every new cue. Voice remote: run spoken commands.
  const heardRef = useRef<(text: string) => void>(() => undefined);
  const coach = useFormCoach(
    coachCode,
    (text, kind) => {
      setCue({ text, kind });
      say(text);
    },
    (heard) => heardRef.current(heard),
  );
  // Laptop mode: the browser's mic listens from the start (the Start press already asked for it).
  const [micOn, setMicOn] = useState(laptop);
  const [voiceNote, setVoiceNote] = useState<{ text: string; id: number } | null>(null);
  useWebMic(micOn, (heard) => heardRef.current(heard));
  const seg0 = segments[segIdx];
  const laptopCoach = useLaptopCoach({
    enabled: laptop,
    hostId: 'fitcoach-laptop-cam',
    exercise: seg0.kind === 'work' && !paused ? { name: seg0.ex.name, key: coachKeyFor(seg0.ex.name, seg0.ex.phase) } : null,
    onCue: (text, kind) => {
      setCue({ text, kind });
      say(text);
    },
  });
  const cameraLive = laptop ? laptopCoach.status === 'live' : !!coach?.phoneConnected && !!coach?.camera;
  const liveReps = laptop ? laptopCoach.reps : coach?.live?.reps ?? 0;
  const [noVoice, setNoVoice] = useState(false);
  useEffect(() => {
    let alive = true;
    hasVoice().then((ok) => alive && setNoVoice(!ok));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useRef<SessionStats>({ completed: 0, skipped: 0, easierUsed: 0, activeSec: 0, total: workout.exercises.length, kcal: 0 });
  const [kcal, setKcal] = useState(0);
  const easierNow = useRef(false);
  const easierCounted = useRef<Set<number>>(new Set());
  /**
   * The timer's source of truth. It lives in a ref (updated synchronously) rather
   * than in state, so several ticks that fire before React re-renders — common on
   * a busy TV stick — each see the latest values and a segment can't end twice.
   * `last` is the wall-clock time of the previous tick; 0 means "start measuring
   * on the next tick".
   */
  const timer = useRef({ idx: 0, left: segments[0].sec, last: 0, finished: false });
  /** Length of the current segment (rest can be stretched by voice). */
  const [segTotal, setSegTotal] = useState(segments[0].sec);
  /** Extra rest asked for during a move, added to the next rest. */
  const extraRest = useRef(0);
  const lastSpoken = useRef('');
  const noteSeq = useRef(0);
  const tick = useRef<() => void>(() => {});

  const seg = segments[segIdx];

  const finish = () => {
    if (timer.current.finished) return;
    timer.current.finished = true;
    onFinish({ ...stats.current, activeSec: Math.round(stats.current.activeSec), kcal: Math.round(stats.current.kcal), form: laptop ? laptopCoach.notes() : undefined });
  };

  const advance = (how: 'natural' | 'skip') => {
    const t = timer.current;
    if (t.finished) return;
    const cur = segsRef.current[t.idx];
    if (cur.kind === 'work') {
      if (how === 'natural') stats.current.completed++;
      else stats.current.skipped++;
    }
    if (t.idx + 1 >= segsRef.current.length) return finish();
    t.idx += 1;
    t.left = segsRef.current[t.idx].sec;
    if (segsRef.current[t.idx].kind === 'rest' && extraRest.current) {
      t.left += extraRest.current;
      extraRest.current = 0;
    }
    setSegTotal(t.left);
    t.last = 0;
    setSegIdx(t.idx);
    setRemaining(t.left);
    setShowEasier(false);
    easierNow.current = false;
    setCue(null);
  };

  const setPausedTo = (p: boolean) => {
    timer.current.last = 0; // don't count the paused gap as workout time
    setPaused(p);
  };
  const togglePause = () => setPausedTo(!paused);

  // Keep the interval's callback pointed at the latest props/handlers.
  useEffect(() => {
    tick.current = () => {
      const t = timer.current;
      if (t.finished) return;
      const now = Date.now();
      const dt = t.last ? (now - t.last) / 1000 : 0;
      t.last = now;
      const cur = segsRef.current[t.idx];
      const spent = Math.min(dt, Math.max(0, t.left));
      if (cur.kind === 'work') stats.current.activeSec += spent;
      if (cur.kind !== 'ready') {
        const met = cur.kind === 'work' ? metFor(cur.ex, easierNow.current) : REST_MET;
        stats.current.kcal += kcalPerSec(profile, met) * spent;
        setKcal(stats.current.kcal);
      }
      t.left -= dt;
      if (t.left <= 0) advance('natural');
      else setRemaining(t.left);
    };
  });

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => tick.current(), 200);
    return () => clearInterval(id);
  }, [paused]);

  // Coaching line for the current segment: spoken when the device has a voice, captioned otherwise.
  const announcement = announcementFor(segments[segIdx]);
  useEffect(() => {
    lastSpoken.current = announcementFor(segments[segIdx]);
    say(lastSpoken.current);
  }, [segIdx, segments]);

  // Tell the phone which move is on screen (nothing during rest, get-ready or pause).
  useEffect(() => {
    if (!coachCode) return;
    const s = segments[segIdx];
    setCoachExercise(
      coachCode,
      s.kind === 'work' && !paused ? { name: s.ex.name, key: coachKeyFor(s.ex.name, s.ex.phase), phase: s.ex.phase, index: s.index } : null,
    );
  }, [coachCode, segIdx, paused, segments]);
  useEffect(() => () => {
    if (coachCode) setCoachExercise(coachCode, null);
  }, [coachCode]);

  const setVoiceTo = (on: boolean) => {
    setVoiceEnabled(on);
    setVoice(on);
  };
  const toggleVoice = () => setVoiceTo(!voice);

  const confirm = (text: string) => {
    setVoiceNote({ text, id: ++noteSeq.current });
    lastSpoken.current = text;
    say(text);
  };

  /** A phrase from a microphone (voice remote page or the browser's own mic). */
  const onHeard = (heard: string) => {
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const h = norm(heard);
    // Ignore the TV's own coaching voice if the mic picks it up (longer phrases it just said).
    if (!h || (h.split(' ').length >= 3 && ` ${norm(lastSpoken.current)} `.includes(` ${h} `))) return;
    const cmd = parseVoiceCommand(heard);
    if (!cmd) return setVoiceNote({ text: `Heard “${heard.trim()}”. Try “skip”, “wait”, “more rest” or “easier”.`, id: ++noteSeq.current });
    runCommand(cmd);
  };

  const runCommand = (cmd: VoiceCommand) => {
    const t = timer.current;
    if (t.finished) return;
    const cur = segsRef.current[t.idx];
    switch (cmd) {
      case 'skip':
        confirm(cur.kind === 'rest' ? 'Skipping the rest.' : 'Skipping.');
        return advance('skip');
      case 'pause':
        if (!paused) setPausedTo(true);
        return confirm('Paused. Say go when you are ready.');
      case 'resume':
        if (paused) setPausedTo(false);
        return confirm("Let's go.");
      case 'restNow': {
        if (cur.kind === 'rest') {
          t.left += REST_STEP_SEC;
          setRemaining(t.left);
          setSegTotal((x) => x + REST_STEP_SEC);
          return confirm(`Take ${REST_STEP_SEC} more seconds.`);
        }
        const upcoming = segsRef.current.slice(t.idx + 1).find((x) => x.kind === 'work');
        if (!upcoming) {
          confirm('Last move. Ending the workout.');
          return finish();
        }
        // Rest right now: if a rest comes next, stretch it; otherwise insert one.
        const nextSeg = segsRef.current[t.idx + 1];
        if (nextSeg?.kind === 'rest') extraRest.current += REST_STEP_SEC;
        else {
          const next = [...segsRef.current];
          next.splice(t.idx + 1, 0, { kind: 'rest', sec: 20, next: upcoming.kind === 'work' ? upcoming.ex : workout.exercises[0] });
          segsRef.current = next;
          setSegments(next);
        }
        confirm('Taking a rest now.');
        return advance('skip');
      }
      case 'slower':
        setFigureSpeed(0.6);
        if (cur.kind === 'work' && !showEasier) toggleEasier();
        return confirm(cur.kind === 'work' ? `Slowing down. ${cur.ex.easier}` : 'OK, slower demos from here.');
      case 'faster':
        setFigureSpeed(1);
        if (cur.kind === 'work' && showEasier) toggleEasier();
        return confirm('Back to full pace.');
      case 'moreRest':
        if (cur.kind === 'rest') {
          t.left += REST_STEP_SEC;
          setRemaining(t.left);
          setSegTotal((x) => x + REST_STEP_SEC);
          return confirm(`Adding ${REST_STEP_SEC} seconds of rest.`);
        }
        extraRest.current += REST_STEP_SEC;
        return confirm(`OK, ${extraRest.current} seconds extra on your next rest.`);
      case 'lessRest':
        if (cur.kind === 'rest') {
          t.left = Math.max(3, t.left - REST_STEP_SEC);
          setRemaining(t.left);
          return confirm(`Rest cut by ${REST_STEP_SEC} seconds.`);
        }
        extraRest.current = Math.max(-REST_STEP_SEC * 4, extraRest.current - REST_STEP_SEC);
        return confirm('OK, shorter rest next time.');
      case 'easier':
        if (cur.kind === 'work' && !showEasier) toggleEasier();
        return confirm(cur.kind === 'work' ? `Easier version: ${cur.ex.easier}` : 'I will show the easier version when the move starts.');
      case 'standard':
        if (cur.kind === 'work' && showEasier) toggleEasier();
        return confirm('Back to the standard move.');
      case 'mute':
        confirm('Voice off.');
        return setVoiceTo(false);
      case 'unmute':
        setVoiceTo(true);
        return confirm('Voice on.');
      case 'end':
        return finish();
    }
  };

  useEffect(() => {
    heardRef.current = onHeard;
  });

  // Hide the voice confirmation after a few seconds.
  useEffect(() => {
    if (!voiceNote) return;
    const id = setTimeout(() => setVoiceNote((n) => (n?.id === voiceNote.id ? null : n)), 4000);
    return () => clearTimeout(id);
  }, [voiceNote]);

  const toggleEasier = () => {
    if (seg.kind !== 'work') return;
    easierNow.current = !showEasier;
    setShowEasier((v) => !v);
    if (!easierCounted.current.has(seg.index)) {
      easierCounted.current.add(seg.index);
      stats.current.easierUsed++;
    }
  };

  const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(segTotal, 1)));
  const exerciseNo = seg.kind === 'work' ? seg.index + 1 : seg.next ? workout.exercises.indexOf(seg.next) + 1 : 0;
  const upNext =
    seg.kind === 'work' ? workout.exercises[seg.index + 1] : undefined;
  const accent =
    seg.kind === 'work' ? phaseColor(seg.ex.phase) : seg.kind === 'rest' ? colors.rest : colors.accent;

  return (
    <View style={styles.root}>
      {/* Overall progress across the whole workout */}
      <View style={styles.timeline}>
        {workout.exercises.map((e, i) => {
          const done = seg.kind === 'work' ? i < seg.index : i < exerciseNo - 1;
          const current = seg.kind === 'work' && i === seg.index;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                { flex: e.durationSec, backgroundColor: done || current ? phaseColor(e.phase) : colors.border, opacity: current ? 1 : done ? 0.55 : 1 },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.body}>
        <View style={styles.figure}>
          {seg.kind === 'work' ? (
            <ExerciseFigure name={seg.ex.name} phase={seg.ex.phase} color={accent} size={laptop ? 300 : 440} speed={figureSpeed} playing={!paused} />
          ) : (
            <ExerciseFigure
              name={seg.next.name}
              phase={seg.next.phase}
              color={phaseColor(seg.next.phase)}
              size={laptop ? 300 : 440}
              speed={0.6}
              playing={!paused}
              style={{ opacity: 0.7 }}
            />
          )}
          {laptop ? (
            <View style={styles.cam}>
              <View nativeID="fitcoach-laptop-cam" style={styles.camHost} />
              {laptopCoach.status !== 'live' ? (
                <Text style={styles.camMsg}>{laptopCoach.error ?? (laptopCoach.status === 'starting' ? 'Starting camera…' : 'Camera off')}</Text>
              ) : null}
            </View>
          ) : null}
          {cameraLive && seg.kind === 'work' && (laptop || coach?.live?.exercise === seg.ex.name) && countsReps(coachKeyFor(seg.ex.name, seg.ex.phase)) ? (
            <Text style={[styles.reps, { color: accent }]}>
              {liveReps} <Text style={styles.repsLabel}>{liveReps === 1 ? 'rep' : 'reps'}</Text>
            </Text>
          ) : null}
        </View>
        <View style={styles.main}>
          {seg.kind === 'work' ? (
            <>
              <Text style={[styles.phase, { color: accent }]}>
                {phaseLabel[seg.ex.phase]} · {seg.index + 1} of {workout.exercises.length}
              </Text>
              <Text style={styles.name}>{seg.ex.name}</Text>
              <Text style={styles.cue}>{showEasier ? `Easier: ${seg.ex.easier}` : seg.ex.cue}</Text>
              <View style={{ marginTop: u(28) }}>
                <IntensityBar level={seg.ex.intensity} color={accent} />
              </View>
            </>
          ) : seg.kind === 'rest' ? (
            <>
              <Text style={[styles.phase, { color: colors.rest }]}>REST · BREATHE</Text>
              <Text style={styles.nameDim}>Up next</Text>
              <Text style={styles.name}>{seg.next.name}</Text>
              <Text style={styles.cue}>{seg.next.cue}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.phase, { color: colors.accent }]}>GET READY</Text>
              <Text style={styles.name}>{workout.title}</Text>
              <Text style={styles.cue}>First up: {seg.next.name}</Text>
            </>
          )}
        </View>

        <View style={styles.clockCol}>
          <Text style={[styles.clock, { color: accent }]}>{formatClock(remaining)}</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
          </View>
          <View style={styles.kcalBox}>
            <Text style={styles.kcalValue}>{Math.floor(kcal)}</Text>
            <Text style={styles.kcalLabel}>KCAL{'\n'}BURNED (EST.)</Text>
          </View>
          {paused ? <Text style={styles.paused}>PAUSED</Text> : null}
          {upNext ? <Text style={styles.next}>Next: {upNext.name}</Text> : null}
          {noVoice ? <Text style={styles.noVoice}>No speech voice on this device, so coaching is captioned.</Text> : null}
          {cameraLive ? (
            <View style={styles.camChip}>
              <View style={styles.camDot} />
              <Text style={styles.camText}>Form camera live</Text>
            </View>
          ) : null}
        </View>
      </View>

      {voiceNote ? (
        <CoachCaption text={voiceNote.text} kind="good" label="VOICE" />
      ) : cameraLive && cue ? (
        <CoachCaption text={cue.text} kind={cue.kind} />
      ) : (
        <CoachCaption text={noVoice ? announcement : null} kind="info" label="COACH" />
      )}

      <View style={styles.controls}>
        <FocusButton label={paused ? 'Resume' : 'Pause'} onPress={togglePause} autoFocus primary={paused} />
        {seg.kind === 'work' ? <FocusButton label={showEasier ? 'Standard move' : 'Make it easier'} onPress={toggleEasier} /> : null}
        <FocusButton label={seg.kind === 'work' ? 'Skip' : 'Skip rest'} onPress={() => advance('skip')} />
        {!noVoice ? <FocusButton label={voice ? 'Voice on' : 'Voice off'} onPress={toggleVoice} /> : null}
        {webMicAvailable() ? <FocusButton label={micOn ? 'Mic on' : 'Mic off'} selected={micOn} onPress={() => setMicOn((m) => !m)} /> : null}
        <FocusButton label="End workout" onPress={finish} />
      </View>
    </View>
  );
}

const styles = tvStyles({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 96, paddingTop: 54, paddingBottom: 48 },
  timeline: { flexDirection: 'row', height: 12, marginBottom: 24 },
  tick: { marginRight: 4, borderRadius: 6 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  figure: { width: 460, alignItems: 'center', marginRight: 24 },
  main: { flex: 1, paddingRight: 32 },
  phase: { fontSize: t.body, fontWeight: '900', letterSpacing: 3 },
  name: { color: colors.text, fontSize: 80, fontWeight: '900', letterSpacing: -2, marginTop: 8, lineHeight: 86 },
  nameDim: { color: colors.textDim, fontSize: t.h2, marginTop: 12 },
  cue: { color: colors.textDim, fontSize: t.h2 - 6, marginTop: 20, lineHeight: 46 },
  clockCol: { width: 500, alignItems: 'center' },
  clock: { fontSize: 200, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -6 },
  bar: { width: '80%', height: 16, borderRadius: 8, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 8 },
  paused: { color: colors.text, fontSize: t.h2, fontWeight: '900', letterSpacing: 6, marginTop: 24 },
  next: { color: colors.textDim, fontSize: t.body, marginTop: 24 },
  controls: { flexDirection: 'row', justifyContent: 'center' },
  cam: { width: 400, height: 300, marginTop: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camHost: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  camMsg: { color: colors.textDim, fontSize: 22, textAlign: 'center', paddingHorizontal: 20 },
  reps: { fontSize: 64, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },
  repsLabel: { fontSize: 28, fontWeight: '700', color: colors.textDim },
  camChip: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: colors.border },
  camDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger, marginRight: 10 },
  camText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  kcalBox: { flexDirection: 'row', alignItems: 'center', marginTop: 28, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
  kcalValue: { color: colors.text, fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'], marginRight: 16, minWidth: 110, textAlign: 'right' },
  kcalLabel: { color: colors.warmup, fontSize: 18, fontWeight: '900', letterSpacing: 2, lineHeight: 24 },
  noVoice: { color: colors.warmup, fontSize: 18, marginTop: 16, textAlign: 'center' },
});
