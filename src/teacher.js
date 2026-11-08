import { db, MODE, local } from './db.js';
import {
  EMOTIONS, EMOTION_KEYS, REASONS, BODY_FEELINGS, SUBJECTS, POSITIVE_EMOTIONS, HELPED, strategyLabel, ownList, subjectStats, FAVORITES, FREQUENCY, STRENGTH, STIMULI, stimulusLabel, TIMER_PRESETS, EXTRA_MINUTES, MAX_SWITCHES, SEC_MS, CUSTOM_STEP, CUSTOM_MIN, CUSTOM_MAX, CUSTOM_START, PAUSE_SECONDS, timerTotalSec, fmtDur, timerLeft, clock,
} from './content.js';
import { chime } from './calm.js';
import { renderReport } from './charts.js';
import { buildDemo } from './demo.js';
import './fonts.js';
import { icon } from './icons.js';
import { esc, toast, friendly, withRetry, watchConnection, busy } from './ui.js';

const app = document.getElementById('app');
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const mins = (a, b) => { const s = Math.max(0, Math.round((new Date(b) - new Date(a)) / 1000)); return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; };
const START_DELAY = 3; // seconds to cancel a calm break before it takes over the student's screen

let cls = null;
let students = new Map();
let breaks = new Map();
let online = new Set();
let subs = [];
let tab = 'live';
let reportStudent = 'all';
let feed = [];
const seen = new Map();         // break id -> last known row (for feed diffs)
const openProfiles = new Set(); // student ids with the profile panel expanded
const openSettings = new Set(); // ...and with calming settings expanded
const revealed = new Set();     // student ids whose check-in answers are shown (hidden by default: screens get projected)
const pending = new Map();      // student id -> { left, timer } while a calm break start can still be cancelled
const customTime = new Map();  // student id -> custom timer length in seconds (stepped by 30 s)
const notified = new Set();     // break ids whose "time's up" the teacher has already been told about

// Where a break stands for the teacher: the student is doing an activity with no timer yet, or the timer has run out.
const needsTimer = (b) => !!b && !b.ended_at && b.step === 'activity' && !b.timer_ends_at;
const timeIsUp = (b) => !!b && !b.ended_at && (b.step === 'time_up' || (b.step === 'activity' && timerLeft(b) === 0));
const activityLabel = (b, s) => (b.strategy_used ? strategyLabel(b.strategy_used, s?.profile) : b.stimulus ? stimulusLabel(b.stimulus, s) : 'an activity');

const STEP_LABEL = {
  started: 'starting', pause: 'breathing first', emotion: 'checking in · 1 of 3', body: 'checking in · 1 of 3', strength: 'checking in · 2 of 3',
  reason: 'checking in · 3 of 3', strategies: 'choosing what to do', activity: 'activity', time_up: "time's up", done: 'finished',
};

// ============================================================ Setup
function renderSetup() {
  app.innerHTML = `
    <main class="wrap stack wrap-setup">
      <div class="center"><div class="hero-ic">${icon('school', { size: '2.5rem' })}</div><h1>Teacher portal</h1>
        <p class="muted">${MODE === 'local' ? 'Demo mode: works in this browser only (no Supabase keys set).' : 'Connected to Supabase.'}</p></div>
      <div class="card stack">
        <h3>Create a class</h3>
        <label class="small">Your name, as students will see it<input id="tname" placeholder="Ms. Rivera" maxlength="40" /></label>
        <p id="err" class="err hidden" role="alert"></p>
        <button class="btn" id="create">Create class</button>
      </div>
      <div class="card stack">
        <h3>Open an existing class</h3>
        <label class="small">Class code<input id="code" placeholder="K7Q2M" maxlength="8" class="code-input" autocomplete="off" spellcheck="false" /></label>
        <p id="err2" class="err hidden" role="alert"></p>
        <button class="btn ghost" id="open">Open</button>
      </div>
      <div class="card stack">
        <h3>Demo</h3>
        <p class="muted m0">Creates a class with 3 sample students and 4 weeks of break history so the reports have data.</p>
        <button class="btn ghost" id="demo">Create demo class</button>
      </div>
    </main>`;
  const $ = (s) => app.querySelector(s);
  const err = (id, msg) => { const e = $(id); e.textContent = msg; e.classList.remove('hidden'); };
  $('#create').onclick = (ev) => busy(ev.currentTarget, async () => {
    const n = $('#tname').value.trim();
    if (!n) { $('#tname').focus(); return err('#err', 'Type your name first.'); }
    try { start(await withRetry(() => db.createClass(n), 3)); } catch (e) { err('#err', friendly(e, "Couldn't create the class. Try again.")); }
  });
  $('#open').onclick = (ev) => busy(ev.currentTarget, async () => {
    const code = $('#code').value.replace(/\s+/g, '').toUpperCase();
    if (!code) { $('#code').focus(); return err('#err2', 'Type the class code first.'); }
    try {
      const c = await db.getClass(code);
      c ? start(c) : err('#err2', `No class found with the code ${code}. Check the code and try again.`);
    } catch (e) { err('#err2', friendly(e, "Couldn't open the class. Try again.")); }
  });
  $('#demo').onclick = async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Building demo…';
    try { start(await buildDemo(db)); } catch (e) { toast(friendly(e, "Couldn't build the demo class.")); b.disabled = false; b.textContent = 'Create demo class'; }
  };
}

// ============================================================ Dashboard
async function start(c) {
  cls = c; local.set('cc_class', { code: c.code });
  try {
    students = new Map((await db.listStudents(c.code)).map((s) => [s.id, s]));
    breaks = new Map((await db.listBreaks({ classCode: c.code })).map((b) => [b.id, b]));
  } catch (e) { toast(friendly(e, "Couldn't load the class. Refresh to try again.")); }
  breaks.forEach((b) => seen.set(b.id, b));
  feed = [];
  subs.forEach((u) => u());
  subs = [
    db.subscribeClass(c.code, {
      onStudent: (s) => { students.set(s.id, { ...students.get(s.id), ...s }); if (s.status === 'learning') revealed.delete(s.id); refresh(); },
      onBreak: (b) => { const merged = { ...breaks.get(b.id), ...b }; breaks.set(b.id, merged); logBreak(merged); refresh(); },
    }),
    db.watchPresence(c.code, (set) => { online = set; refreshPresence(); }),
  ];
  renderShell();
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">${icon('compass', { size: '1.4rem' })} Calm Compass</span>
      <div class="tabs tabs-gap" role="tablist">
        <button role="tab" aria-selected="${tab === 'live'}" data-tab="live" class="${tab === 'live' ? 'active' : ''}">Live class</button>
        <button role="tab" aria-selected="${tab === 'reports'}" data-tab="reports" class="${tab === 'reports' ? 'active' : ''}">Reports</button>
      </div>
      <span class="spacer"></span>
      ${MODE === 'local' ? '<span class="pill gray">Demo mode</span>' : ''}
      <span class="pill">Class ${esc(cls.code)}</span>
      <span class="muted">${esc(cls.teacher_name)}</span>
      <button class="btn ghost small" id="switch">Switch class</button>
    </header>
    <main class="wrap stack wrap-wide" id="main"></main>`;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderShell(); }));
  app.querySelector('#switch').onclick = () => {
    if ([...students.values()].some((s) => s.status === 'break') && !confirm('A student is on a calm break. Switch class anyway? Their break keeps going.')) return;
    subs.forEach((u) => u()); subs = []; local.del('cc_class'); renderSetup();
  };
  tab === 'live' ? renderLive() : renderReports();
}

function renderLive() {
  const main = app.querySelector('#main');
  main.innerHTML = `
    <div class="card row">
      <div><b>Class code ${esc(cls.code)}</b>
        <div class="muted small">Students join at ${esc(location.host)}/kid</div></div>
      <span class="spacer"></span>
      <div class="muted" id="summary"></div>
      <button class="btn ghost small" id="showcode">Show join code</button>
    </div>
    <div class="card context-bar">
      ${segHtml('Subject right now', 'subject', SUBJECTS)}
      <p class="muted small m0">Saved with every break, so Reports can show breaks by subject.</p>
    </div>
    <section id="needs" class="needs" aria-label="Students who need you" hidden></section>
    <div class="grid students" id="cards"></div>
    <p class="muted small">Check-in answers stay hidden until you tap "Show answers", so this page is safe to have open while presenting.</p>
    <details class="activity"><summary>Activity log</summary><div class="feed" id="feed" aria-live="off"></div></details>`;
  main.querySelector('#showcode').onclick = showJoinCode;
  main.querySelectorAll('[data-ctx]').forEach((b) => (b.onclick = () => setContext(b.dataset.ctx, b.dataset.v)));
  cardCache.clear(); needsCache = ''; refreshCards(); refreshFeed();
}

// One-tap segmented control for the class context (reuses the onboarding .seg style).
function segHtml(label, field, options) {
  return `
    <div class="ctx-group"><span class="ctx-label" id="ctx-${field}">${label}</span>
      <div class="seg" role="radiogroup" aria-labelledby="ctx-${field}">
        ${Object.entries(options).map(([v, l]) => `<button type="button" role="radio" data-ctx="${field}" data-v="${v}"
          aria-checked="${cls[field] === v}" class="${cls[field] === v ? 'selected' : ''}">${l}</button>`).join('')}
      </div></div>`;
}
// Tap the selected one again to clear it.
async function setContext(field, value) {
  const next = cls[field] === value ? null : value;
  try {
    cls = { ...cls, ...(await withRetry(() => db.updateClass(cls.code, { [field]: next }), 3)) };
    app.querySelectorAll(`[data-ctx="${field}"]`).forEach((b) => {
      const on = b.dataset.v === cls[field];
      b.classList.toggle('selected', on); b.setAttribute('aria-checked', on);
    });
  } catch (e) { toast(friendly(e, "Couldn't save that. Try again.")); }
}

// Full-screen join code for the projector. Contains nothing about students.
function showJoinCode() {
  const opener = document.activeElement;
  const m = document.createElement('div');
  m.className = 'join-view'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Join code');
  m.innerHTML = `
    <div class="center stack">
      <p class="muted join-line">Go to <b>${esc(location.host)}/kid</b> and enter</p>
      <div class="join-code">${esc(cls.code)}</div>
      <button class="btn ghost" id="close">Close (Esc)</button>
    </div>`;
  document.body.append(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.querySelector('#close').onclick = close;
  m.querySelector('#close').focus();
}

const currentBreak = (s) => (s.current_break ? breaks.get(s.current_break) : null);
const lastReport = (s) => [...breaks.values()].filter((b) => b.student_id === s.id && b.ended_at)
  .sort((a, b) => b.ended_at.localeCompare(a.ended_at))[0];

function profileHtml(s) {
  const p = s.profile || {};
  const fav = p.favorites || {};
  const freq = p.frequency || {};
  return `
    <details data-profile ${openProfiles.has(s.id) ? 'open' : ''}>
      <summary>Profile${fav.character || fav.game ? ` <span class="muted">· likes ${esc([fav.character, fav.game].filter(Boolean).join(', '))}</span>` : ''}</summary>
      <div class="profile">
        ${FAVORITES.map((f) => fav[f.key] ? `<div>${f.icon} <span class="muted">${f.label.replace('Favorite ', '')}:</span> ${esc(fav[f.key])}</div>` : '').join('')}
        ${(p.happy || []).filter(Boolean).length ? `<div>${icon('smile')} <span class="muted">Happy things:</span> ${p.happy.filter(Boolean).map(esc).join(', ')}</div>` : ''}
        ${(p.subjects || []).length ? `<div>${icon('book')} <span class="muted">Subjects:</span> ${p.subjects.map((k) => SUBJECTS[k] ?? k).join(', ')}${(() => { const top = subjectStats([...breaks.values()].filter((b) => b.student_id === s.id))[0]; return top && top.n >= 3 ? ` · <b>most breaks in ${esc(top.label)}</b>` : ''; })()}</div>` : ''}
        ${(p.strategies || []).length || ownList(p).length ? `<div>${icon('wind')} <span class="muted">Helps them:</span> ${[...(p.strategies || []).map((k) => strategyLabel(k, p)), ...ownList(p)].map(esc).join(', ')}</div>` : ''}
        <div class="freq-mini">${[...EMOTION_KEYS.map((k) => [k, EMOTIONS[k]]), ...Object.entries(POSITIVE_EMOTIONS)].filter(([k]) => freq[k]).map(([k, e]) => `<span>${e.label}: ${FREQUENCY.find((f) => f.key === freq[k])?.label ?? '–'}</span>`).join('')}</div>
      </div>
    </details>`;
}

// Shared bits of a check-in answer, used on cards and in the break report.
// Emotion when named; otherwise the body feeling the student picked after "I'm not sure".
function feelingHtml(b) {
  const e = EMOTIONS[b.emotion];
  if (e) return `<span class="emo-inline" style="color:${e.ink}">${e.icon}</span> <b>${e.label}</b>`;
  const body = BODY_FEELINGS[b.body_feeling];
  return body ? `<span class="emo-inline">${body.icon}</span> <b>Not sure</b> · body felt ${body.label.toLowerCase()}` : '';
}
// Reason tile plus the student's optional words. '(skipped)' means they skipped the step.
function reasonHtml(b) {
  const r = REASONS[b.reason_key];
  const words = b.reason && b.reason !== '(skipped)' ? `“${esc(b.reason)}”` : '';
  if (!r && !words) return b.reason === '(skipped)' ? '<span class="muted">Skipped "what happened"</span>' : '';
  return [r ? `<span class="emo-inline">${r.icon}</span> ${r.label}` : '', words].filter(Boolean).join(' · ');
}

// Check-in answers: hidden behind a toggle so a projected screen never shows them.
function answersHtml(s, b) {
  const e = EMOTIONS[b.emotion];
  const st = STRENGTH.find((x) => x.key === b.strength);
  const body = BODY_FEELINGS[b.body_feeling];
  const r = REASONS[b.reason_key];
  if (!e && !body && !b.reason && !r) return '<div class="muted">No answers yet.</div>';
  if (!revealed.has(s.id)) return `<button class="btn ghost small" data-reveal aria-expanded="false">Show answers</button>`;
  return `
    <div class="answers">
      ${e || body ? `<div>${feelingHtml(b)}${st ? ` · ${st.key}/5 ${st.label.toLowerCase()}` : ''}</div>` : ''}
      ${r || b.reason ? `<div class="reason">${reasonHtml(b)}</div>` : ''}
      <button class="btn ghost small" data-reveal aria-expanded="true">Hide answers</button>
    </div>`;
}

function breakHtml(s, b) {
  if (!b) return '<div class="muted">Starting…</div>';
  let extra = '';
  if (needsTimer(b)) {
    extra = `<div class="prompt"><b>${esc(s.name)} started: ${esc(activityLabel(b, s))}.</b> How long should it last?${timerButtons(s)}</div>`;
  } else if (timeIsUp(b)) {
    extra = `<div class="prompt ok"><b>${esc(s.name)}'s ${b.skipped ? 'activity was ended' : 'time is up'}.</b> Resume class when it works for you.
      <div class="row"><button class="btn ghost small" data-more>${icon('clock')} ${EXTRA_MINUTES} more min</button>
        <button class="btn ghost small" data-another>${icon('shuffle')} Another activity</button></div></div>`;
  } else if (b.step === 'activity') {
    extra = `<div class="muted">${esc(activityLabel(b, s))} · ${b.paused_at ? '<b>paused</b>' : `<span data-left="${s.id}">${clock(timerLeft(b))}</span> left`}</div>`;
  }
  if (b.step === 'activity' && !timeIsUp(b)) extra += controlsHtml(b);
  if (b.calm_started_at) extra += `<div class="muted small">Switched activity ${b.switches || 0} of ${MAX_SWITCHES} times</div>`;
  return `<div class="break-info">${answersHtml(s, b)}${extra}</div>`;
}

function cardHtml(s) {
  const b = currentBreak(s);
  const onBreak = s.status === 'break';
  const attn = needsTimer(b) || timeIsUp(b);
  const pend = pending.get(s.id);
  const last = !onBreak && lastReport(s);
  const today = [...breaks.values()].filter((x) => x.student_id === s.id && new Date(x.started_at).toDateString() === new Date().toDateString());
  const label = needsTimer(b) ? 'set a timer' : timeIsUp(b) ? "time's up" : b?.paused_at && b.step === 'activity' ? 'paused' : (STEP_LABEL[b?.step] || 'on break');
  return `
    <div class="card student-card ${onBreak ? 'onbreak' : ''} ${attn ? 'needs-you' : ''}" data-id="${s.id}">
      <div class="card-head"><span class="dot ${online.has(s.id) ? 'on' : ''}" aria-label="${online.has(s.id) ? 'online' : 'offline'}" role="img"></span>
        <b class="student-name" title="${esc(s.name)}">${esc(s.name)}</b>
        ${onBreak ? `<span class="pill ${attn ? 'attn' : 'warn'}">${b?.initiated_by === 'student' ? 'asked · ' : ''}${label}</span>` : '<span class="pill">In class</span>'}</div>
      ${onBreak ? breakHtml(s, b) : `
        <div class="muted">${today.length ? `${today.length} break${today.length > 1 ? 's' : ''} today` : 'No breaks today'}${last ? ` · last ${time(last.ended_at)}` : ''}</div>`}
      ${profileHtml(s)}
      ${onBreak ? '' : `
        <details data-settings ${openSettings.has(s.id) ? 'open' : ''}>
          <summary>Calming settings</summary>
          <div class="stack stack-tight">
            <label class="small">Upload calming audio for ${esc(s.name)} (mp3, m4a, wav)
              <input type="file" accept="audio/*" data-upload aria-label="Upload calming audio for ${esc(s.name)}" /></label>
            ${s.audio_url ? `<div class="small muted">Current: ${esc(s.audio_name || 'audio')}</div>` : ''}
          </div>
        </details>`}
      ${onBreak
        ? `<button class="btn ${timeIsUp(b) ? 'ok' : 'ghost'}" data-resume>${icon('play')} Resume class</button>`
        : pend
          ? `<div class="pending row"><span role="status">Starting calm break in <span data-count>${pend.left}</span>…</span><span class="spacer"></span><button class="btn small" data-cancel>Cancel</button></div>`
          : '<div class="card-actions"><button class="btn ghost small quiet" data-start>Start calm break</button></div>'}
    </div>`;
}

// Re-render only the cards whose content changed, so buttons, open menus and file
// pickers aren't replaced mid-click by unrelated updates (e.g. online pings).
const cardCache = new Map(); // student id -> last rendered html
// Who needs the teacher first: needs a timer, time's up, on a break, then in class.
function rank(s) {
  const b = currentBreak(s);
  if (needsTimer(b)) return 0;
  if (timeIsUp(b)) return 1;
  if (s.status === 'break' || pending.has(s.id)) return 2;
  return 3;
}
const sorted = () => [...students.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

// One tap sets how long the student's activity lasts.
// The teacher's override controls while a student is on an activity: pause/resume, end it, or let them pick another.
const controlsHtml = (b) => `
  <div class="teacher-ctl" role="group" aria-label="Activity controls">
    ${b.paused_at ? `<button class="btn small" data-pause>${icon('play')} Resume</button>
      <button class="btn ghost small" data-breathe>${icon('breathe')} 30-sec breathing</button>` : `<button class="btn ghost small" data-pause>${icon('pause')} Pause</button>`}
    <button class="btn ghost small" data-skip>${icon('skip')} End activity</button>
    <button class="btn ghost small" data-another>${icon('shuffle')} Another activity</button>
  </div>`;
// Presets (one tap) plus a custom length the teacher steps up or down in 30-second steps.
const timerButtons = (s) => {
  const v = customTime.get(s.id) ?? CUSTOM_START;
  return `<div class="timer-presets" role="group" aria-label="Timer length">${TIMER_PRESETS.map((m) =>
    `<button class="btn small" data-timer="${m * 60}">${m} min</button>`).join('')}</div>
  <div class="timer-custom" role="group" aria-label="Custom timer">
    <button class="btn ghost small" data-step="-${CUSTOM_STEP}" aria-label="30 seconds less">−30 s</button>
    <span class="custom-val" data-custom aria-live="polite">${clock(v * 1000)}</span>
    <button class="btn ghost small" data-step="${CUSTOM_STEP}" aria-label="30 seconds more">+30 s</button>
    <button class="btn small" data-set-custom>Set</button>
  </div>`;
};

// Sticky strip listing only the students who need an action right now, with that action inline.
let needsCache = '';
function refreshNeeds(list) {
  const el = app.querySelector('#needs'); if (!el) return;
  const rows = list.filter((s) => rank(s) <= 1).map((s) => {
    const b = currentBreak(s);
    if (needsTimer(b)) {
      return `<div class="need" data-id="${s.id}"><b>${esc(s.name)}</b><span>is doing ${esc(activityLabel(b, s))} · set a timer</span><span class="spacer"></span>
        ${timerButtons(s)}</div>`;
    }
    return `<div class="need" data-id="${s.id}"><b>${esc(s.name)}</b><span>time's up</span><span class="spacer"></span>
      <button class="btn ghost small" data-more>${EXTRA_MINUTES} more min</button>
      <button class="btn ghost small" data-another>Another activity</button>
      <button class="btn small ok" data-quick-resume>Resume class</button></div>`;
  });
  const html = rows.join('');
  if (html === needsCache) return;
  needsCache = html;
  el.hidden = !rows.length;
  el.innerHTML = rows.length ? `<h2 class="needs-title">Needs you</h2>${html}` : '';
  el.querySelectorAll('.need').forEach((row) => {
    const s = () => students.get(row.dataset.id);
    const btns = () => row.querySelectorAll('button');
    bindTimer(row, s);
    row.querySelector('[data-quick-resume]')?.addEventListener('click', (ev) => busy(ev.currentTarget, () => resume(s())));
  });
}

function refreshCards() {
  const el = app.querySelector('#cards'); if (!el) return;
  const list = sorted();
  refreshNeeds(list);
  updateSummary(list);
  if (!list.length) {
    el.innerHTML = '<div class="card muted">No students yet. Click "Show join code" and have students open the student page and enter the code.</div>';
    cardCache.clear(); return;
  }
  el.querySelector(':scope > .muted')?.remove();
  [...el.querySelectorAll('.student-card')].forEach((c) => { if (!students.has(c.dataset.id)) { c.remove(); cardCache.delete(c.dataset.id); } });
  list.forEach((s, i) => {
    const html = cardHtml(s);
    let card = el.querySelector(`.student-card[data-id="${s.id}"]`);
    if (card && cardCache.get(s.id) === html) {
      if (el.children[i] !== card) el.insertBefore(card, el.children[i] || null);
      return;
    }
    const hadFocus = card?.contains(document.activeElement) ? document.activeElement.dataset : null;
    const tmp = document.createElement('div'); tmp.innerHTML = html.trim();
    const fresh = tmp.firstElementChild;
    if (card) card.remove();
    el.insertBefore(fresh, el.children[i] || null); // re-insert at its sorted position
    cardCache.set(s.id, html);
    bindCard(fresh, s.id);
    if (hadFocus) fresh.querySelector('[data-resume],[data-start],[data-cancel],[data-reveal]')?.focus();
  });
}

function updateSummary(list = [...students.values()]) {
  const sum = app.querySelector('#summary');
  if (sum) sum.textContent = `${list.filter((s) => online.has(s.id)).length} online · ${list.filter((s) => s.status === 'break').length} on break`;
  const waiting = list.filter((s) => { const b = currentBreak(s); return needsTimer(b) || timeIsUp(b); }).length;
  document.title = `${waiting ? `(${waiting}) ` : ''}Calm Compass · Teacher`;
}

// Online dots change often; update them in place instead of re-rendering cards.
function refreshPresence() {
  document.querySelectorAll('.student-card').forEach((card) => {
    const on = online.has(card.dataset.id);
    const dot = card.querySelector('.dot');
    dot?.classList.toggle('on', on); dot?.setAttribute('aria-label', on ? 'online' : 'offline');
  });
  updateSummary();
}

function bindCard(card, id) {
  const s = () => students.get(id);
  card.querySelector('[data-start]')?.addEventListener('click', () => queueBreak(s()));
  card.querySelector('[data-cancel]')?.addEventListener('click', () => cancelQueuedBreak(id));
  card.querySelector('[data-resume]')?.addEventListener('click', (ev) => busy(ev.currentTarget, () => resume(s())));
  card.querySelector('[data-reveal]')?.addEventListener('click', () => { revealed.has(id) ? revealed.delete(id) : revealed.add(id); refreshCards(); });
  bindTimer(card, s);
  const prof = card.querySelector('[data-profile]');
  prof.ontoggle = () => (prof.open ? openProfiles.add(id) : openProfiles.delete(id));
  const set = card.querySelector('[data-settings]');
  if (set) set.ontoggle = () => (set.open ? openSettings.add(id) : openSettings.delete(id));
  const up = card.querySelector('[data-upload]');
  if (up) up.onchange = async () => {
    const file = up.files[0]; if (!file) return;
    if (!file.type.startsWith('audio/')) { toast('That file isn\'t audio. Choose an mp3, m4a or wav file.'); up.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { toast('That file is over 20 MB. Choose a shorter clip.'); up.value = ''; return; }
    try {
      toast(`Uploading ${file.name}…`, { ms: 20000 });
      const { url, name } = await db.uploadAudio(id, file);
      await db.updateStudent(id, { audio_url: url, audio_name: name });
      toast(`Uploaded ${name} for ${s().name}`);
    } catch (e) { toast(friendly(e, "Upload didn't work. Try again, or pick a smaller file.")); up.value = ''; }
  };
}

// Starting a break takes over the student's screen, so give a few seconds to cancel a misclick.
function queueBreak(s) {
  if (!s || pending.has(s.id) || s.status === 'break') return;
  const p = { left: START_DELAY, timer: null };
  pending.set(s.id, p);
  p.timer = setInterval(() => {
    p.left -= 1;
    if (p.left <= 0) { clearInterval(p.timer); pending.delete(s.id); startBreak(students.get(s.id)); refreshCards(); return; }
    // Update the number in place: re-rendering would swap the Cancel button out from under the pointer.
    const n = app.querySelector(`.student-card[data-id="${s.id}"] [data-count]`);
    if (n) n.textContent = p.left;
  }, 1000);
  refreshCards();
  app.querySelector(`.student-card[data-id="${s.id}"] [data-cancel]`)?.focus();
}
function cancelQueuedBreak(id) {
  const p = pending.get(id); if (!p) return;
  clearInterval(p.timer); pending.delete(id); refreshCards();
  toast('Calm break cancelled.');
}

async function startBreak(s) {
  if (!s || s.status === 'break') return;
  try {
    const b = await withRetry(() => db.createBreak({ student_id: s.id, class_code: cls.code, initiated_by: 'instructor' }), 3);
    breaks.set(b.id, b);
    await withRetry(() => db.updateStudent(s.id, { status: 'break', current_break: b.id, stimulus: null }), 3);
  } catch (e) { toast(friendly(e, `Couldn't start ${s.name}'s calm break. Try again.`)); }
}

// Timer buttons (card and Needs-you strip). Disabled while saving so a double tap doesn't send twice.
function bindTimer(root, getStudent) {
  const btns = () => root.querySelectorAll('[data-timer],[data-set-custom],[data-more],[data-pause],[data-skip],[data-another],[data-breathe]');
  // Re-enable afterwards too: some actions (like the breathing prompt) don't change what the card shows.
  const run = (fn) => { btns().forEach((x) => (x.disabled = true)); fn().catch(() => {}).finally(() => btns().forEach((x) => (x.disabled = false))); };
  root.querySelectorAll('[data-timer]').forEach((b) => (b.onclick = () => run(() => setTimer(getStudent(), +b.dataset.timer))));
  // Custom stepper: update the number in place (strip and card) without re-rendering.
  root.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => {
    const id = getStudent().id;
    const v = Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, (customTime.get(id) ?? CUSTOM_START) + +b.dataset.step));
    customTime.set(id, v);
    app.querySelectorAll(`[data-id="${id}"] [data-custom]`).forEach((el) => (el.textContent = clock(v * 1000)));
  }));
  root.querySelector('[data-set-custom]')?.addEventListener('click', () => run(() => setTimer(getStudent(), customTime.get(getStudent().id) ?? CUSTOM_START)));
  root.querySelector('[data-breathe]')?.addEventListener('click', () => run(() => patchBreak(getStudent(), { breathe_at: new Date().toISOString() }, "Couldn't start the breathing exercise. Try again.")));
  root.querySelector('[data-more]')?.addEventListener('click', () => run(() => addTime(getStudent())));
  root.querySelector('[data-pause]')?.addEventListener('click', () => run(() => togglePause(getStudent())));
  root.querySelector('[data-skip]')?.addEventListener('click', () => run(() => endActivity(getStudent())));
  root.querySelector('[data-another]')?.addEventListener('click', () => run(() => offerAnother(getStudent())));
}

// The timer lives on the break row; the student's tablet listens to that row and shows the countdown.
async function setTimer(s, seconds) {
  const b = currentBreak(s); if (!b) return;
  try {
    const patch = { timer_seconds: seconds, timer_minutes: Math.round(seconds / 60), timer_ends_at: new Date(Date.now() + seconds * SEC_MS).toISOString() };
    const row = await withRetry(() => db.updateBreak(b.id, patch), 3);
    breaks.set(b.id, { ...b, ...row }); refresh();
  } catch (e) { toast(friendly(e, `Couldn't set ${s.name}'s timer. Try again.`)); throw e; }
}
// Timer length after adding the extra minutes (seconds, plus the rounded minutes kept for older reports).
const grow = (b) => { const sec = timerTotalSec(b) + EXTRA_MINUTES * 60; return { timer_seconds: sec, timer_minutes: Math.round(sec / 60) }; };
async function addTime(s) {
  const b = currentBreak(s); if (!b) return;
  try {
    const from = Math.max(Date.now(), new Date(b.timer_ends_at || Date.now()).getTime());
    const patch = {
      ...grow(b), extra_minutes: (b.extra_minutes || 0) + EXTRA_MINUTES,
      timer_ends_at: new Date(from + EXTRA_MINUTES * 60 * SEC_MS).toISOString(), skipped: false, paused_at: null,
    };
    const row = await withRetry(() => db.updateBreak(b.id, patch), 3);
    notified.delete(b.id);
    breaks.set(b.id, { ...b, ...row }); refresh();
  } catch (e) { toast(friendly(e, `Couldn't add time for ${s.name}. Try again.`)); throw e; }
}

const patchBreak = async (s, patch, msg) => {
  const b = currentBreak(s); if (!b) return;
  try {
    const row = await withRetry(() => db.updateBreak(b.id, patch), 3);
    breaks.set(b.id, { ...b, ...row }); refresh();
  } catch (e) { toast(friendly(e, msg)); throw e; }
};
// Pause freezes the timer; resuming pushes the end time out by however long it was paused.
async function togglePause(s) {
  const b = currentBreak(s); if (!b) return;
  if (!b.paused_at) return patchBreak(s, { paused_at: new Date().toISOString() }, `Couldn't pause ${s.name}'s activity. Try again.`);
  const pausedFor = Date.now() - new Date(b.paused_at).getTime();
  return patchBreak(s, { paused_at: null, ...(b.timer_ends_at ? { timer_ends_at: new Date(new Date(b.timer_ends_at).getTime() + pausedFor).toISOString() } : {}) },
    `Couldn't resume ${s.name}'s activity. Try again.`);
}
// End the activity now. The student sees "your teacher ended this activity" and "Did it help?".
async function endActivity(s) {
  const b = currentBreak(s); if (!b) return;
  notified.add(b.id); // the teacher did this, so no "time's up" chime
  return patchBreak(s, { skipped: true, paused_at: null, timer_ends_at: new Date().toISOString() }, `Couldn't end ${s.name}'s activity. Try again.`);
}
// Let the student pick a different activity (doesn't count toward their 3 switches). If their time had
// already run out, add a little time so the new activity can actually happen.
async function offerAnother(s) {
  const b = currentBreak(s); if (!b) return;
  const patch = { choose_again: true, skipped: false, paused_at: null };
  if (b.paused_at && b.timer_ends_at) patch.timer_ends_at = new Date(new Date(b.timer_ends_at).getTime() + (Date.now() - new Date(b.paused_at).getTime())).toISOString();
  if (timeIsUp(b)) {
    Object.assign(patch, { ...grow(b), extra_minutes: (b.extra_minutes || 0) + EXTRA_MINUTES,
      timer_ends_at: new Date(Date.now() + EXTRA_MINUTES * 60 * SEC_MS).toISOString() });
    notified.delete(b.id);
  }
  return patchBreak(s, patch, `Couldn't send that to ${s.name}. Try again.`);
}

// Tell the teacher once when a student's timer runs out: soft chime, toast, feed line, Needs-you strip.
function notifyTimeUp(b) {
  if (notified.has(b.id)) return;
  notified.add(b.id);
  const s = students.get(b.student_id);
  chime();
  toast(`${s?.name || 'A student'}'s time is up. Resume class when it works.`, { ms: 10000 });
  feed.unshift(`<b>${time(new Date().toISOString())}</b> · ${esc(s?.name || 'Student')} <b>time's up</b>`);
  refresh();
}

async function resume(s) {
  try {
    const b = currentBreak(s);
    let done = b;
    if (b && !b.ended_at) done = await withRetry(() => db.updateBreak(b.id, { step: 'done', ended_at: new Date().toISOString() }), 3);
    await withRetry(() => db.updateStudent(s.id, { status: 'learning', current_break: null, stimulus: null }), 3);
    revealed.delete(s.id);
    if (done) { breaks.set(done.id, { ...b, ...done }); showReport(s, { ...b, ...done }); }
  } catch (e) { toast(friendly(e, `Couldn't resume class for ${s.name}. Try again.`)); }
}

// Break report shown to the instructor when a break ends
function showReport(s, b) {
  document.querySelector('.report-modal')?.remove();
  const opener = document.activeElement;
  const e = EMOTIONS[b.emotion];
  const st = STRENGTH.find((x) => x.key === b.strength);
  const m = document.createElement('div');
  m.className = 'report-modal';
  m.innerHTML = `
    <div class="card stack" role="dialog" aria-modal="true" aria-labelledby="rep-h">
      <div class="row"><h2 id="rep-h" class="m0">Break report · ${esc(s.name)}</h2><span class="spacer"></span><span class="pill">Saved</span></div>
      <table><tbody>
        <tr><th scope="row">Started by</th><td>${b.initiated_by === 'instructor' ? 'You' : `${esc(s.name)} asked`}</td></tr>
        <tr><th scope="row">Feeling</th><td>${feelingHtml(b) || '–'}</td></tr>
        <tr><th scope="row">Strength</th><td>${st ? `${st.key}/5 (${st.label.toLowerCase()})` : '–'}</td></tr>
        <tr><th scope="row">What happened</th><td>${reasonHtml(b) || '–'}</td></tr>
        <tr><th scope="row">Subject</th><td>${SUBJECTS[b.subject] || '–'}</td></tr>
        <tr><th scope="row">Tried</th><td>${b.strategy_used ? esc(strategyLabel(b.strategy_used, s.profile)) : '–'}</td></tr>
        <tr><th scope="row">Did it help?</th><td>${HELPED.find((h) => h.key === b.helped)?.label ?? '–'}</td></tr>
        <tr><th scope="row">Activity</th><td>${b.stimulus ? esc(stimulusLabel(b.stimulus, s)) : '–'}</td></tr>
        <tr><th scope="row">Switched</th><td>${b.switches || 0} of ${MAX_SWITCHES}${b.skipped ? ' · ended by you' : ''}</td></tr>
        <tr><th scope="row">Timer</th><td>${timerTotalSec(b) ? `${fmtDur(timerTotalSec(b))}${b.extra_minutes ? ` (incl. +${b.extra_minutes} min)` : ''}` : '–'}</td></tr>
        <tr><th scope="row">Time</th><td>${time(b.started_at)} → ${time(b.ended_at)} (${mins(b.started_at, b.ended_at)})</td></tr>
      </tbody></table>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="toreports">See reports</button><button class="btn" id="close">Close</button></div>
    </div>`;
  document.body.append(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); opener?.isConnected && opener.focus(); };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.querySelector('#close').onclick = close;
  m.querySelector('#toreports').onclick = () => { close(); reportStudent = s.id; tab = 'reports'; renderShell(); };
  m.onclick = (ev) => { if (ev.target === m) close(); };
  m.querySelector('#close').focus();
}

// Feed: what happened, without what the student said (this page may be on a projector).
function logBreak(b) {
  const prev = seen.get(b.id) || {};
  seen.set(b.id, b);
  const s = students.get(b.student_id);
  const name = esc(s?.name || 'Student');
  const add = (msg) => feed.unshift(`<b>${time(new Date().toISOString())}</b> · ${name} ${msg}`);
  if (!prev.id) add(b.initiated_by === 'instructor' ? 'started a calm break (by you)' : 'asked for a calm break');
  if (b.step === 'strategies' && prev.step !== 'strategies') add('finished checking in');
  if (b.step === 'activity' && prev.step !== 'activity' && !b.timer_ends_at) {
    add(`<b>started ${esc(activityLabel(b, s))}. Set a timer on their card.</b>`);
    toast(`${s?.name || 'A student'} started ${activityLabel(b, s)}. Set a timer.`, { ms: 8000 });
  }
  if (b.timer_ends_at && !prev.timer_ends_at) add(`timer set: ${fmtDur(timerTotalSec(b))}`);
  if (b.breathe_at && b.breathe_at !== prev.breathe_at && prev.id) add('30-second breathing started by you');
  if ((b.extra_minutes || 0) > (prev.extra_minutes || 0)) add(`got ${EXTRA_MINUTES} more minutes`);
  if (b.helped && b.helped !== prev.helped) add(`says the break helped: ${HELPED.find((h) => h.key === b.helped)?.label.toLowerCase()}`);
  if (b.step === 'time_up' && prev.step !== 'time_up') setTimeout(() => notifyTimeUp(b));
  if ((b.switches || 0) > (prev.switches || 0)) add(`switched activity (${b.switches} of ${MAX_SWITCHES}): ${esc(activityLabel(b, s))}`);
  if (b.paused_at && !prev.paused_at) add('activity paused by you');
  if (!b.paused_at && prev.paused_at) add('activity resumed');
  if (b.skipped && !prev.skipped) add('activity ended by you');
  if (b.choose_again && !prev.choose_again) add('can pick another activity (from you)');
  if (b.ended_at && !prev.ended_at) add('is back in class. Report saved.');
  feed = feed.slice(0, 80);
}

function refreshFeed() {
  const el = app.querySelector('#feed'); if (!el) return;
  el.innerHTML = feed.length ? feed.map((f) => `<div>${f}</div>`).join('') : '<div class="muted">Calm break activity will show up here live.</div>';
}

let rTimer;
function refresh() {
  if (tab === 'live') { refreshCards(); refreshFeed(); }
  else { updateSummary(); clearTimeout(rTimer); rTimer = setTimeout(drawReport, 400); }
}

// Activity countdowns on cards (updated in place, so open menus stay put). Also catches a timer that
// ran out while the student's tablet was offline, so the teacher still gets told.
setInterval(() => {
  document.querySelectorAll('[data-left]').forEach((el) => {
    const s = students.get(el.dataset.left); const b = s && currentBreak(s);
    if (b?.timer_ends_at) el.textContent = clock(timerLeft(b));
  });
  for (const s of students.values()) { const b = currentBreak(s); if (timeIsUp(b)) notifyTimeUp(b); }
}, 1000);

// ============================================================ Reports
function renderReports() {
  const main = app.querySelector('#main');
  main.innerHTML = `
    <div class="row">
      <h2 class="m0">Reports</h2><span class="spacer"></span>
      <label class="small row gap-8">Show
        <select id="who" class="w-auto">
          <option value="all">All students</option>
          ${[...students.values()].map((s) => `<option value="${s.id}" ${reportStudent === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select></label>
    </div>
    <div id="report"></div>`;
  main.querySelector('#who').onchange = (e) => { reportStudent = e.target.value; drawReport(); };
  drawReport();
}

function drawReport() {
  const el = app.querySelector('#report'); if (!el) return;
  const list = [...breaks.values()].filter((b) => reportStudent === 'all' || b.student_id === reportStudent)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  renderReport(el, list, { audience: 'teacher', studentsById: Object.fromEntries(students), multi: reportStudent === 'all' });
}

// ============================================================ Boot
watchConnection();
(async function boot() {
  const saved = local.get('cc_class');
  const c = saved?.code && (await db.getClass(saved.code).catch(() => null));
  c ? start(c) : renderSetup();
})();
