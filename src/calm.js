// Calming stimuli for the 60-second break: generated audio (Web Audio, no files needed),
// the instructor's uploaded audio, and the breathing circle animation.
// Everything fades in and fades out: no sudden sounds.
import { CALM_SECONDS } from './content.js';

const FADE_IN = 3;   // seconds
const FADE_OUT = 2;  // seconds

function noiseBuffer(ctx, seconds, type) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3; }
    else d[i] = white * 0.4;
  }
  return buf;
}

function loopNoise(ctx, type, dest) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 4, type); src.loop = true;
  src.connect(dest); src.start();
  return src;
}

// Generated audio. Returns the nodes to stop; `master` is faded by the caller.
function buildGenerated(ctx, key, master) {
  const nodes = [];
  if (key === 'rain') {
    // Soft broadband hiss + low rumble
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2500; hp.Q.value = 0.4;
    const g1 = ctx.createGain(); g1.gain.value = 0.35; hp.connect(g1).connect(master);
    nodes.push(loopNoise(ctx, 'white', hp));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g2 = ctx.createGain(); g2.gain.value = 0.6; lp.connect(g2).connect(master);
    nodes.push(loopNoise(ctx, 'brown', lp));
  } else if (key === 'waves') {
    // Brown noise swelling slowly (~one wave every 8 s)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const lfo = ctx.createOscillator(); const depth = ctx.createGain();
    lfo.frequency.value = 0.125; depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain); lfo.start();
    lp.connect(swell).connect(master);
    nodes.push(loopNoise(ctx, 'brown', lp), lfo);
  } else {
    // 'music': soft major-chord pad with a slow swell
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
    const swell = ctx.createGain(); swell.gain.value = 1; swell.connect(lp);
    const lfo = ctx.createOscillator(); const depth = ctx.createGain();
    lfo.frequency.value = 0.1; depth.gain.value = 0.25; lfo.connect(depth).connect(swell.gain); lfo.start();
    nodes.push(lfo);
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4;
      g.gain.value = i === 3 ? 0.06 : 0.18;
      o.connect(g).connect(swell); o.start(); nodes.push(o);
    });
  }
  return nodes;
}

// One shared AudioContext per page. Browsers only allow sound after a tap, so call
// unlockAudio() inside a click handler (the student taps "I'm ready" before calm time).
let sharedCtx = null;
export function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!sharedCtx) sharedCtx = new Ctx();
  sharedCtx.resume?.();
}

// Starts a stimulus. key: rain | waves | music | breathe | upload. url: uploaded audio.
// Returns { stop(), isPlaying(), retry(), setMuted(bool) }. stop() fades out over FADE_OUT seconds.
// If the browser blocked autoplay, isPlaying() is false and retry() (from a tap) starts it.
export function startStimulus(key, { url, muted = false } = {}) {
  const silent = { stop() {}, isPlaying: () => true, retry() {}, setMuted() {} };
  if (key === 'breathe' || key === 'draw' || key === 'trace') return silent; // visual-only stimuli

  if (key === 'upload') {
    if (!url) return silent;
    const audio = new Audio(url);
    audio.loop = true; audio.volume = 0;
    let v = 0; let target = muted ? 0 : 0.8; let ramp; let stopped = false;
    // Move volume toward `target` in small steps (fade in, fade out, mute/unmute).
    const rampTo = (t, seconds) => {
      target = t; clearInterval(ramp);
      const step = 0.8 / (seconds * 10);
      ramp = setInterval(() => {
        v = v < target ? Math.min(target, v + step) : Math.max(target, v - step);
        audio.volume = v;
        if (v === target) { clearInterval(ramp); if (stopped && v === 0) audio.pause(); }
      }, 100);
    };
    const begin = () => rampTo(target, FADE_IN);
    audio.play().then(begin).catch((e) => console.warn('audio blocked until tap', e));
    return {
      isPlaying: () => !audio.paused,
      retry() { if (!stopped) audio.play().then(begin).catch(() => {}); },
      setMuted(m) { if (!stopped) rampTo(m ? 0 : 0.8, 0.4); },
      stop() { stopped = true; rampTo(0, FADE_OUT); },
    };
  }

  unlockAudio();
  const ctx = sharedCtx;
  if (!ctx) return silent;
  const master = ctx.createGain();
  const LEVEL = 0.22;
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(muted ? 0 : LEVEL, ctx.currentTime + FADE_IN);
  master.connect(ctx.destination);
  const nodes = buildGenerated(ctx, key, master);
  let stopped = false;
  return {
    isPlaying: () => ctx.state === 'running',
    retry() { ctx.resume?.(); },
    setMuted(m) {
      if (stopped) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(m ? 0 : LEVEL, ctx.currentTime + 0.4);
    },
    stop() {
      if (stopped) return; stopped = true;
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch {} }); master.disconnect(); }, FADE_OUT * 1000 + 200);
      } catch {}
    },
  };
}

// Breathing circle + countdown for `seconds`. In 4 s · hold 2 s · out 6 s.
// onFadeOut fires FADE_OUT seconds before the end so audio can fade out in time.
// Returns { done: Promise, stop() }.
export function runBreathing(el, color, { seconds = CALM_SECONDS, label = true, showTimer = true, onFadeOut } = {}) {
  el.innerHTML = `
    <div class="breath-wrap">
      <div class="breath-ring"><div class="breath-circle" style="background:${color}"></div></div>
      ${label ? '<p class="breath-text" aria-hidden="true">Get comfortable…</p>' : ''}
      <p class="sr-only">Breathe in for 4 seconds, hold for 2, and breathe out for 6, following the circle.</p>
      <p class="breath-timer" aria-hidden="true"${showTimer ? '' : ' hidden'}></p>
    </div>`;
  const circle = el.querySelector('.breath-circle');
  const text = el.querySelector('.breath-text');
  const timer = el.querySelector('.breath-timer');
  const phases = [['Breathe in…', 4000, 1], ['Hold…', 2000, 1], ['Breathe out…', 6000, 0.45]];
  let stopped = false; let faded = false; const t0 = performance.now(); let phaseTimer;
  let resolve; const done = new Promise((r) => (resolve = r));

  const runPhase = (i) => {
    if (stopped) return;
    const [msg, ms, scale] = phases[i % phases.length];
    if (text) text.textContent = msg;
    circle.style.transition = `transform ${ms}ms ease-in-out`;
    circle.style.transform = `scale(${scale})`;
    phaseTimer = setTimeout(() => runPhase(i + 1), ms);
  };
  circle.style.transform = 'scale(0.45)';
  requestAnimationFrame(() => runPhase(0));

  const update = () => {
    if (!Number.isFinite(seconds)) { timer.hidden = true; return; } // untimed: the caller stops it
    const left = Math.max(0, seconds - Math.floor((performance.now() - t0) / 1000));
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (!faded && left <= FADE_OUT) { faded = true; onFadeOut?.(); }
    if (left <= 0) finish();
  };
  const tick = setInterval(update, 250); update();

  function finish() {
    if (stopped) return; stopped = true;
    clearTimeout(phaseTimer); clearInterval(tick);
    if (!faded) { faded = true; onFadeOut?.(); }
    if (text) text.textContent = 'Nice work.';
    circle.style.transform = 'scale(0.7)';
    resolve();
  }
  return { done, stop: finish };
}

// Short preview for the instructor (5 s) so they can hear a stimulus before picking it.
export function previewStimulus(key, opts) {
  const s = startStimulus(key, opts);
  setTimeout(() => s.stop(), 5000);
  return s;
}

// Drawing pad: a calm alternative to the breathing circle. Soft colours, one stroke size,
// a Clear button and the same countdown. Pointer events cover mouse, pen and touch.
// Returns { done: Promise, stop() } like runBreathing.
const PAD_COLORS = [
  { c: '#3f6e70', name: 'Teal' }, { c: '#7f9cc4', name: 'Blue' }, { c: '#c08fa8', name: 'Pink' },
  { c: '#c9a46b', name: 'Sand' }, { c: '#477452', name: 'Green' },
];
export function runDrawing(el, { seconds = CALM_SECONDS, onFadeOut } = {}) {
  el.innerHTML = `
    <div class="pad">
      <canvas class="pad-canvas" aria-label="Drawing pad. Draw anything you like."></canvas>
      <div class="pad-tools" role="group" aria-label="Colours">
        ${PAD_COLORS.map((p, i) => `<button type="button" class="pad-swatch" data-c="${p.c}" aria-label="${p.name}" aria-pressed="${i === 0}" style="background:${p.c}"></button>`).join('')}
        <button type="button" class="btn ghost small" data-clear>Clear</button>
      </div>
      <p class="breath-timer" aria-hidden="true"></p>
    </div>`;
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const timer = el.querySelector('.breath-timer');
  let color = PAD_COLORS[0].c;

  // Size the canvas to its box at device resolution so lines stay crisp.
  const fit = () => {
    const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const snapshot = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 6;
    if (snapshot) ctx.putImageData(snapshot, 0, 0);
  };
  fit(); window.addEventListener('resize', fit);

  // Drawing: one active pointer at a time; any cancel/lost-capture ends the stroke cleanly.
  let active = null; let last = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const end = () => { active = null; last = null; };
  canvas.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId; canvas.setPointerCapture(e.pointerId); last = pos(e);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2); ctx.fill();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    const p = pos(e); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, (e) => { if (e.pointerId === active) end(); }));
  window.addEventListener('blur', end);

  el.querySelectorAll('.pad-swatch').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    el.querySelectorAll('.pad-swatch').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  el.querySelector('[data-clear]').onclick = () => { const r = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); };

  let stopped = false; let faded = false; const t0 = performance.now();
  let resolve; const done = new Promise((r) => (resolve = r));
  const update = () => {
    if (!Number.isFinite(seconds)) { timer.hidden = true; return; } // untimed: the caller stops it
    const left = Math.max(0, seconds - Math.floor((performance.now() - t0) / 1000));
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (!faded && left <= 2) { faded = true; onFadeOut?.(); }
    if (left <= 0) finish();
  };
  const tick = setInterval(update, 250); update();
  function finish() {
    if (stopped) return; stopped = true;
    clearInterval(tick); window.removeEventListener('resize', fit); window.removeEventListener('blur', end);
    if (!faded) { faded = true; onFadeOut?.(); }
    resolve();
  }
  return { done, stop: finish };
}

// Trace the path: a calm, failure-free tracing activity. One winding path with no dead ends;
// tracing near it (generous tolerance) moves the progress forward and slowly fades in a friendly
// picture. Wandering off just pauses. At the end of calm time the picture finishes revealing
// even if the path isn't done, so every student "finishes". Keyboard: Right arrow / Space advance.
// Returns { done: Promise, stop() } like runBreathing.
const SCENES = [
  // Sunrise over hills
  (c, w, h) => {
    c.fillStyle = '#fbe9d6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f0c98a'; c.beginPath(); c.arc(w * 0.5, h * 0.62, h * 0.24, Math.PI, 0); c.fill();
    c.fillStyle = '#a9c9b1'; c.beginPath(); c.moveTo(0, h * 0.7); c.quadraticCurveTo(w * 0.25, h * 0.52, w * 0.5, h * 0.7); c.quadraticCurveTo(w * 0.75, h * 0.85, w, h * 0.66); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#7fa98a'; c.beginPath(); c.moveTo(0, h * 0.85); c.quadraticCurveTo(w * 0.4, h * 0.7, w, h * 0.88); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  },
  // A plant in a pot
  (c, w, h) => {
    c.fillStyle = '#e3eee6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c9a46b'; c.beginPath(); c.moveTo(w * 0.42, h * 0.62); c.lineTo(w * 0.58, h * 0.62); c.lineTo(w * 0.55, h * 0.9); c.lineTo(w * 0.45, h * 0.9); c.fill();
    c.strokeStyle = '#477452'; c.lineWidth = 5; c.beginPath(); c.moveTo(w * 0.5, h * 0.62); c.lineTo(w * 0.5, h * 0.25); c.stroke();
    c.fillStyle = '#7fa98a';
    [[0.42, 0.45, -0.6], [0.58, 0.38, 0.6], [0.43, 0.3, -0.5], [0.57, 0.24, 0.5]].forEach(([x, y, r]) => {
      c.save(); c.translate(w * x, h * y); c.rotate(r); c.beginPath(); c.ellipse(0, 0, h * 0.09, h * 0.04, 0, 0, Math.PI * 2); c.fill(); c.restore();
    });
  },
  // Calm sea with a small boat
  (c, w, h) => {
    c.fillStyle = '#dfe7f2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b8cbe3'; c.fillRect(0, h * 0.6, w, h * 0.4);
    c.strokeStyle = '#7f9cc4'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); for (let x = 0; x <= w; x += 20) c.lineTo(x, h * (0.7 + i * 0.09) + Math.sin(x / 30) * 4); c.stroke(); }
    c.fillStyle = '#5f5b53'; c.beginPath(); c.moveTo(w * 0.4, h * 0.6); c.lineTo(w * 0.6, h * 0.6); c.lineTo(w * 0.56, h * 0.66); c.lineTo(w * 0.44, h * 0.66); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * 0.5, h * 0.3); c.lineTo(w * 0.5, h * 0.58); c.lineTo(w * 0.6, h * 0.58); c.fill();
  },
];

export function runTrace(el, { seconds = CALM_SECONDS, onFadeOut } = {}) {
  el.innerHTML = `
    <div class="pad">
      <canvas class="pad-canvas trace-canvas" tabindex="0" aria-label="Trace the path from the dot. A picture appears as you go. Use the right arrow key to trace with the keyboard."></canvas>
      <p class="trace-hint" aria-live="polite">Start at the dot and follow the path.</p>
      <button type="button" class="btn ghost small" data-again hidden>Trace another picture</button>
      <p class="breath-timer" aria-hidden="true"></p>
    </div>`;
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hint = el.querySelector('.trace-hint');
  const timer = el.querySelector('.breath-timer');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let sceneIx = Math.floor(Math.random() * SCENES.length);
  let scene = SCENES[sceneIx];
  const picture = document.createElement('canvas');
  let W = 0; let H = 0; let path = []; let progress = 0; // progress = index of furthest traced point
  let stopped = false;

  // A gentle S-curve across the canvas, sampled into points.
  const buildPath = () => {
    path = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      path.push({ x: W * (0.08 + 0.84 * t), y: H * (0.5 + 0.28 * Math.sin(t * Math.PI * 2.2)) });
    }
  };
  const fit = () => {
    const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    picture.width = canvas.width; picture.height = canvas.height;
    const pc = picture.getContext('2d'); pc.setTransform(dpr, 0, 0, dpr, 0, 0); scene(pc, W, H);
    buildPath(); draw();
  };
  const draw = () => {
    const f = path.length ? progress / (path.length - 1) : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06 + 0.94 * f; // the picture fades in as the path is traced
    ctx.drawImage(picture, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = (from, to, width, color) => {
      if (to <= from) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(path[from].x, path[from].y);
      for (let i = from + 1; i <= to; i++) ctx.lineTo(path[i].x, path[i].y); ctx.stroke();
    };
    if (f < 1) line(0, path.length - 1, 26, 'rgba(63, 110, 112, 0.14)'); // the path to follow
    line(0, progress, 10, 'rgba(63, 110, 112, 0.85)');                   // what's been traced
    const head = path[progress];
    ctx.fillStyle = '#3f6e70'; ctx.beginPath(); ctx.arc(head.x, head.y, 10, 0, Math.PI * 2); ctx.fill();
  };
  // Advance only to nearby points just ahead of the current spot (no skipping, no going back).
  const TOL = 34;
  const traceTo = (x, y) => {
    let best = -1;
    for (let i = progress; i <= Math.min(path.length - 1, progress + 18); i++) {
      if (Math.hypot(path[i].x - x, path[i].y - y) <= TOL) best = i;
    }
    if (best > progress) { setProgress(best); }
  };
  const setProgress = (i) => {
    progress = Math.min(path.length - 1, i); draw();
    if (progress === path.length - 1) {
      hint.textContent = 'You finished the path. Nice and slow.';
      if (!Number.isFinite(seconds) && !stopped) again.hidden = false; // untimed: there's time for another
    }
  };
  const again = el.querySelector('[data-again]');
  again.onclick = () => {
    sceneIx = (sceneIx + 1) % SCENES.length; scene = SCENES[sceneIx];
    progress = 0; again.hidden = true; hint.textContent = 'Start at the dot and follow the path.';
    fit(); canvas.focus();
  };
  fit(); window.addEventListener('resize', fit);

  let active = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => { if (active !== null) return; active = e.pointerId; canvas.setPointerCapture(e.pointerId); traceTo(...pos(e)); });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId === active) traceTo(...pos(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, (e) => { if (e.pointerId === active) active = null; }));
  const blur = () => { active = null; };
  window.addEventListener('blur', blur);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setProgress(progress + 6); }
  });

  let faded = false; const t0 = performance.now();
  let resolve; const done = new Promise((r) => (resolve = r));
  // End of calm time: gently finish revealing the picture (instantly with reduced motion).
  const finishReveal = () => {
    if (reduced) return setProgress(path.length - 1);
    const step = () => { if (progress < path.length - 1) { setProgress(progress + 4); requestAnimationFrame(step); } };
    requestAnimationFrame(step);
  };
  const update = () => {
    if (!Number.isFinite(seconds)) { timer.hidden = true; return; } // untimed: the caller stops it
    const left = Math.max(0, seconds - Math.floor((performance.now() - t0) / 1000));
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (!faded && left <= 2) { faded = true; onFadeOut?.(); finishReveal(); }
    if (left <= 0) finish();
  };
  const tick = setInterval(update, 250); update();
  function finish() {
    if (stopped) return; stopped = true;
    clearInterval(tick); window.removeEventListener('resize', fit); window.removeEventListener('blur', blur);
    if (!faded) { faded = true; onFadeOut?.(); }
    setProgress(path.length - 1);
    resolve();
  }
  return { done, stop: finish };
}

// Soft two-note chime for the teacher when a student's activity timer ends. Quiet on purpose.
export function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.22]].forEach(([f, at]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.start(t); o.stop(t + 1);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* no audio: the toast and the Needs-you strip still show it */ }
}
