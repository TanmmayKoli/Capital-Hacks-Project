import { icon } from './icons.js';

// Shared content for the student + instructor portals (and the demo generator).
// v2: one shared "distress" path. Every distressing emotion leads to the same coping
// strategies + a 60-second calming stimulus. Per-emotion plans are future work and plug
// into getCopingPlan() without changing the rest of the app.

// The 5 distressing emotions (used in onboarding menu 3 and in every check-in).
export const EMOTIONS = {
  angry:       { ink: '#8a3d22', label: 'Angry',       icon: icon('angry'), color: '#d9826b', soft: '#f6e1da' },
  scared:      { ink: '#4d3d7a', label: 'Scared',      icon: icon('scared'), color: '#9a87c0', soft: '#e7e1f2' },
  sad:         { ink: '#2f4f78', label: 'Sad',         icon: icon('sad'), color: '#7f9cc4', soft: '#dfe7f2' },
  overwhelmed: { ink: '#2c5f61', label: 'Overwhelmed', icon: icon('overwhelmed'), color: '#6fa6a8', soft: '#e3eee6' },
  lonely:      { ink: '#6e3653', label: 'Lonely',      icon: icon('lonely'), color: '#c08fa8', soft: '#f2e1ea' },
};

// "I'm not sure" at check-in: the student can name a body feeling instead of an emotion
// (many autistic students find body sensations easier to identify than emotion words).
// Saved as break.body_feeling; break.emotion stays null.
export const NOT_SURE = { label: "I'm not sure", icon: icon('unsure'), ink: '#4a5357', color: '#8a9499', soft: '#ebeae6' };
export const BODY_FEELINGS = {
  hot:     { label: 'Hot',          icon: icon('flame') },
  shaky:   { label: 'Shaky',        icon: icon('activity') },
  tight:   { label: 'Tight',        icon: icon('squeeze') },
  tired:   { label: 'Tired',        icon: icon('zzz') },
  heavy:   { label: 'Heavy',        icon: icon('weight') },
  unknown: { label: "I don't know", icon: icon('unsure') },
};

// "What happened?" at check-in: one tap, saved as break.reason_key. Typing is optional (break.reason).
// Common triggers for 11-15 year olds: sensory, social, school, change, body. "I don't know" stays last.
export const REASONS = {
  loud:     { label: 'Too loud',               icon: icon('volume') },
  crowd:    { label: 'Too many people',        icon: icon('crowd') },
  people:   { label: 'Someone said something', icon: icon('message') },
  left_out: { label: 'I got left out',         icon: icon('userX') },
  work:     { label: 'Work is hard',           icon: icon('book') },
  test:     { label: 'Test or presenting',     icon: icon('presentation') },
  change:   { label: 'Plans changed',          icon: icon('shuffle') },
  body:     { label: 'Hungry or tired',        icon: icon('battery') },
  unsure:   { label: "I don't know",           icon: icon('unsure') },
};
// Onboarding menu 3 also asks how often students feel good things. Stored in profile.frequency
// alongside the five above (keys don't overlap), so reports can show the whole picture.
export const POSITIVE_EMOTIONS = {
  happy:   { ink: '#6b5310', label: 'Happy',   icon: icon('happy'),    soft: '#f7efd2' },
  calm:    { ink: '#2c5f61', label: 'Calm',    icon: icon('leaf'),     soft: '#e3eee6' },
  proud:   { ink: '#4d3d7a', label: 'Proud',   icon: icon('award'),    soft: '#e7e1f2' },
  excited: { ink: '#8a3d22', label: 'Excited', icon: icon('sparkles'), soft: '#f6e1da' },
};

// The five emotions asked about in onboarding and offered as main check-in tiles.
export const EMOTION_KEYS = ['angry', 'scared', 'sad', 'overwhelmed', 'lonely'];

// Length limits (also enforced in the inputs).
export const LIMITS = { name: 30, favorite: 60, happy: 80, reason: 400, strategy: 60 };

// Onboarding menu 2: five favorites (plain text only, no character images).
export const FAVORITES = [
  { key: 'character', label: 'Favorite character, show or movie', icon: icon('movie'), placeholder: 'Spider-Man' },
  { key: 'game',      label: 'Favorite game',                     icon: icon('gamepad'), placeholder: 'Minecraft' },
  { key: 'food',      label: 'Favorite food',                     icon: icon('pizza'), placeholder: 'Pepperoni pizza' },
  { key: 'song',      label: 'Favorite song',                     icon: icon('music'), placeholder: 'Song name and artist' },
  { key: 'hobby',     label: 'Favorite hobby',                    icon: icon('palette'), placeholder: 'Drawing' },
];

// Onboarding menu 3: "How often do you feel ___?"
export const FREQUENCY = [
  { key: 1, label: 'Almost never' },
  { key: 2, label: 'Sometimes' },
  { key: 3, label: 'Often' },
  { key: 4, label: 'Very often' },
  { key: 5, label: 'Almost always' },
];

// Check-in step 2: "How strong is the feeling?"
export const STRENGTH = [
  { key: 1, label: 'A little' },
  { key: 2, label: 'Some' },
  { key: 3, label: 'Medium' },
  { key: 4, label: 'Strong' },
  { key: 5, label: 'Very strong' },
];

// Onboarding menu 5 + check-in step 4: coping strategies. inSeat: false means the student
// needs to leave their seat or get permission first (shown as "Ask first").
export const STRATEGIES = [
  { key: 'look_away',  inSeat: true,  label: 'Look away from the screen', icon: icon('eyeOff'),
    detail: 'Look at something far away, like a window or the wall, for a few breaths.' },
  { key: 'breathe',    inSeat: true,  label: 'Breathe slowly',             icon: icon('wind'),
    detail: 'In for 4, hold for 2, out for 6. Long breaths out tell your body it is safe.' },
  { key: 'palms',      inSeat: true,  label: 'Push palms together',        icon: icon('squeeze'),
    detail: 'Press your hands together hard for 10 seconds, then let go.' },
  { key: 'fidget',     inSeat: true,  label: 'Squeeze a fidget',           icon: icon('handGrab'),
    detail: 'Squeeze a stress ball or fidget toy and let your hands do the work.' },
  { key: 'headphones', inSeat: true,  label: 'Put headphones on',          icon: icon('headphones'),
    detail: 'Block out the noise for a bit. Quiet helps your brain reset.' },
  { key: 'water',      inSeat: true,  label: 'Drink some water',           icon: icon('bottle'),
    detail: 'A few slow sips of water can help your body calm down.' },
  { key: 'draw',       inSeat: true,  label: 'Draw something',             icon: icon('pencil'),
    detail: 'Doodle anything. Shapes, lines, whatever you like.' },
  { key: 'game',       inSeat: true,  label: 'Play a game for a few minutes', icon: icon('gamepad'),
    detail: 'A short, calm game can give your mind a break.' },
  { key: 'friend',     inSeat: false, label: 'Talk to a friend',           icon: icon('friends'),
    detail: 'Ask your teacher if you can talk with a friend for a minute.' },
  { key: 'sun',        inSeat: false, label: 'Get some sun',               icon: icon('sun'),
    detail: 'Ask your teacher if you can step by a window or outside.' },
];
export const STRATEGY_BY_KEY = Object.fromEntries(STRATEGIES.map((s) => [s.key, s]));
export const MAX_PICKS = 3;

// Students can add their own ideas (profile.own_strategies, a list of text). Each is shaped like a
// strategy so the same UI shows it; its key is 'own:' + the text, which is also what a break
// stores in strategy_used. (Older profiles may have a single own_strategy; that still works.)
export const MAX_OWN = 5;
export const ownKey = (text) => `own:${text}`;
export const ownStrategy = (text) => ({ key: ownKey(text), inSeat: true, label: text, icon: icon('sparkles'), detail: 'Your own idea.' });
export const ownList = (profile = {}) => [...(profile.own_strategies || []), ...(profile.own_strategy ? [profile.own_strategy] : [])]
  .filter((t, i, a) => t && a.indexOf(t) === i);

// "Did it help?" after calm time, saved as break.helped (3 = yes, 2 = a little, 1 = no).
export const HELPED = [
  { key: 3, label: 'Yes',      icon: icon('thumbUp') },
  { key: 2, label: 'A little', icon: icon('neutral') },
  { key: 1, label: 'No',       icon: icon('thumbDown') },
];

// Calming stimuli the instructor can pick. 'upload' is the instructor's own audio file for
// that student, only offered when one has been uploaded.
export const STIMULI = {
  rain:    { label: 'Rain sounds',        icon: icon('rain'), kind: 'audio' },
  waves:   { label: 'Ocean waves',        icon: icon('waves'), kind: 'audio' },
  music:   { label: 'Soft music',         icon: icon('piano'), kind: 'audio' },
  breathe: { label: 'Breathing circle (silent)', icon: icon('breathe'), kind: 'visual' },
  draw:    { label: 'Drawing pad (silent)', icon: icon('pencil'), kind: 'visual' },
  trace:   { label: 'Trace the path (silent)', icon: icon('route'), kind: 'visual' },
  upload:  { label: 'Uploaded audio',     icon: icon('headphones'), kind: 'audio' },
};
export const BUILT_IN_STIMULI = ['rain', 'waves', 'music', 'breathe', 'draw', 'trace'];

// Class context the teacher sets on the dashboard (never asked of the student).
// Copied onto every new break so reports can show breaks by subject.
export const SUBJECTS = { english: 'English', math: 'Math', science: 'Science', social: 'Social Studies', other: 'Other' };

// Add ?fast to the URL (on both pages) for rehearsal/testing: the breathing pause takes 3 s and
// every timer "minute" takes 5 s. Real use: 30 s pause, real minutes.
const FAST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fast');
export const CALM_SECONDS = FAST ? 5 : 60;   // previews and the legacy fixed calm time
export const PAUSE_SECONDS = FAST ? 3 : 30;  // "pause and breathe" right after the strength question
export const MINUTE_MS = FAST ? 5000 : 60000;
// Activity timer lengths the teacher can pick with one tap, plus "a bit longer" when time is up.
export const TIMER_PRESETS = [2, 5, 10];
export const SEC_MS = MINUTE_MS / 60;
// Custom timer: the teacher steps it up or down in 30-second steps.
export const CUSTOM_STEP = 30; export const CUSTOM_MIN = 30; export const CUSTOM_MAX = 30 * 60; export const CUSTOM_START = 3 * 60;
// Timer length in seconds (older breaks only stored whole minutes).
export const timerTotalSec = (b) => b?.timer_seconds ?? (b?.timer_minutes || 0) * 60;
export const fmtDur = (sec) => { const m = Math.floor(sec / 60); const r = sec % 60; return m && r ? `${m} min ${r} s` : m ? `${m} min` : `${r} s`; };
export const EXTRA_MINUTES = 2;
// Ms left on a break's activity timer, or null when the teacher hasn't set one yet.
// While the teacher has the activity paused, the clock is frozen at the moment of pausing.
export const timerLeft = (b) => (b?.timer_ends_at
  ? Math.max(0, new Date(b.timer_ends_at) - (b.paused_at ? new Date(b.paused_at).getTime() : Date.now())) : null);
// How many times a student may switch activities in one break (the teacher can always offer another).
export const MAX_SWITCHES = 3;
export const clock = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// What the student sees in "pick something to relax": on-screen activities (kid-facing names).
// 'upload' (the teacher's audio for this student) is added only when one exists.
export const KID_ACTIVITIES = {
  rain:    { label: 'Rain sounds',      detail: 'Listen to soft rain.' },
  waves:   { label: 'Ocean waves',      detail: 'Listen to slow waves.' },
  music:   { label: 'Soft music',       detail: 'Gentle music, nothing loud.' },
  breathe: { label: 'Breathing circle', detail: 'Breathe with a slow circle.' },
  draw:    { label: 'Draw',             detail: 'Draw anything you like.' },
  trace:   { label: 'Trace the path',   detail: 'Follow a line and a picture appears.' },
  upload:  { label: "My teacher's sound", detail: 'A sound your teacher picked for you.' },
};

// Which strategies to show at check-in. Today: the student's own picks (and own idea) first,
// then everything else under "More ideas". Later, emotion/strength/reason can reorder this
// without touching the UI.
export function getCopingPlan(profile = {} /* , emotion, strength, reason */) {
  const picks = [...(profile.strategies || []).map((k) => STRATEGY_BY_KEY[k]).filter(Boolean), ...ownList(profile).map(ownStrategy)];
  const mine = picks.length ? picks : [STRATEGY_BY_KEY.breathe, STRATEGY_BY_KEY.look_away];
  const others = STRATEGIES.filter((s) => !mine.some((m) => m.key === s.key));
  return { mine, others, strategies: [...mine, ...others] };
}
export const strategyLabel = (key, profile) =>
  key?.startsWith('own:') ? key.slice(4) : key === 'own' ? (profile?.own_strategy || 'Own idea') : STRATEGY_BY_KEY[key]?.label ?? '–';

// "Which subject stresses this student most?" Ranks subjects by number of breaks, then by average
// strength. Counts breaks, not minutes spent in each subject, so the UI says so.
export function subjectStats(breaks) {
  const by = {};
  for (const b of breaks) {
    if (!b.subject) continue;
    const x = (by[b.subject] ||= { key: b.subject, n: 0, strength: [], helped: [] });
    x.n++; if (b.strength) x.strength.push(b.strength); if (b.helped) x.helped.push(b.helped);
  }
  const mean = (xs) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null);
  return Object.values(by).map((x) => ({ key: x.key, label: SUBJECTS[x.key] ?? x.key, n: x.n,
    avgStrength: mean(x.strength), helpedPct: x.helped.length ? Math.round((100 * x.helped.filter((h) => h >= 2).length) / x.helped.length) : null }))
    .sort((a, b) => b.n - a.n || (b.avgStrength ?? 0) - (a.avgStrength ?? 0));
}

export const stimulusLabel = (key, student) =>
  key === 'upload' ? (student?.audio_name ? `Uploaded: ${student.audio_name}` : STIMULI.upload.label) : STIMULI[key]?.label ?? '–';
