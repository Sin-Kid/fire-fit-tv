"use strict";
var FormRules = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/coach/formRules.ts
  var formRules_exports = {};
  __export(formRules_exports, {
    COUNTS_REPS: () => COUNTS_REPS,
    FormCoach: () => FormCoach,
    LandmarkFilter: () => LandmarkFilter,
    angle: () => angle,
    familyFor: () => familyFor
  });
  var NOSE = 0;
  var SIDE = {
    left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
    right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 }
  };
  var FAMILY = {
    squat: "squat",
    thruster: "squat",
    bandSquatPress: "squat",
    deepSquat: "deepSquat",
    lunge: "lunge",
    pushup: "pushup",
    plank: "plank",
    climbers: "climbers",
    bridge: "bridge",
    jacks: "jacks",
    highKnees: "highKnees",
    march: "march",
    curl: "curl",
    press: "press",
    deadlift: "hinge",
    kbSwing: "hinge",
    row: "row",
    pullApart: "pullApart",
    boxing: "boxing",
    skater: "skater",
    burpee: "burpee",
    crunch: "crunch",
    dbHalo: "halo",
    kbHalo: "halo",
    armCircles: "circles",
    wgs: "stretch",
    catCow: "stretch",
    thoracic: "stretch",
    quadStretch: "stretch",
    forwardFold: "stretch",
    breathing: "stretch",
    hipOpeners: "stretch"
  };
  var familyFor = (key) => {
    var _a;
    return (_a = FAMILY[key]) != null ? _a : "active";
  };
  var COUNTS_REPS = (f) => !["plank", "deepSquat", "stretch", "active"].includes(f);
  var NEEDS = {
    squat: ["shoulder", "hip", "knee", "ankle"],
    deepSquat: ["hip", "knee", "ankle"],
    lunge: ["shoulder", "hip", "knee", "ankle"],
    pushup: ["shoulder", "elbow", "wrist", "hip", "ankle"],
    plank: ["shoulder", "hip", "ankle"],
    climbers: ["shoulder", "hip", "knee"],
    bridge: ["shoulder", "hip", "knee"],
    jacks: ["shoulder", "wrist", "ankle"],
    highKnees: ["shoulder", "hip", "knee"],
    march: ["shoulder", "hip", "knee"],
    curl: ["shoulder", "elbow", "wrist"],
    press: ["shoulder", "elbow", "wrist"],
    hinge: ["shoulder", "hip", "knee"],
    row: ["shoulder", "elbow", "wrist", "hip"],
    pullApart: ["shoulder", "wrist"],
    burpee: ["shoulder", "hip", "ankle"],
    skater: ["shoulder", "hip"],
    crunch: ["shoulder", "hip", "knee"],
    circles: ["shoulder", "wrist"],
    boxing: ["shoulder", "elbow", "wrist"],
    halo: ["shoulder", "wrist"],
    active: ["shoulder", "hip"],
    stretch: ["shoulder", "hip"]
  };
  var POSTURE = {
    squat: "squatting",
    lunge: "squatting",
    jacks: "upright",
    march: "upright",
    highKnees: "upright",
    curl: "upright",
    press: "upright",
    pullApart: "upright",
    boxing: "upright",
    skater: "squatting",
    circles: "upright",
    halo: "upright",
    bridge: "lying",
    crunch: "lying",
    pushup: "prone",
    climbers: "prone"
  };
  var MIN_REP_MS = {
    squat: 500,
    lunge: 500,
    pushup: 400,
    curl: 400,
    press: 400,
    hinge: 500,
    row: 400,
    bridge: 500,
    crunch: 400,
    burpee: 800,
    pullApart: 350,
    jacks: 250,
    march: 200,
    highKnees: 120,
    climbers: 120
  };
  var PRAISE = ["Good rep!", "Nice form!", "Strong. Keep it up!", "That\u2019s the one!", "Looking solid!"];
  var deg = (r) => r * 180 / Math.PI;
  var sub = (a, b) => {
    var _a, _b;
    return { x: a.x - b.x, y: a.y - b.y, z: ((_a = a.z) != null ? _a : 0) - ((_b = b.z) != null ? _b : 0) };
  };
  var norm = (v) => Math.hypot(v.x, v.y, v.z);
  function angle(a, b, c) {
    const v1 = sub(a, b);
    const v2 = sub(c, b);
    const m = norm(v1) * norm(v2) || 1e-9;
    return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / m))));
  }
  var fromVertical = (from, to) => {
    const v = sub(to, from);
    return deg(Math.acos(Math.max(-1, Math.min(1, -v.y / (norm(v) || 1e-9)))));
  };
  var dist = (a, b) => norm(sub(a, b));
  var LandmarkFilter = class {
    constructor(minCutoff = 1.2, beta = 0.5, dCutoff = 1) {
      this.minCutoff = minCutoff;
      this.beta = beta;
      this.dCutoff = dCutoff;
      __publicField(this, "prev", null);
      __publicField(this, "dprev", null);
      __publicField(this, "lastT", null);
    }
    reset() {
      this.prev = this.dprev = null;
      this.lastT = null;
    }
    apply(lms, t) {
      if (!lms) {
        this.reset();
        return null;
      }
      const dt = this.lastT == null ? 0 : Math.max(1e-3, (t - this.lastT) / 1e3);
      this.lastT = t;
      const alpha = (cutoff) => dt ? 1 / (1 + 1 / (2 * Math.PI * cutoff * dt)) : 1;
      const out = lms.map((p, i) => {
        var _a, _b, _c, _d;
        const cur = { x: p.x, y: p.y, z: (_a = p.z) != null ? _a : 0 };
        const pr = (_b = this.prev) == null ? void 0 : _b[i];
        if (!pr || !dt) return { p, cur, d: { x: 0, y: 0, z: 0 } };
        const dp = (_d = (_c = this.dprev) == null ? void 0 : _c[i]) != null ? _d : { x: 0, y: 0, z: 0 };
        const ad = alpha(this.dCutoff);
        const d = { x: 0, y: 0, z: 0 };
        const f = { x: 0, y: 0, z: 0 };
        for (const k of ["x", "y", "z"]) {
          d[k] = dp[k] + ad * ((cur[k] - pr[k]) / dt - dp[k]);
          const a = alpha(this.minCutoff + this.beta * Math.abs(d[k]));
          f[k] = pr[k] + a * (cur[k] - pr[k]);
        }
        return { p, cur: f, d };
      });
      this.prev = out.map((o) => o.cur);
      this.dprev = out.map((o) => o.d);
      return out.map(({ p, cur }) => ({ ...p, x: cur.x, y: cur.y, z: p.z == null ? p.z : cur.z }));
    }
  };
  var RepCounter = class {
    constructor(low, high, dir = "down", minMs = 180, maxMs = 8e3) {
      this.low = low;
      this.high = high;
      this.dir = dir;
      this.minMs = minMs;
      this.maxMs = maxMs;
      __publicField(this, "armed", false);
      __publicField(this, "since", 0);
      /** Seen the start position (past `high`) since the last rep? Starting mid-rep doesn't count. */
      __publicField(this, "ready", false);
      __publicField(this, "extreme", NaN);
    }
    /** Drop a half-finished rep (lost tracking, wrong posture). */
    abandon() {
      this.armed = false;
      this.ready = false;
    }
    /** Returns the most extreme value of the finished rep, or null. */
    feed(v, t = 0) {
      const atStart = this.dir === "down" ? v > this.high : v < this.high;
      if (!this.armed && !this.ready) {
        if (atStart) this.ready = true;
        return null;
      }
      if (this.armed && t - this.since > this.maxMs) this.abandon();
      const reached = this.dir === "down" ? v < this.low : v > this.low;
      const back = this.dir === "down" ? v > this.high : v < this.high;
      if (!this.armed && reached) {
        this.armed = true;
        this.since = t;
        this.extreme = v;
      } else if (this.armed) {
        this.extreme = this.dir === "down" ? Math.min(this.extreme, v) : Math.max(this.extreme, v);
        if (back) {
          this.armed = false;
          return t - this.since >= this.minMs ? this.extreme : null;
        }
      }
      return null;
    }
    get inRep() {
      return this.armed;
    }
  };
  var FormCoach = class {
    constructor(exercise, key, opts = {}) {
      this.exercise = exercise;
      this.key = key;
      __publicField(this, "family");
      __publicField(this, "reps", 0);
      __publicField(this, "goodReps", 0);
      __publicField(this, "holdMs", 0);
      __publicField(this, "cueCount", {});
      __publicField(this, "lastCueAt", -Infinity);
      __publicField(this, "lastByText", {});
      __publicField(this, "lastT", null);
      __publicField(this, "lostSince", null);
      __publicField(this, "hiddenSince", null);
      __publicField(this, "badSince", null);
      __publicField(this, "lastGoodHoldCue", null);
      __publicField(this, "stillSince", null);
      __publicField(this, "prevPts", null);
      __publicField(this, "smooth", {});
      __publicField(this, "counters", {});
      __publicField(this, "track", {});
      __publicField(this, "stage", "closed");
      /** Unwrapped rotation (degrees) for circling moves, and its direction. */
      __publicField(this, "spin", { last: NaN, total: 0, dir: 0 });
      __publicField(this, "lastRepAt", null);
      __publicField(this, "prevNeed", null);
      __publicField(this, "badFrameSince", null);
      __publicField(this, "lastLeg", "");
      __publicField(this, "lastLegAt", -Infinity);
      __publicField(this, "firstT", null);
      __publicField(this, "cueGap");
      __publicField(this, "repeatGap");
      __publicField(this, "aspect");
      /** The side of the body we measure; only switches when the other side is clearly better for a while. */
      __publicField(this, "side", null);
      __publicField(this, "betterSince", null);
      var _a, _b, _c;
      this.family = familyFor(key);
      this.cueGap = (_a = opts.cueGapMs) != null ? _a : 3e3;
      this.repeatGap = (_b = opts.repeatGapMs) != null ? _b : 8e3;
      this.aspect = (_c = opts.aspect) != null ? _c : 1;
    }
    /** Forget half-finished reps (you left the frame). */
    abandonAll() {
      for (const c of Object.values(this.counters)) c.abandon();
      this.stage = "closed";
      this.track = {};
    }
    summary() {
      return {
        exercise: this.exercise,
        family: this.family,
        reps: this.reps,
        goodReps: this.goodReps,
        holdSec: Math.round(this.holdMs / 1e3),
        cues: { ...this.cueCount }
      };
    }
    /**
     * Feed one frame. `lms` (image landmarks) is null when no person was detected. `t` in ms.
     * `world` is MediaPipe's 3D world landmarks for the same frame, when available.
     */
    update(lms, t, world) {
      var _a, _b, _c, _d, _e, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
      const out = [];
      const dt = this.lastT == null ? 0 : Math.min(500, t - this.lastT);
      (_a = this.firstT) != null ? _a : this.firstT = t;
      this.lastT = t;
      const cue = (text, kind, count = kind === "fix") => {
        var _a2, _b2;
        if (t - this.lastCueAt < this.cueGap) return;
        if (t - ((_a2 = this.lastByText[text]) != null ? _a2 : -Infinity) < this.repeatGap) return;
        this.lastCueAt = t;
        this.lastByText[text] = t;
        if (count) this.cueCount[text] = ((_b2 = this.cueCount[text]) != null ? _b2 : 0) + 1;
        out.push({ type: "cue", text, kind });
      };
      if (!lms || lms.length < 29) {
        (_b = this.lostSince) != null ? _b : this.lostSince = t;
        if (t - this.lostSince > 1e3) this.abandonAll();
        if (t - this.lostSince > 2e3) cue("I can't see you. Step into the camera's view.", "info");
        return out;
      }
      this.lostSince = null;
      const vis = (i) => {
        var _a2;
        return (_a2 = lms[i].visibility) != null ? _a2 : 1;
      };
      const sideScore = (sd) => Object.values(sd).reduce((a, i) => a + vis(i), 0);
      const best = sideScore(SIDE.left) >= sideScore(SIDE.right) ? "left" : "right";
      if (this.side == null) this.side = best;
      else if (best !== this.side && sideScore(SIDE[best]) > sideScore(SIDE[this.side]) + 0.6) {
        (_c = this.betterSince) != null ? _c : this.betterSince = t;
        if (t - this.betterSince > 500) {
          this.side = best;
          this.betterSince = null;
        }
      } else this.betterSince = null;
      const s = SIDE[this.side];
      const o = this.side === "left" ? SIDE.right : SIDE.left;
      const useWorld = !!world && world.length >= 29;
      const L = (i) => useWorld ? world[i] : { x: lms[i].x * this.aspect, y: lms[i].y, z: 0 };
      const hidden = NEEDS[this.family].some((j) => vis(s[j]) < 0.5);
      if (hidden) {
        (_d = this.hiddenSince) != null ? _d : this.hiddenSince = t;
        if (t - this.hiddenSince > 1e3) this.abandonAll();
        if (t - this.hiddenSince > 1500) cue("Step back so I can see your whole body.", "info");
        return out;
      }
      this.hiddenSince = null;
      const needIdx = NEEDS[this.family].map((j) => s[j]);
      const confident = needIdx.every((i) => vis(i) >= 0.65);
      const imgTorso = Math.hypot((lms[s.shoulder].x - lms[s.hip].x) * this.aspect, lms[s.shoulder].y - lms[s.hip].y) || 0.1;
      const cur = needIdx.map((i) => ({ x: lms[i].x * this.aspect, y: lms[i].y }));
      const glitch = !!this.prevNeed && dt > 0 && dt < 120 && cur.some((p, i) => Math.hypot(p.x - this.prevNeed[i].x, p.y - this.prevNeed[i].y) / imgTorso > 0.6);
      this.prevNeed = cur;
      const leanNow = fromVertical(L(s.hip), L(s.shoulder));
      const posture = POSTURE[this.family];
      const postureOk = posture === "upright" ? leanNow < 40 : posture === "squatting" ? leanNow < 65 : posture === "lying" ? leanNow > 55 : posture === "prone" ? leanNow > 45 : true;
      const frameOk = confident && !glitch && postureOk;
      if (frameOk) this.badFrameSince = null;
      else (_e = this.badFrameSince) != null ? _e : this.badFrameSince = t;
      const lostTooLong = this.badFrameSince != null && t - this.badFrameSince > 1e3;
      const ema = (k, v, tau = 50) => {
        const a = dt ? 1 - Math.exp(-dt / tau) : 1;
        return this.smooth[k] = this.smooth[k] == null ? v : this.smooth[k] + a * (v - this.smooth[k]);
      };
      const counters = this.counters;
      const counter = (k, low, high, dir = "down", minMs = ((_f) => (_f = MIN_REP_MS[this.family]) != null ? _f : 180)()) => {
        var _a2;
        const c = (_a2 = counters[k]) != null ? _a2 : counters[k] = new RepCounter(low, high, dir, minMs);
        if (lostTooLong) c.abandon();
        return { inRep: c.inRep, feed: (v) => frameOk ? c.feed(v, t) : null };
      };
      const alternate = (leg) => {
        if (this.lastLeg === leg && t - this.lastLegAt < 1200) return false;
        this.lastLeg = leg;
        this.lastLegAt = t;
        return true;
      };
      const rep = (good, fix) => {
        this.lastRepAt = t;
        this.reps++;
        if (good) this.goodReps++;
        out.push({ type: "rep", reps: this.reps, good });
        if (!good && fix) cue(fix, "fix");
        else if (good && this.reps % 3 === 0) cue(PRAISE[this.reps / 3 % PRAISE.length], "good");
      };
      const maxTrack = (k, v) => {
        var _a2;
        return this.track[k] = Math.max((_a2 = this.track[k]) != null ? _a2 : -Infinity, v);
      };
      const minTrack = (k, v) => {
        var _a2;
        return this.track[k] = Math.min((_a2 = this.track[k]) != null ? _a2 : Infinity, v);
      };
      const takeTrack = (k) => {
        const v = this.track[k];
        delete this.track[k];
        return v;
      };
      const sustained = (bad, ms) => {
        var _a2;
        if (!bad) {
          this.badSince = null;
          return false;
        }
        (_a2 = this.badSince) != null ? _a2 : this.badSince = t;
        return t - this.badSince > ms;
      };
      const holdPraise = (text, every = 1e4) => {
        var _a2;
        (_a2 = this.lastGoodHoldCue) != null ? _a2 : this.lastGoodHoldCue = t;
        if (t - this.lastGoodHoldCue > every) {
          this.lastGoodHoldCue = t;
          cue(text, "good");
        }
      };
      const knee = (side) => angle(L(side.hip), L(side.knee), L(side.ankle));
      const elbow = (side) => angle(L(side.shoulder), L(side.elbow), L(side.wrist));
      const lean = fromVertical(L(s.hip), L(s.shoulder));
      const bodyLine = angle(L(s.shoulder), L(s.hip), L(s.ankle));
      const hipBelowLine = () => {
        const a = L(s.shoulder);
        const b = L(s.ankle);
        const h = L(s.hip);
        const yOnLine = a.y + (h.x - a.x) / (b.x - a.x || 1e-9) * (b.y - a.y);
        return h.y > yOnLine;
      };
      const torso = dist(L(s.shoulder), L(s.hip)) || 1e-3;
      switch (this.family) {
        case "squat": {
          const k = ema("knee", vis(o.knee) > 0.6 ? (knee(s) + knee(o)) / 2 : knee(s));
          const c = counter("squat", 130, 160);
          if (c.inRep) maxTrack("lean", lean);
          const bottom = c.feed(k);
          if (bottom != null) {
            const maxLean = (_g = takeTrack("lean")) != null ? _g : 0;
            if (bottom > 100) rep(false, "Sit a little deeper. Aim for thighs parallel to the floor.");
            else if (maxLean > 55) rep(false, "Keep your chest up as you squat.");
            else rep(true);
          }
          break;
        }
        case "deepSquat": {
          const k = ema("knee", knee(s));
          this.holdMs += dt;
          if (sustained(k > 100, 2e3)) cue("Sink a little lower and keep your heels down.", "fix");
          else if (k <= 100) holdPraise("Nice and deep. Breathe slowly.");
          break;
        }
        case "lunge": {
          const k = ema("knee", Math.min(knee(s), vis(o.knee) > 0.5 ? knee(o) : 180));
          const c = counter("lunge", 125, 160);
          if (c.inRep) maxTrack("lean", lean);
          const bottom = c.feed(k);
          if (bottom != null) {
            const maxLean = (_h = takeTrack("lean")) != null ? _h : 0;
            if (bottom > 105) rep(false, "Lower until your back knee nearly touches the floor.");
            else if (maxLean > 30) rep(false, "Stay tall. Keep your chest up through the lunge.");
            else rep(true);
          }
          break;
        }
        case "pushup": {
          if (lean < 45) {
            cue("Get down into a push-up position, side-on to the camera.", "info", false);
            break;
          }
          const e = ema("elbow", elbow(s));
          const c = counter("pushup", 110, 150);
          if (c.inRep) {
            minTrack("line", bodyLine);
            if (bodyLine < 155) this.track.sag = hipBelowLine() ? 1 : 0;
          }
          const bottom = c.feed(e);
          if (bottom != null) {
            const line = (_i = takeTrack("line")) != null ? _i : 180;
            const sag = takeTrack("sag");
            if (line < 155) rep(false, sag ? "Tighten your core. Don't let your hips sag." : "Lower your hips into one straight line.");
            else if (bottom > 95) rep(false, "Lower your chest closer to the floor.");
            else rep(true);
          }
          break;
        }
        case "plank": {
          this.holdMs += dt;
          const line = ema("line", bodyLine);
          if (sustained(line < 162, 1200)) cue(hipBelowLine() ? "Lift your hips a little. Keep a straight line." : "Drop your hips a touch, in line with your shoulders.", "fix");
          else if (line >= 162) holdPraise("Strong plank. Keep breathing.");
          break;
        }
        case "climbers": {
          for (const [name, side] of [["a", s], ["b", o]]) {
            if (vis(side.knee) < 0.5) continue;
            const h = ema(`hip${name}`, angle(L(side.shoulder), L(side.hip), L(side.knee)));
            const c = counter(`climb${name}`, 110, 140);
            if (c.feed(h) != null && alternate(name)) rep(true);
          }
          if (sustained(bodyLine < 145 && !hipBelowLine(), 1500)) cue("Keep your hips low, level with your shoulders.", "fix");
          break;
        }
        case "bridge": {
          const h = ema("hip", angle(L(s.shoulder), L(s.hip), L(s.knee)));
          const top = counter("bridge", 160, 150, "up").feed(h);
          if (top != null) {
            if (top < 168) rep(false, "Push your hips higher and squeeze your glutes at the top.");
            else rep(true);
          }
          break;
        }
        case "jacks": {
          const feetW = dist(L(27), L(28)) / torso;
          const handsUp = Math.min(L(15).y, L(16).y) < L(NOSE).y;
          if (this.stage === "closed" && feetW > 0.85) {
            this.stage = "open";
            this.track.armsUp = handsUp ? 1 : 0;
          } else if (this.stage === "open") {
            if (handsUp) this.track.armsUp = 1;
            if (feetW < 0.6) {
              this.stage = "closed";
              const up = takeTrack("armsUp");
              if (up) rep(true);
              else rep(false, "Reach your arms all the way overhead.");
            }
          }
          break;
        }
        case "highKnees":
        case "march": {
          const need = this.family === "highKnees" ? -0.15 : -0.45;
          for (const [name, side] of [["a", s], ["b", o]]) {
            if (vis(side.knee) < 0.5) continue;
            const lift = ema(`lift${name}`, (L(side.hip).y - L(side.knee).y) / torso, 35);
            const c = counter(`knee${name}`, -0.5, -0.62, "up");
            if (c.inRep) maxTrack(`peak${name}`, lift);
            if (c.feed(lift) != null && alternate(name)) {
              const peak = (_j = takeTrack(`peak${name}`)) != null ? _j : lift;
              if (peak < need) rep(false, this.family === "highKnees" ? "Drive your knees up to hip height." : "Lift your knees a little higher.");
              else rep(true);
            }
          }
          break;
        }
        case "curl": {
          const e = ema("elbow", elbow(s));
          const c = counter("curl", 75, 145);
          if (c.inRep) maxTrack("swing", fromVertical(L(s.elbow), L(s.shoulder)));
          const top = c.feed(e);
          if (top != null) {
            const swing = (_k = takeTrack("swing")) != null ? _k : 0;
            if (swing > 35) rep(false, "Keep your elbows pinned to your sides.");
            else if (top > 60) rep(false, "Curl all the way up to your shoulders.");
            else rep(true);
          }
          break;
        }
        case "press": {
          const e = ema("elbow", elbow(s));
          const overhead = L(s.wrist).y < L(NOSE).y;
          const c = counter("press", 140, 105, "up");
          if (c.inRep && overhead) maxTrack("top", e);
          const top = c.feed(overhead ? e : Math.min(e, 139));
          if (top != null) {
            const best2 = (_l = takeTrack("top")) != null ? _l : top;
            if (best2 < 160) rep(false, "Press all the way up until your arms are straight.");
            else rep(true);
          }
          break;
        }
        case "hinge": {
          const h = ema("hip", angle(L(s.shoulder), L(s.hip), L(s.knee)));
          const c = counter("hinge", 135, 165);
          if (c.inRep) minTrack("knee", knee(s));
          const bottom = c.feed(h);
          if (bottom != null) {
            const k = (_m = takeTrack("knee")) != null ? _m : 180;
            if (k < 120) rep(false, "Push your hips back. This is a hinge, not a squat.");
            else rep(true);
          }
          break;
        }
        case "row": {
          if (sustained(lean < 30, 1500)) {
            cue("Hinge forward more, chest toward the floor.", "fix");
            break;
          }
          const e = ema("elbow", elbow(s));
          const bottom = counter("row", 110, 150).feed(e);
          if (bottom != null) {
            if (bottom > 95) rep(false, "Pull your elbow back past your ribs.");
            else rep(true);
          }
          break;
        }
        case "pullApart": {
          const w = dist(L(15), L(16)) / torso;
          const open = counter("pull", 1.2, 0.84, "up").feed(ema("w", w));
          if (open != null) {
            if (open < 1.44) rep(false, "Pull the band wider, all the way to your chest.");
            else rep(true);
          }
          break;
        }
        case "burpee": {
          const height = ema("hipH", (L(s.ankle).y - L(s.hip).y) / torso, 35);
          const bottom = counter("burpee", 0.9, 1.2).feed(height);
          if (bottom != null) rep(true);
          break;
        }
        case "skater": {
          const hipX = (lms[s.hip].x + lms[o.hip].x) / 2 * this.aspect;
          const imgTorso2 = Math.hypot((lms[s.shoulder].x - lms[s.hip].x) * this.aspect, lms[s.shoulder].y - lms[s.hip].y) || 0.1;
          const lo = this.track.skLo = Math.min(hipX, ((_n = this.track.skLo) != null ? _n : hipX) + 2e-3);
          const hi = this.track.skHi = Math.max(hipX, ((_o = this.track.skHi) != null ? _o : hipX) - 2e-3);
          const off = ema("skOff", (hipX - (lo + hi) / 2) / imgTorso2, 35);
          if (this.stage !== "open" && off > 0.3) {
            this.stage = "open";
            rep(true);
          } else if (this.stage !== "closed" && off < -0.3) {
            this.stage = "closed";
            rep(true);
          }
          break;
        }
        case "crunch": {
          const h = ema("hip", angle(L(s.shoulder), L(s.hip), L(s.knee)));
          const top = counter("crunch", 122, 136).feed(h);
          if (top != null) rep(true);
          break;
        }
        case "circles":
        case "halo": {
          const centre = this.family === "circles" ? L(s.shoulder) : L(NOSE);
          const hand = this.family === "circles" ? L(s.wrist) : { x: (L(15).x + L(16).x) / 2, y: (L(15).y + L(16).y) / 2, z: (((_p = L(15).z) != null ? _p : 0) + ((_q = L(16).z) != null ? _q : 0)) / 2 };
          const fwd = hand.x - centre.x - (((_r = hand.z) != null ? _r : 0) - ((_s = centre.z) != null ? _s : 0));
          const a = deg(Math.atan2(fwd, centre.y - hand.y));
          const sp = this.spin;
          if (!Number.isNaN(sp.last)) {
            let d = a - sp.last;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            const dir = Math.sign(d);
            if (Math.abs(d) > 3 && dir !== sp.dir) {
              if (sp.dir && Math.abs(sp.total) > 60) sp.total = 0;
              sp.dir = dir;
            }
            sp.total += d;
            if (Math.abs(sp.total) >= 330) {
              sp.total -= Math.sign(sp.total) * 360;
              rep(true);
            }
          }
          sp.last = a;
          break;
        }
        case "boxing": {
          for (const [name, side] of [["a", s], ["b", o]]) {
            if (vis(side.wrist) < 0.4) continue;
            const reach = ema(`reach${name}`, dist(L(side.shoulder), L(side.wrist)) / (dist(L(side.shoulder), L(side.elbow)) + dist(L(side.elbow), L(side.wrist)) || 1), 35);
            if (counter(`punch${name}`, 0.75, 0.5, "up", 60).feed(reach) != null) rep(true);
          }
          break;
        }
      }
      if (["burpee", "skater", "boxing", "circles", "halo", "jacks", "highKnees"].includes(this.family) && t - ((_u = (_t = this.lastRepAt) != null ? _t : this.firstT) != null ? _u : t) > 6e3) {
        cue("Keep moving. Stay light on your feet.", "info");
      }
      switch (this.family) {
        case "active":
        case "stretch": {
          const pts = [L(s.shoulder), L(s.hip), L(s.wrist), L(s.ankle), L(o.wrist), L(o.ankle)];
          const motion = this.prevPts ? pts.reduce((a, p, i) => a + dist(p, this.prevPts[i]), 0) / torso : 0;
          this.prevPts = pts;
          const speed = ema("motion", dt ? motion * 1e3 / dt : 0, 150);
          if (this.family === "stretch") {
            this.holdMs += dt;
            holdPraise("Slow breaths. Ease a little deeper into the stretch.", 15e3);
          } else if (speed < 0.25) {
            (_v = this.stillSince) != null ? _v : this.stillSince = t;
            if (t - this.stillSince > 5e3) cue("Keep moving. Stay light on your feet.", "info");
          } else {
            this.stillSince = null;
            holdPraise("Great energy. Keep it going!", 2e4);
          }
          break;
        }
      }
      return out;
    }
  };
  return __toCommonJS(formRules_exports);
})();
