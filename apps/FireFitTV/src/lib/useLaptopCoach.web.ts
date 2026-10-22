// Laptop mode: the browser build uses the computer's own webcam and runs MediaPipe
// Pose Landmarker right here (no phone needed). Same form rules as the phone companion
// (lib/formRules.ts is a copy of backend/src/coach/formRules.ts, kept identical by a test).
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { formNotes } from './coachApi';
import { FormCoach, LandmarkFilter, type CoachSummary, type CueKind, type Landmark } from './formRules';

const MP_VERSION = '0.10.21';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODELS = {
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};
const FPS = 30;
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

type PoseSource = (t: number) => Landmark[] | null;
type W = Window & { __poseSource?: PoseSource };

// Load MediaPipe from its CDN at runtime (kept out of the app bundle).
const importUrl = (url: string): Promise<any> => import(/* webpackIgnore: true */ /* @vite-ignore */ url);

async function loadLandmarker(kind: 'full' | 'lite') {
  const { FilesetResolver, PoseLandmarker } = await importUrl(`${MP_BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const opts = (delegate: string) => ({
    baseOptions: { modelAssetPath: MODELS[kind], delegate },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.6,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch {
    return await PoseLandmarker.createFromOptions(fileset, opts('CPU'));
  }
}

/** True in a browser that has a camera (a laptop), where the app can coach form by itself. */
export async function detectLaptopCamera(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if ((window as W).__poseSource) return true;
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices?.();
    return !!devices?.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

export type LaptopStatus = 'off' | 'starting' | 'live' | 'error';

/**
 * Runs the webcam + pose model while `enabled`, coaching `exercise` (null during rests
 * and pauses). The camera preview is drawn into the element with id `hostId`.
 */
export function useLaptopCoach(opts: {
  enabled: boolean;
  hostId: string;
  exercise: { name: string; key: string } | null;
  onCue: (text: string, kind: CueKind) => void;
}) {
  const [status, setStatus] = useState<LaptopStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [repState, setRepState] = useState<{ ex: string; reps: number }>({ ex: '', reps: 0 });
  const cueRef = useRef(opts.onCue);
  useEffect(() => {
    cueRef.current = opts.onCue;
  });
  const st = useRef({
    coach: null as FormCoach | null,
    stats: {} as Record<string, CoachSummary>,
    aspect: 4 / 3,
    running: false,
  });

  const closeCoach = () => {
    const s = st.current;
    if (!s.coach) return;
    const sum = s.coach.summary();
    if (sum.reps || sum.holdSec) {
      const prev = s.stats[sum.exercise];
      s.stats[sum.exercise] = prev
        ? { ...sum, reps: prev.reps + sum.reps, goodReps: prev.goodReps + sum.goodReps, holdSec: prev.holdSec + sum.holdSec, cues: Object.fromEntries([...new Set([...Object.keys(prev.cues), ...Object.keys(sum.cues)])].map((k) => [k, (prev.cues[k] ?? 0) + (sum.cues[k] ?? 0)])) }
        : sum;
    }
    s.coach = null;
  };

  // Camera + model lifecycle.
  useEffect(() => {
    if (!opts.enabled || Platform.OS !== 'web') return;
    let alive = true;
    const s = st.current;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let landmarker: any = null;
    let raf = 0;
    const fImg = new LandmarkFilter();
    const fWorld = new LandmarkFilter();
    const perf = { n: 0, ms: 0, kind: 'full' as 'full' | 'lite', switching: false };

    const draw = (lms: Landmark[] | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!lms) return;
      const X = (p: Landmark) => p.x * canvas!.width;
      const Y = (p: Landmark) => p.y * canvas!.height;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#C6F432';
      for (const [a, b] of BONES) {
        if ((lms[a].visibility ?? 1) < 0.4 || (lms[b].visibility ?? 1) < 0.4) continue;
        ctx.beginPath();
        ctx.moveTo(X(lms[a]), Y(lms[a]));
        ctx.lineTo(X(lms[b]), Y(lms[b]));
        ctx.stroke();
      }
    };

    let last = 0;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - last < 1000 / FPS) return;
      last = now;
      const source = (window as W).__poseSource;
      let lms: Landmark[] | null = null;
      let world: Landmark[] | null = null;
      if (source) lms = source(now);
      else if (landmarker && video && video.readyState >= 2) {
        const t0 = performance.now();
        const res = landmarker.detectForVideo(video, now);
        lms = res.landmarks?.[0] ?? null;
        world = res.worldLandmarks?.[0] ?? null;
        perf.ms += performance.now() - t0;
        perf.n++;
        if (perf.n === 45) {
          // The full model is steadier; drop to lite once if this computer can't keep up.
          if (perf.kind === 'full' && perf.ms / perf.n > 80 && !perf.switching) {
            perf.switching = true;
            loadLandmarker('lite').then((m) => {
              landmarker?.close?.();
              landmarker = m;
              perf.kind = 'lite';
            }).catch(() => undefined);
          }
          perf.n = 0;
          perf.ms = 0;
        }
      }
      if (world && lms) world = world.map((p, i) => ({ ...p, visibility: lms![i]?.visibility }));
      lms = fImg.apply(lms, now);
      world = fWorld.apply(world, now);
      draw(lms);
      if (!s.coach) return;
      for (const e of s.coach.update(lms, now, world)) {
        if (e.type === 'rep') setRepState({ ex: s.coach.exercise, reps: e.reps });
        else cueRef.current(e.text, e.kind);
      }
    };

    (async () => {
      setStatus('starting');
      setError(null);
      try {
        const host = document.getElementById(opts.hostId);
        if (!(window as W).__poseSource) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
          if (!alive) return;
          video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', borderRadius: 'inherit' });
          host?.appendChild(video);
          await video.play();
          s.aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3;
          landmarker = await loadLandmarker('full');
          if (!alive) return;
        }
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', transform: 'scaleX(-1)' });
        host?.appendChild(canvas);
        s.running = true;
        setStatus('live');
        loop();
      } catch (e) {
        if (!alive) return;
        const err = e as Error;
        setStatus('error');
        setError(err.name === 'NotAllowedError' ? 'Camera blocked. Allow it in the address bar.' : err.name === 'NotFoundError' ? 'No camera found.' : "Couldn't start the camera.");
      }
    })();

    return () => {
      alive = false;
      s.running = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      video?.remove();
      canvas?.remove();
      landmarker?.close?.();
      setStatus('off');
    };
  }, [opts.enabled, opts.hostId]);

  // A fresh coach for every move.
  const exName = opts.exercise?.name ?? null;
  const exKey = opts.exercise?.key ?? null;
  useEffect(() => {
    if (!opts.enabled) return;
    closeCoach();
    if (exName && exKey) st.current.coach = new FormCoach(exName, exKey, { aspect: st.current.aspect });
  }, [opts.enabled, exName, exKey]);
  const reps = repState.ex === exName ? repState.reps : 0;

  /** Per-move results for the coach recap. */
  const notes = () => {
    closeCoach();
    return formNotes(st.current.stats);
  };

  return { status, error, reps, notes };
}
