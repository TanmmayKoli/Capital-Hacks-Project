import { db, MODE, local } from './db.js';
import {
  EMOTIONS, EMOTION_KEYS, POSITIVE_EMOTIONS, STRATEGIES, HELPED, MAX_PICKS, MAX_OWN, SUBJECTS, ownList, ownStrategy, ownKey, NOT_SURE, BODY_FEELINGS, REASONS, FAVORITES, FREQUENCY, STRENGTH, STIMULI, BUILT_IN_STIMULI, KID_ACTIVITIES, PAUSE_SECONDS, MAX_SWITCHES, SEC_MS, timerTotalSec, timerLeft, clock, LIMITS,
  getCopingPlan, stimulusLabel, STRATEGY_BY_KEY,
} from './content.js';
import { startStimulus, runBreathing, runDrawing, runTrace, unlockAudio } from './calm.js';
import { renderReport } from './charts.js';
import './fonts.js';
import { icon } from './icons.js';
import { esc, toast, hideToast, friendly, withRetry, watchConnection, busy } from './ui.js';

const app = document.getElementById('app');

// ------------------------------------------------------------ Read aloud (Web Speech API)
// Any element with data-say="text" becomes a read-aloud button.
const say = (text) => {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u);
};
const speakBtn = (text) => `<button class="speak" type="button" data-say="${esc(text)}" aria-label="Read aloud: ${esc(text)}">${icon('volume')}</button>`;
document.addEventListener('click', (e) => { const b = e.target.closest('[data-say]'); if (b) say(b.dataset.say); });
const heading = (text, tag = 'h1', id = '') => `<${tag} class="say-row"${id ? ` id="${id}" tabindex="-1"` : ''}>${esc(text)} ${speakBtn(text)}</${tag}>`;

let student = null;
let subs = [];
let brk = null;        // the break currently on screen
let overlay = null;
let breakSub = null;   // listens to this break's row (the teacher's timer and controls)
let changing = null;   // { from } while the student is switching away from an activity they started
let calm = { stim: null, breathing: null };
let muted = !!local.get('cc_muted'); // the student's own sound preference, remembered on this device

// ============================================================ Onboarding (5 menus)
const TOTAL = 7;
const blankOb = () => ({
  name: '', code: '', cls: null,
  favorites: Object.fromEntries(FAVORITES.map((f) => [f.key, ''])),
  frequency: {},
  subjects: [], strategies: [], own: [],
  happy: ['', ''],
});
let ob = blankOb();

function shell(inner, step) {
  app.innerHTML = `
    <main class="wrap stack wrap-onboard">
      <div class="row"><span class="muted">Step ${step} of ${TOTAL}</span><span class="spacer"></span>
        ${MODE === 'local' ? '<span class="pill gray">Demo mode</span>' : ''}</div>
      <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL}" aria-valuenow="${step}" aria-label="Setup progress"><div style="width:${(100 * step) / TOTAL}%"></div></div>
      ${inner}
    </main>`;
}
const showErr = (msg) => { const e = app.querySelector('#err'); e.textContent = msg; e.classList.remove('hidden'); };
const nav = (backFn, nextLabel = 'Next →') => `
  <p id="err" class="err hidden" role="alert"></p>
  <div class="row">${backFn ? '<button class="btn ghost" id="back">← Back</button>' : ''}<span class="spacer"></span>
    <button class="btn" id="next">${nextLabel}</button></div>`;

// Menu 1: basic info
function menuBasics() {
  shell(`
    <div class="card stack">
      <div class="center"><div class="hero-ic">${icon('compass', { size: '2.5rem' })}</div>${heading('Welcome to Calm Compass')}
        <p class="muted">Calm Compass helps you take a quick reset when school feels like a lot.</p></div>
      <label>Your first name<input id="name" value="${esc(ob.name)}" placeholder="Your name" maxlength="${LIMITS.name}" autocomplete="given-name" /></label>
      <label>Class code (your teacher has it)<input id="code" value="${esc(ob.code)}" placeholder="K7Q2M" maxlength="8" class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" /></label>
      <p class="muted small">We only ask for your first name. No email needed.</p>
      ${nav(null)}
    </div>`, 1);
  const name = app.querySelector('#name'); name.focus();
  const go = (ev) => busy(app.querySelector('#next'), async () => {
    ob.name = name.value.trim().slice(0, LIMITS.name);
    ob.code = app.querySelector('#code').value.replace(/\s+/g, '').toUpperCase();
    if (!ob.name) return showErr('Type your first name first.');
    if (!ob.code) return showErr('Type the class code from your teacher.');
    try {
      ob.cls = await db.getClass(ob.code);
      if (!ob.cls) return showErr(`We couldn't find a class with the code ${ob.code}. Check it with your teacher and try again.`);
      toast(`Joining ${ob.cls.teacher_name}'s class`);
      menuSubjects();
    } catch (e) { showErr(friendly(e, "We couldn't check that code right now. Try again in a moment.")); }
  });
  app.querySelector('#next').onclick = go;
  app.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
}

// Menu 2: which subjects do you have in this class? (tap any; skipping is fine)
function menuSubjects() {
  shell(`
    <div class="stack">
      <div class="center">${heading(`Which subjects do you have with ${ob.cls?.teacher_name || 'this teacher'}?`)}
        <p class="muted">Tap all that fit. You can skip this.</p></div>
      <div class="choices subjects" role="group" aria-label="Subjects">
        ${Object.entries(SUBJECTS).map(([k, l]) => `<button type="button" class="tile small" data-subj="${k}" aria-pressed="${ob.subjects.includes(k)}">${l}</button>`).join('')}
      </div>
      ${nav(true)}
    </div>`, 2);
  app.querySelectorAll('[data-subj]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.subj;
    ob.subjects = ob.subjects.includes(k) ? ob.subjects.filter((x) => x !== k) : [...ob.subjects, k];
    b.setAttribute('aria-pressed', ob.subjects.includes(k));
  }));
  app.querySelector('#back').onclick = menuBasics;
  app.querySelector('#next').onclick = menuFavorites;
}

// Menu 3: five favorites
function menuFavorites() {
  shell(`
    <div class="card stack">
      <div class="center">${heading(`Nice to meet you, ${ob.name}! Tell us your favorites.`)}
        <p class="muted">Your teacher will see these. Fill in any you like.</p></div>
      ${FAVORITES.map((f) => `
        <label><span class="lbl-ic">${f.icon} ${f.label}</span><input data-f="${f.key}" value="${esc(ob.favorites[f.key])}" placeholder="${esc(f.placeholder)}" maxlength="${LIMITS.favorite}" /></label>`).join('')}
      ${nav(true)}
    </div>`, 3);
  const read = () => app.querySelectorAll('[data-f]').forEach((i) => (ob.favorites[i.dataset.f] = i.value.trim()));
  app.querySelector('#back').onclick = () => { read(); menuSubjects(); };
  app.querySelector('#next').onclick = () => {
    read();
    menuFrequency();
  };
}

// Menus 4-5: how often do you feel...? Two short pages (tough feelings, then good ones) instead of
// one long grid, so there are never more than 5 rows on screen.
function frequencyPage({ map, title, step, back, next }) {
  const keys = Object.keys(map);
  shell(`
    <div class="stack">
      <div class="center">${heading(title)}
        <p class="muted">There are no wrong answers. Skip any you're not sure about.</p></div>
      ${keys.map((k) => { const e = map[k]; return `
        <div class="card freq-row">
          <div class="freq-label" id="fl-${k}"><span class="emo-chip" style="background:${e.soft};color:${e.ink}">${e.icon}</span>${e.label}</div>
          <div class="seg" role="radiogroup" aria-labelledby="fl-${k}">
            ${FREQUENCY.map((f) => `<button type="button" role="radio" aria-checked="${ob.frequency[k] === f.key}"
              class="${ob.frequency[k] === f.key ? 'selected' : ''}" data-e="${k}" data-v="${f.key}">${f.label}</button>`).join('')}
          </div>
        </div>`; }).join('')}
      ${nav(true)}
    </div>`, step);
  app.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => {
    ob.frequency[b.dataset.e] = +b.dataset.v;
    b.parentElement.querySelectorAll('button').forEach((x) => { x.classList.toggle('selected', x === b); x.setAttribute('aria-checked', x === b); });
    app.querySelector('#err').classList.add('hidden');
  }));
  app.querySelector('#back').onclick = back;
  app.querySelector('#next').onclick = () => {
    next();
  };
}
const toughFeelings = Object.fromEntries(EMOTION_KEYS.map((k) => [k, EMOTIONS[k]]));
function menuFrequency() {
  frequencyPage({ map: toughFeelings, title: 'How often do you feel these?', step: 4, back: menuFavorites, next: menuGoodFrequency });
}
function menuGoodFrequency() {
  frequencyPage({ map: POSITIVE_EMOTIONS, title: 'And how often do you feel these?', step: 5, back: menuFrequency, next: menuHappy });
}

// Menu 6: two things that make you happy
function menuHappy() {
  shell(`
    <div class="card stack">
      <div class="center"><div class="hero-ic">${icon('smile', { size: '2.5rem' })}</div>${heading('Two things that make you happy')}
        <p class="muted">Anything counts: people, places, activities, pets. You can skip this.</p></div>
      <label>First thing<input id="h0" value="${esc(ob.happy[0])}" placeholder="Playing basketball with friends" maxlength="${LIMITS.happy}" /></label>
      <label>Second thing<input id="h1" value="${esc(ob.happy[1])}" placeholder="My dog" maxlength="${LIMITS.happy}" /></label>
      ${nav(true)}
    </div>`, 6);
  const read = () => { ob.happy = [app.querySelector('#h0').value.trim(), app.querySelector('#h1').value.trim()]; };
  app.querySelector('#back').onclick = () => { read(); menuGoodFrequency(); };
  app.querySelector('#next').onclick = () => {
    read();
    menuStrategies();
  };
}

// Shared: a strategy row the student can tap to pick (aria-pressed), with its own read-aloud button.
// "Ask first" marks strategies that mean leaving the seat or getting permission.
const strategyRow = (st, on) => `
  <div class="strat-row">
    <button type="button" class="card strat strat-pick" data-strat="${st.key}" aria-pressed="${on}">
      <span class="strat-icon" aria-hidden="true">${st.icon}</span>
      <span class="strat-text"><b>${esc(st.label)}</b>${st.inSeat ? '' : ' <span class="pill gray">Ask first</span>'}
        <span class="muted">${esc(st.detail)}</span></span>
    </button>
    ${speakBtn(`${st.label}. ${st.detail}`)}
  </div>`;

// "Add my own idea": a small input + Add button. onAdd(text) decides what happens next.
const ownAdder = (id) => `
  <div class="own-add row">
    <label class="sr-only" for="${id}">Your own idea</label>
    <input id="${id}" maxlength="${LIMITS.strategy}" placeholder="Listen to my favorite song" />
    <button type="button" class="btn ghost small" data-add="${id}">Add</button>
  </div>`;
function wireAdder(root, id, onAdd) {
  const input = root.querySelector(`#${id}`);
  const add = () => { const t = input.value.trim().slice(0, LIMITS.strategy); if (t) { onAdd(t); input.value = ''; } input.focus(); };
  root.querySelector(`[data-add="${id}"]`).onclick = add;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
}

// Menu 7: pick the strategies that work for you (they show first at every check-in)
function menuStrategies() {
  shell(`
    <div class="stack">
      <div class="center">${heading('What helps you calm down?')}
        <p class="muted">Tap up to ${MAX_PICKS}. You'll see these first when you take a calm break.</p></div>
      <div class="stack">${STRATEGIES.map((st) => strategyRow(st, ob.strategies.includes(st.key))).join('')}</div>
      <div class="card stack">
        <b>Your own ideas (optional)</b>
        <ul class="own-list">${ob.own.map((t, i) => `<li><span>${esc(t)}</span><button type="button" class="btn ghost small" data-del="${i}" aria-label="Remove ${esc(t)}">Remove</button></li>`).join('')}</ul>
        ${ob.own.length < MAX_OWN ? ownAdder('own-new') : `<p class="muted small">That's ${MAX_OWN} ideas. Remove one to add another.</p>`}
      </div>
      ${nav(true, 'Finish')}
    </div>`, 7);
  app.querySelectorAll('[data-strat]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.strat;
    if (ob.strategies.includes(k)) ob.strategies = ob.strategies.filter((x) => x !== k);
    else if (ob.strategies.length < MAX_PICKS) ob.strategies.push(k);
    else return showErr(`You can pick up to ${MAX_PICKS}. Tap one to unpick it. You can still add your own ideas below.`);
    app.querySelector('#err').classList.add('hidden');
    app.querySelectorAll('[data-strat]').forEach((x) => x.setAttribute('aria-pressed', ob.strategies.includes(x.dataset.strat)));
  }));
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { ob.own.splice(+b.dataset.del, 1); menuStrategies(); }));
  if (app.querySelector('#own-new')) wireAdder(app, 'own-new', (t) => { if (!ob.own.includes(t)) ob.own.push(t); menuStrategies(); app.querySelector('#own-new')?.focus(); });
  app.querySelector('#back').onclick = menuHappy;
  const next = app.querySelector('#next');
  next.onclick = () => busy(next, async () => {
    const pending = app.querySelector('#own-new')?.value.trim(); // typed but not added yet: keep it
    if (pending && !ob.own.includes(pending) && ob.own.length < MAX_OWN) ob.own.push(pending.slice(0, LIMITS.strategy));
    try {
      student = await withRetry(() => db.createStudent({
        class_code: ob.code, name: ob.name,
        profile: { subjects: ob.subjects, favorites: ob.favorites, frequency: ob.frequency, happy: ob.happy, strategies: ob.strategies, own_strategies: ob.own },
      }), 3);
      local.set('cc_student', { id: student.id });
      connect();
      renderHome();
      toast("You're all set!");
    } catch (e) { showErr(friendly(e, "We couldn't save your answers. Your answers are still here. Try Finish again.")); }
  });
}

// ============================================================ Home
// One job: a calm "you're in class" screen with one action. History is a reflection, not a dashboard.
function reflection(list) {
  const self = list.filter((b) => b.initiated_by === 'student').length;
  const n = list.length;
  if (self >= 1) return `You've asked for ${self} calm break${self === 1 ? '' : 's'} yourself. Noticing when you need one is a real skill.`;
  return `You've taken ${n} calm break${n === 1 ? '' : 's'}. When you notice things getting big, you can ask for one yourself.`;
}

// The student's own calm-down plan (what they picked in setup, plus ideas they added), so it's
// always in view, not just mid-break. Only real picks: no defaults filled in for them.
function planHtml() {
  const p = student.profile || {};
  const mine = [...(p.strategies || []).map((k) => STRATEGY_BY_KEY[k]).filter(Boolean), ...ownList(p).map(ownStrategy)];
  if (!mine.length) return '';
  return `
    <section class="card plan" aria-labelledby="plan-h">
      <h2 id="plan-h" class="plan-h">${icon('wind')} My calm-down plan</h2>
      <ul class="plan-list">
        ${mine.map((st) => `<li class="plan-item">
          <span class="strat-icon" aria-hidden="true">${st.icon}</span>
          <span class="plan-text"><b>${esc(st.label)}</b>${st.detail && !st.key.startsWith('own:') ? `<span class="muted">${esc(st.detail)}</span>` : ''}</span>
          ${speakBtn(`${st.label}. ${st.key.startsWith('own:') ? '' : st.detail}`)}
        </li>`).join('')}
      </ul>
    </section>`;
}

async function renderHome() {
  if (brk) return;
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">${icon('compass', { size: '1.4rem' })} Calm Compass</span><span class="spacer"></span>
      ${MODE === 'local' ? '<span class="pill gray">Demo mode</span>' : ''}
    </header>
    <main class="wrap stack home">
      <section class="center stack home-main">
        ${heading(`Hey ${student.name}, you're in class.`)}
        <p class="muted lead">If things start to feel like a lot, you can take a calm break anytime.</p>
        <button class="btn btn-big" id="brk">${icon('hand')} I need a break</button>
      </section>
      ${planHtml()}
      <section id="history" class="history"></section>
      <p class="center"><button class="btn ghost small" id="switch">Not ${esc(student.name)}? Switch student</button></p>
    </main>`;
  const b = app.querySelector('#brk');
  b.onclick = () => busy(b, requestBreak);
  app.querySelector('#switch').onclick = () => {
    if (!confirm(`Switch student on this device? ${student.name}'s check-ins stay saved.`)) return;
    local.del('cc_student'); subs.forEach((u) => u()); subs = []; student = null; ob = blankOb(); menuBasics();
  };
  const el = app.querySelector('#history');
  try {
    const list = (await db.listBreaks({ studentId: student.id })).filter((x) => x.ended_at);
    if (!list.length) return; // nothing to reflect on yet: keep the screen to its one job
    const recent = [...list].reverse().slice(0, 5);
    el.innerHTML = `
      <p class="reflect">${esc(reflection(list))}</p>
      <details class="my-checkins">
        <summary>See my check-ins</summary>
        <ul class="checkin-list">
          ${recent.map((x) => { const e = EMOTIONS[x.emotion]; return `<li><span class="muted">${new Date(x.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span> ${e ? `<span class="emo-inline" style="color:${e.ink}">${e.icon}</span> ${e.label}` : (BODY_FEELINGS[x.body_feeling] ? `<span class="emo-inline">${BODY_FEELINGS[x.body_feeling].icon}</span> Body felt ${BODY_FEELINGS[x.body_feeling].label.toLowerCase()}` : 'Check-in')}${x.initiated_by === 'student' ? ' · you asked' : ''}</li>`; }).join('')}
        </ul>
        ${list.length >= 5 ? '<div id="report"></div>' : ''}
      </details>`;
    const rep = el.querySelector('#report');
    if (rep) el.querySelector('details').addEventListener('toggle', function draw() {
      if (!this.open) return; this.removeEventListener('toggle', draw);
      renderReport(rep, list, { audience: 'kid', profile: student.profile });
    });
  } catch (e) { el.innerHTML = `<p class="muted center">${esc(friendly(e, "Your check-ins couldn't load right now."))}</p>`; }
}

// ============================================================ Realtime
function connect() {
  subs.forEach((u) => u());
  subs = [db.announce(student.class_code, student.id), db.subscribeStudent(student.id, onStudentChange)];
}

async function onStudentChange(row) {
  if (!row) return;
  student = { ...student, ...row };
  if (row.status === 'break' && row.current_break && brk?.id !== row.current_break) {
    const all = await db.listBreaks({ studentId: student.id }).catch(() => []);
    openBreak(all.find((b) => b.id === row.current_break) || { id: row.current_break, initiated_by: 'instructor' });
  } else if (row.status === 'learning' && brk) {
    closeBreak();
    toast('Welcome back to class.');
  }
}

async function requestBreak() {
  if (brk) return;
  try {
    const b = await withRetry(() => db.createBreak({ student_id: student.id, class_code: student.class_code, initiated_by: 'student' }), 3);
    openBreak(b);
    await withRetry(() => db.updateStudent(student.id, { status: 'break', current_break: b.id, stimulus: null }));
  } catch (e) { toast(friendly(e, "Couldn't start your break. Raise your hand and tell your teacher, or try again.")); }
}

// ============================================================ Break flow
function openBreak(b) {
  brk = { ...b };
  hideToast();                              // a leftover "You're all set!" shouldn't sit on top of the break
  overlay?.remove();
  overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'brk-h');
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  app.inert = true;                         // keep keyboard + screen reader inside the break
  requestAnimationFrame(() => overlay?.classList.add('in'));
  breakSub?.(); breakSub = db.subscribeBreak(brk.id, onBreakChange);
  resumeAt(brk.step);
}

// Reopen at the right step after a reload or a reconnect.
function resumeAt(step) {
  const hasEmotion = !!brk.emotion;
  if (!step || step === 'started' || step === 'pause') return stepPause();
  if (step === 'body') return stepBody();
  const hasFeeling = hasEmotion || !!brk.body_feeling;
  if (step === 'strength' && hasFeeling) return stepStrength();
  if (step === 'reason' && hasFeeling) return stepReason();
  if (step === 'strategies') return stepChoose();
  if (step === 'activity') return runActivity();
  if (step === 'time_up') return stepTimeUp();
  if (['waiting_stimulus', 'calming', 'calm_done'].includes(step)) return stepChoose(); // breaks from before the timer flow
  return stepEmotion();
}

function closeBreak() {
  stopCalm();
  breakSub?.(); breakSub = null;
  overlay?.remove(); overlay = null; brk = null;
  document.body.style.overflow = '';
  app.inert = false;
  renderHome().then(() => app.querySelector('#brk')?.focus());
}

function stopCalm() {
  calm.stim?.stop(); calm.breathing?.stop(); clearInterval(calm.tick);
  calm = { stim: null, breathing: null };
}

// Save a check-in answer: update locally right away, retry the network write in the background.
let warnedSave = false;
const save = (patch) => {
  Object.assign(brk, patch);
  const id = brk.id;
  return withRetry(() => db.updateBreak(id, patch)).catch((e) => {
    console.error(e);
    if (!warnedSave) { warnedSave = true; toast("Your teacher might not see your answers right away. That's okay, keep going."); }
  });
};

// Frame: status line, the step content, and a quiet control bar (Back + Sound).
function frame(inner, { color, back, action } = {}) {
  overlay.style.background = color || 'var(--bg)';
  const byTeacher = brk.initiated_by === 'instructor';
  overlay.innerHTML = `
    <div class="inner stack">
      <div class="row"><span class="lock-badge">${byTeacher ? 'Calm break · started by your teacher' : 'Your calm break'}</span></div>
      ${inner}
    </div>
    <div class="break-bar">
      ${back ? '<button type="button" class="btn ghost small" data-back>← Back</button>' : '<span></span>'}
      ${action ? `<button type="button" class="btn" id="${action.id}">${esc(action.label)}</button>` : ''}
      <button type="button" class="btn ghost small" data-sound aria-pressed="${muted}">${muted ? 'Sound: off' : 'Sound: on'}</button>
    </div>`;
  if (back) overlay.querySelector('[data-back]').onclick = back;
  overlay.querySelector('[data-sound]').onclick = (e) => {
    muted = !muted; local.set('cc_muted', muted);
    calm.stim?.setMuted(muted);
    e.currentTarget.setAttribute('aria-pressed', muted);
    e.currentTarget.textContent = muted ? 'Sound: off' : 'Sound: on';
  };
  overlay.querySelector('#brk-h')?.focus({ preventScroll: true });
}
const tiles = (items, cls = '') => `<div class="choices ${cls}">${items.map((i) =>
  `<button class="tile" data-k="${i.key}">${i.icon ? `<span class="emoji" style="${i.ink ? `color:${i.ink}` : ''}">${i.icon}</span>` : ''}${esc(i.label)}</button>`).join('')}</div>`;
const onTile = (fn) => overlay.querySelectorAll('.tile').forEach((t) => (t.onclick = () => fn(t.dataset.k)));
// emotion is null when the student tapped "I'm not sure"; NOT_SURE supplies neutral colours/icon.
const emo = () => EMOTIONS[brk.emotion] || NOT_SURE;
const feelingWord = () => (EMOTIONS[brk.emotion] ? emo().label.toLowerCase() : 'this way');

// 1. How do you feel? Five emotions plus "I'm not sure" (which leads to body feelings).
function stepEmotion() {
  save({ step: 'emotion' });
  frame(`
    <div class="center stack">
      ${heading(`How do you feel right now, ${student.name}?`, 'h1', 'brk-h')}
      <p class="reassure">Three quick questions. Tap one answer each.</p>
    </div>
    ${tiles([...EMOTION_KEYS.map((k) => ({ key: k, ...EMOTIONS[k] })), { key: 'notsure', ...NOT_SURE }], 'six')}`);
  onTile((k) => {
    if (k === 'notsure') { save({ emotion: null, step: 'body' }); return stepBody(); }
    save({ emotion: k, body_feeling: null, step: 'strength' }); stepStrength();
  });
}

// 1b. "I'm not sure": how does your body feel? (no emotion words needed)
function stepBody() {
  frame(`
    <div class="center">${heading('How does your body feel?', 'h1', 'brk-h')}</div>
    ${tiles(Object.entries(BODY_FEELINGS).map(([key, b]) => ({ key, ...b })), 'six')}`, { color: NOT_SURE.soft, back: stepEmotion });
  onTile((k) => { save({ body_feeling: k, step: 'strength' }); stepStrength(); });
}

// 2. How strong does it feel?
function stepStrength() {
  const e = emo();
  const back = brk.emotion ? stepEmotion : stepBody;
  frame(`
    <div class="center"><div class="hero-ic" style="color:${e.ink}">${e.icon}</div>${heading(brk.emotion ? `How strong is the ${feelingWord()} feeling?` : 'How big does this feeling seem?', 'h1', 'brk-h')}</div>
    <div class="strength">
      ${STRENGTH.map((s) => `<button class="tile strength-tile" data-k="${s.key}">
        <b class="strength-num">${s.key}</b>${s.label}</button>`).join('')}
    </div>`, { color: e.soft, back });
  onTile((k) => { save({ strength: +k, step: 'reason' }); stepReason(); });
}

// 0. Pause and breathe (30 s): the first thing on screen when any calm break starts, before any
// question. Starts on its own, ends on its own, then the three check-in questions.
function stepPause() {
  const e = NOT_SURE;
  const byTeacher = brk.initiated_by === 'instructor';
  save({ step: 'pause' });
  frame(`
    <div class="card center stack">
      ${heading("Let's start with a breath", 'h1', 'brk-h')}
      <p class="reassure">${byTeacher ? "You're not in trouble. " : 'Good call taking a break. '}Follow the circle for a few breaths.</p>
      <div id="calm"></div>
    </div>`, { color: e.soft });
  stopCalm();
  const session = runBreathing(overlay.querySelector('#calm'), 'var(--accent)', { seconds: PAUSE_SECONDS });
  calm.breathing = session; const breakId = brk.id;
  session.done.then(() => setTimeout(() => {
    if (!brk || brk.id !== breakId || calm.breathing !== session) return;
    calm.breathing = null;
    stepEmotion();
  }, 900));
}

// 3. What happened? One tap on an icon tile (reason_key). Words are optional, behind "Add words".
// Asked after the breathing pause, when it's easier to think about.
function stepReason() {
  const e = emo();
  frame(`
    <div class="center">${heading(brk.emotion ? `What made you feel ${feelingWord()}?` : 'What happened?', 'h1', 'brk-h')}</div>
    ${tiles(Object.entries(REASONS).map(([key, r]) => ({ key, ...r })), 'reasons')}
    <div class="center stack">
      <div class="row reason-actions"><button type="button" class="btn ghost small" id="addwords" aria-expanded="false" aria-controls="words">Add words</button><button type="button" class="btn ghost small" id="skip">Skip</button></div>
      <div id="words" class="card stack" hidden>
        <label class="small">Want to add anything? (optional)
          <textarea id="reason" rows="3" maxlength="${LIMITS.reason}" placeholder="It was really loud in the hallway and…"></textarea></label>
        <p class="muted small">Only your teacher sees this.</p>
        <div class="row"><span class="spacer"></span><button class="btn" id="next">Next →</button></div>
      </div>
    </div>`, { color: e.soft, back: stepStrength });
  const words = overlay.querySelector('#words');
  const text = () => overlay.querySelector('#reason').value.trim().slice(0, LIMITS.reason) || null;
  const go = (patch) => { save({ step: 'strategies', ...patch }); stepChoose(); };
  overlay.querySelector('#addwords').onclick = (ev) => {
    words.hidden = !words.hidden;
    ev.currentTarget.setAttribute('aria-expanded', !words.hidden);
    if (!words.hidden) overlay.querySelector('#reason').focus();
  };
  // A tile tap saves the reason (plus any words already typed) and moves on.
  onTile((k) => go({ reason_key: k, reason: text() }));
  overlay.querySelector('#next').onclick = () => go({ reason_key: null, reason: text() || '(skipped)' });
  overlay.querySelector('#skip').onclick = () => go({ reason_key: null, reason: '(skipped)' });
}

// 4. Pick something to relax: one list with on-screen activities (saved as break.stimulus) and
// the student's coping strategies (break.strategy_used), their own picks first. One choice at a
// time; picking nothing starts the breathing circle. New own ideas are saved for next time.
const choiceKey = () => brk.strategy_used || brk.stimulus || null;
// Back out of "switch" without changing anything: return to the same activity, nothing counted.
function backToActivity() {
  const from = changing?.from;
  changing = null;
  if (from && from !== choiceKey()) save(from.startsWith('own:') || STRATEGY_BY_KEY[from] ? { strategy_used: from, stimulus: null } : { stimulus: from, strategy_used: null });
  save({ step: 'activity', choose_again: false });
  runActivity();
}
const activityKeys = () => [...BUILT_IN_STIMULI, ...(student.audio_url ? ['upload'] : [])];
function stepChoose() {
  const e = emo();
  const { mine, others } = getCopingPlan(student.profile || {}, brk.emotion, brk.strength, brk.reason_key);
  const used = brk.strategy_used; const act = brk.strategy_used ? null : brk.stimulus;
  frame(`
    <div class="center">${heading(brk.choose_again ? 'Your teacher says you can pick something else' : changing ? 'Switch to something else' : 'Pick something to relax', 'h1', 'brk-h')}
      <p class="muted">${brk.choose_again ? 'Pick one. This one doesn\'t count as a switch.'
        : changing ? `This will be switch ${(brk.switches || 0) + 1} of ${MAX_SWITCHES}. Your timer keeps going.`
        : 'Pick one. Your teacher will set a timer for it.'}</p></div>
    <h2 class="list-head">On the screen</h2>
    <div class="choices activities">${activityKeys().map((k) => `
      <button type="button" class="tile act-tile" data-act="${k}" aria-pressed="${act === k}">
        <span class="emoji">${STIMULI[k].icon}</span>${esc(KID_ACTIVITIES[k].label)}</button>`).join('')}</div>
    <h2 class="list-head">On your own</h2>
    <div class="stack">${[...mine, ...others].map((st) => strategyRow(st, used === st.key)).join('')}</div>
    ${ownList(student.profile).length < MAX_OWN ? `<details class="more-ideas"><summary>Add my own idea</summary>${ownAdder('own-now')}</details>` : ''}`,
  // The list is long, so "Start" lives in the always-visible bottom bar.
  { color: e.soft, back: brk.calm_started_at ? backToActivity : stepReason, action: { id: 'start', label: 'Start' } });
  const mark = () => {
    overlay.querySelectorAll('[data-act]').forEach((x) => x.setAttribute('aria-pressed', !brk.strategy_used && x.dataset.act === brk.stimulus));
    overlay.querySelectorAll('[data-strat]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.strat === brk.strategy_used));
  };
  overlay.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
    const on = brk.strategy_used || brk.stimulus !== b.dataset.act;
    save({ stimulus: on ? b.dataset.act : null, strategy_used: null }); mark();
  }));
  overlay.querySelectorAll('[data-strat]').forEach((b) => (b.onclick = () => {
    const next = brk.strategy_used === b.dataset.strat ? null : b.dataset.strat; // tap again to unpick
    save({ strategy_used: next, stimulus: null }); mark();
  }));
  if (overlay.querySelector('#own-now')) wireAdder(overlay, 'own-now', async (t) => {
    const profile = { ...(student.profile || {}), own_strategies: [...new Set([...(student.profile?.own_strategies || []), t])] };
    student = { ...student, profile };
    db.updateStudent(student.id, { profile }).catch((err) => console.error(err)); // saved for next time
    save({ strategy_used: ownKey(t), stimulus: null });
    stepChoose();
  });
  overlay.querySelector('#start').onclick = () => {
    unlockAudio(); // this tap lets the browser play sound later
    if (!brk.strategy_used && !brk.stimulus) save({ stimulus: 'breathe' });
    const patch = { step: 'activity' };
    if (!brk.calm_started_at) patch.calm_started_at = new Date().toISOString();
    // A switch counts only when the student changed it themselves, to something different.
    if (changing && !brk.choose_again && choiceKey() !== changing.from) patch.switches = (brk.switches || 0) + 1;
    if (brk.choose_again) patch.choose_again = false;
    changing = null;
    save(patch);
    runActivity();
  };
}

// 5. The activity. It starts right away with no end; the countdown pops up when the teacher sets
// the timer (break.timer_ends_at, pushed through the break row). When it reaches 0: time's up.
function runActivity() {
  if (!brk) return;
  if (brk.paused_at) return stepPaused();
  const e = emo();
  const switchesLeft = MAX_SWITCHES - (brk.switches || 0);
  const strat = brk.strategy_used ? (STRATEGY_BY_KEY[brk.strategy_used] || (brk.strategy_used.startsWith('own:') ? ownStrategy(brk.strategy_used.slice(4)) : null)) : null;
  const key = strat ? null : (brk.stimulus && STIMULI[brk.stimulus] ? brk.stimulus : 'breathe');
  const a = key && KID_ACTIVITIES[key];
  const how = key === 'draw' ? '' : key === 'trace' ? '' : key === 'breathe' ? 'Breathe with the circle.' : key ? 'Listen and breathe with the circle.' : '';
  frame(`
    <div class="card center stack activity">
      <div id="timerbox" class="timer-box" aria-live="polite"></div>
      ${strat ? `
        <div class="hero-ic">${strat.icon}</div>
        ${heading(strat.label, 'h2', 'brk-h')}
        ${strat.key.startsWith('own:') ? '' : `<p class="lead">${esc(strat.detail)}</p>`}
        <p class="muted">Do this until the timer runs out. You can look away from the screen.</p>`
      : `${heading(a.label, 'h2', 'brk-h')}${how ? `<p class="muted">${how}</p>` : ''}
        <div id="calm"></div>
        <button class="btn ghost small hidden" id="tapsound">${icon('play')} Tap to start the sound</button>`}
      <div class="switch-row">${switchesLeft > 0
        ? `<button type="button" class="btn ghost small" id="switch-act">${icon('shuffle')} Switch activity · ${switchesLeft} left</button>`
        : `<p class="muted small">You've switched ${MAX_SWITCHES} times. Your teacher can still let you change.</p>`}</div>
    </div>`, { color: e.soft });
  overlay.querySelector('#switch-act')?.addEventListener('click', () => {
    stopCalm(); changing = { from: choiceKey() };
    save({ step: 'strategies' }); stepChoose();
  });
  stopCalm();
  if (key) {
    calm.stim = STIMULI[key].kind === 'audio' ? startStimulus(key, { url: student.audio_url, muted }) : null;
    const run = key === 'draw' ? runDrawing : key === 'trace' ? runTrace : (el, opts) => runBreathing(el, e.color, { ...opts, showTimer: false });
    calm.breathing = run(overlay.querySelector('#calm'), { seconds: Infinity });
    const stim = calm.stim;
    // Autoplay fallback: if the browser blocked sound, offer a tap to start it.
    if (stim) setTimeout(() => {
      const b = overlay?.querySelector('#tapsound');
      if (b && calm.stim === stim && !muted && !stim.isPlaying()) { b.classList.remove('hidden'); b.onclick = () => { stim.retry(); b.classList.add('hidden'); }; }
    }, 800);
  }
  const box = overlay.querySelector('#timerbox'); const breakId = brk.id;
  let shown = null;
  const update = () => {
    if (!brk || brk.id !== breakId) return;
    const left = timerLeft(brk);
    if (left === null) {
      if (shown !== 'waiting') { shown = 'waiting'; box.className = 'timer-box waiting'; box.innerHTML = `<span class="muted">${icon('clock')} Your teacher is setting a timer for you.</span>`; }
      return;
    }
    if (shown !== 'timer') {
      shown = 'timer'; box.className = 'timer-box set';
      box.innerHTML = `<div class="timer-clock" role="timer" aria-label="Time left"><span data-clock></span><small>left</small></div><div class="timer-bar"><div data-bar></div></div>`;
    }
    const total = Math.max(1, (timerTotalSec(brk) || 60) * SEC_MS);
    box.querySelector('[data-clock]').textContent = clock(left);
    box.querySelector('[data-bar]').style.width = `${Math.min(100, (100 * left) / total)}%`;
    if (left <= 0) timeUp();
  };
  const timeUp = () => {
    if (!brk || brk.id !== breakId || brk.step === 'time_up') return;
    stopCalm();
    save({ step: 'time_up' });
    stepTimeUp();
  };
  calm.tick = setInterval(update, 250); calm.update = update; update();
}

// Teacher paused the activity: everything stops (sound too) until they resume it.
// While paused, the teacher can start a 30-second breathing exercise; afterwards it stays paused
// until the teacher resumes.
function stepPaused({ breathe = false } = {}) {
  stopCalm();
  frame(breathe ? `
    <div class="card center stack">
      ${heading("Let's breathe together", 'h1', 'brk-h')}
      <p class="lead">Your teacher started a short breathing break. Follow the circle.</p>
      <div id="calm"></div>
    </div>` : `
    <div class="card center stack">
      <div class="hero-ic">${icon('pause', { size: '2.5rem' })}</div>
      ${heading('Paused for a moment', 'h1', 'brk-h')}
      <p class="lead">Your teacher paused your activity. Your timer is paused too.</p>
      <p class="muted">Take a slow breath. It will start again soon.</p>
    </div>`, { color: emo().soft });
  if (!breathe) return;
  const session = runBreathing(overlay.querySelector('#calm'), 'var(--accent)', { seconds: PAUSE_SECONDS });
  calm.breathing = session; const breakId = brk.id;
  session.done.then(() => setTimeout(() => {
    if (!brk || brk.id !== breakId || calm.breathing !== session || !brk.paused_at) return;
    calm.breathing = null; stepPaused();
  }, 900));
}

// 6. Time's up: "Did it help?", then wait for the teacher to bring the student back to class.
function stepTimeUp() {
  const e = emo();
  frame(`
    <div class="card center stack calm-done">
      <div class="hero-ic ok-ic">${icon('check', { size: '2.5rem' })}</div>
      ${heading(brk.skipped ? `Your teacher ended this activity. Nice work, ${student.name}.` : `Time's up. Nice work, ${student.name}.`, 'h1', 'brk-h')}
      <p class="lead">Taking time to reset is a real skill.</p>
      <div class="helped stack">
        <p class="helped-q" id="helped-q">Did it help?</p>
        <div class="seg helped-seg" role="radiogroup" aria-labelledby="helped-q">
          ${HELPED.map((h) => `<button type="button" role="radio" data-helped="${h.key}" aria-checked="${brk.helped === h.key}"
            class="${brk.helped === h.key ? 'selected' : ''}">${h.icon} ${h.label}</button>`).join('')}
        </div>
      </div>
      <p class="reassure">Your teacher will let you know when it's time to go back to class.</p>
    </div>`, { color: e.soft });
  overlay.querySelectorAll('[data-helped]').forEach((b) => (b.onclick = () => {
    save({ helped: +b.dataset.helped });
    overlay.querySelectorAll('[data-helped]').forEach((x) => { const on = x === b; x.classList.toggle('selected', on); x.setAttribute('aria-checked', on); });
  }));
}

// The teacher's side of the break row: timer (set / +2 min), pause, skip, and "pick another".
const TEACHER_FIELDS = ['timer_ends_at', 'timer_minutes', 'timer_seconds', 'paused_at', 'skipped', 'choose_again', 'breathe_at'];
function onBreakChange(row) {
  if (!brk || row?.id !== brk.id) return;
  if (TEACHER_FIELDS.every((k) => (row[k] ?? null) === (brk[k] ?? null))) return;
  const prev = { ...brk };
  TEACHER_FIELDS.forEach((k) => (brk[k] = row[k] ?? null));
  const live = ['activity', 'strategies', 'time_up'].includes(brk.step);
  if (live && brk.skipped && !prev.skipped && brk.step !== 'time_up') {
    stopCalm(); changing = null; save({ step: 'time_up' }); return stepTimeUp();
  }
  if (live && brk.choose_again && !prev.choose_again) {
    stopCalm(); changing = brk.calm_started_at && brk.step !== 'strategies' ? { from: choiceKey() } : changing;
    save({ step: 'strategies' }); return stepChoose();
  }
  if (brk.step === 'activity') {
    if ((brk.paused_at || null) !== (prev.paused_at || null)) return runActivity(); // paused or resumed
    if (brk.paused_at && brk.breathe_at && brk.breathe_at !== prev.breathe_at) return stepPaused({ breathe: true }); // teacher: "30-second breathing"
    calm.update?.();
  } else if (brk.step === 'time_up' && timerLeft(brk) > 0) { save({ step: 'activity' }); runActivity(); } // "a bit longer"
}

// ============================================================ Boot
watchConnection();
(async function boot() {
  const me = local.get('cc_student');
  if (!me?.id) return menuBasics();
  try {
    student = await db.getStudent(me.id);
    if (!student) { local.del('cc_student'); return menuBasics(); }
    connect();
    await renderHome();
    if (student.status === 'break' && student.current_break) {
      const all = await db.listBreaks({ studentId: student.id });
      const b = all.find((x) => x.id === student.current_break);
      if (b && !b.ended_at) openBreak(b);
    }
  } catch (e) {
    app.innerHTML = `<main class="wrap"><div class="card stack"><p>${esc(friendly(e, "Calm Compass couldn't connect."))}</p><button class="btn" onclick="location.reload()">Try again</button></div></main>`;
  }
})();
