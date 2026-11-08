// Builds a demo class with 3 students and ~4 weeks of break history.
// The story it tells: over time, fewer instructor-started breaks, more self-requested
// breaks, and lower feeling strength.
import { EMOTIONS, EMOTION_KEYS, REASONS, BODY_FEELINGS, ownKey } from './content.js';

const PROFILES = [
  { name: 'Maya',
    favorites: { character: 'Spider-Man', game: 'Minecraft', food: 'Mac and cheese', song: 'Espresso by Sabrina Carpenter', hobby: 'Drawing' },
    frequency: { angry: 2, scared: 4, sad: 2, overwhelmed: 5, lonely: 2, happy: 3, calm: 2, proud: 3, excited: 4 },
    strategies: ['headphones', 'breathe', 'draw'], own: ['Listen to my favorite song'],
    subjects: { math: 5, science: 2, english: 1.5 }, // weights: Math is her hardest
    happy: ['Drawing comics', 'My dog Biscuit'],
    reasons: {
      overwhelmed: ['The hallway was too loud', 'Too many instructions at once', 'The lights in the gym were too bright', 'Group project with no plan'],
      scared: ['We have a test tomorrow', 'I have to present in front of everyone', 'Fire drill noise'],
      angry: ['Someone took my seat', 'Plans changed without telling me'],
      sad: ['I got a bad grade on my quiz'], lonely: ['Nobody to sit with at lunch'] } },
  { name: 'Leo',
    favorites: { character: 'Naruto', game: 'Fortnite', food: 'Tacos', song: 'Lose Yourself by Eminem', hobby: 'Basketball' },
    frequency: { angry: 4, scared: 2, sad: 3, overwhelmed: 3, lonely: 2, happy: 4, calm: 2, proud: 3, excited: 4 },
    strategies: ['palms', 'water', 'game'], own: [],
    subjects: { english: 4, social: 2.5, math: 1.5 },
    happy: ['Shooting hoops', 'Gaming with my cousin'],
    reasons: {
      angry: ['Someone was making fun of me', 'It felt unfair that I got blamed', 'I got interrupted when I was almost done'],
      overwhelmed: ['Too much homework due today', 'Class was really loud'],
      sad: ['I miss my grandma', 'I lost my game at recess'],
      scared: ['New substitute teacher'], lonely: ['My friends were in a different class'] } },
  { name: 'Sam',
    favorites: { character: 'Bluey', game: 'Stardew Valley', food: 'Sushi', song: 'Here Comes the Sun by the Beatles', hobby: 'Reading fantasy books' },
    frequency: { angry: 1, scared: 3, sad: 4, overwhelmed: 3, lonely: 5, happy: 2, calm: 3, proud: 2, excited: 2 },
    strategies: ['friend', 'look_away', 'fidget'], own: ['Read a few pages of my book', 'Hug my hoodie'],
    subjects: { science: 4, math: 2, social: 2 },
    happy: ['Reading in a quiet spot', 'Baking with my mom'],
    reasons: {
      lonely: ['Nobody picked me for their group', 'Nobody to talk to at lunch', 'I feel different from everyone'],
      sad: ['I feel tired today', 'My friend moved away'],
      scared: ['Too many people in the cafeteria', 'Changing for PE'],
      overwhelmed: ['Too many sounds at once'], angry: ['Someone touched my stuff'] } },
];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const OTHER_STRATEGIES = ['breathe', 'look_away', 'palms', 'water', 'fidget', 'headphones', 'sun'];
// Which reason tile each sample reason maps to (so reports show realistic top reasons).
const REASON_KEY = (text) => (/loud|noise|sounds|drill|bright|lights/i.test(text) ? 'loud'
  : /too many people|cafeteria|crowd/i.test(text) ? 'crowd'
  : /nobody|left out|picked|alone|different class|lunch/i.test(text) ? 'left_out'
  : /said|making fun|blamed|talk|took|touched|interrupted/i.test(text) ? 'people'
  : /test|present/i.test(text) ? 'test'
  : /homework|grade|quiz|project|instructions|work/i.test(text) ? 'work'
  : /changed|substitute|plans|moved|new/i.test(text) ? 'change'
  : /tired|hungry/i.test(text) ? 'body' : 'unsure');
const weighted = (pairs) => { let r = Math.random() * pairs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[0][0]; };

export async function buildDemo(db) {
  let cls = await db.createClass('Ms. Rivera (demo)');
  cls = { ...cls, ...(await db.updateClass(cls.code, { subject: 'math' })) };
  const rows = [];
  for (const p of PROFILES) {
    const s = await db.createStudent({
      class_code: cls.code, name: p.name,
      profile: { subjects: Object.keys(p.subjects), favorites: p.favorites, frequency: p.frequency, happy: p.happy, strategies: p.strategies, own_strategies: p.own },
    });
    // Only the five distress emotions drive breaks (frequency also holds happy/calm/proud/excited).
    const emoWeights = EMOTION_KEYS.map((k) => [k, p.frequency[k]]);
    for (let d = 27; d >= 1; d--) {
      const day = new Date(); day.setDate(day.getDate() - d);
      if (day.getDay() === 0 || day.getDay() === 6) continue; // school days only
      const progress = 1 - d / 27; // 0 = 4 weeks ago, 1 = yesterday
      const n = weighted([[0, 1 + progress * 2], [1, 3], [2, 2.5 - progress * 1.5], [3, 1.2 - progress]]);
      for (let i = 0; i < n; i++) {
        const start = new Date(day); start.setHours(8 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
        // Check-in + 30 s pause take 1-3 min; then the activity runs for the teacher's timer (+2 sometimes).
        const calm = new Date(start.getTime() + (1 + Math.random() * 2) * 60000);
        const timer = weighted([[2, 2], [3.5, 1], [5, 4], [10, 2]]); // minutes; 3.5 = a custom 3:30
        const extra = Math.random() < 0.15 ? 2 : 0;
        const end = new Date(calm.getTime() + ((timer + extra) * 60 + 20 + Math.random() * 60) * 1000);
        const onScreen = Math.random() < 0.55; // picked an on-screen activity, or one of their strategies
        // Subject: one of the student's own subjects, weighted so each student has a "hardest" one;
        // the lunch hour has no subject.
        const hour = start.getHours();
        const subject = hour === 12 ? null : weighted(Object.entries(p.subjects));
        const notSure = Math.random() < 0.12; // some check-ins use "I'm not sure" + a body feeling
        const emotion = notSure ? null : weighted(emoWeights);
        const text = rand(p.reasons[emotion || weighted(emoWeights)]);
        const typed = Math.random() < 0.3; // most students just tap a tile; some add words
        rows.push({
          student_id: s.id, class_code: cls.code,
          initiated_by: Math.random() < 0.75 - progress * 0.5 ? 'instructor' : 'student',
          step: 'done', subject, emotion, body_feeling: notSure ? rand(Object.keys(BODY_FEELINGS)) : null,
          strength: weighted([[5, 1.4 - progress * 1.1], [4, 2 - progress], [3, 2], [2, 0.8 + progress * 1.5], [1, 0.3 + progress * 1.2]]),
          reason_key: Math.random() < 0.08 ? null : REASON_KEY(text),
          reason: typed ? text : null,
          // Mostly their own picks (incl. their own idea), sometimes something else, sometimes none.
          strategy_used: onScreen ? null : Math.random() < 0.75 ? rand([...p.strategies, ...p.own.map(ownKey)]) : rand(OTHER_STRATEGIES),
          helped: Math.random() < 0.1 ? null : weighted([[3, 1.5 + progress * 2.5], [2, 1.6], [1, 0.9 - progress * 0.6]]),
          stimulus: onScreen ? weighted([['rain', 3], ['waves', 2], ['music', 1.5], ['breathe', 1.5], ['draw', 1.5], ['trace', 1.2]]) : null,
          timer_minutes: Math.round(timer + extra), timer_seconds: (timer + extra) * 60, extra_minutes: extra,
          switches: weighted([[0, 6], [1, 2.5], [2, 1], [3, 0.4]]), skipped: Math.random() < 0.05,
          timer_ends_at: new Date(calm.getTime() + (timer + extra) * 60000).toISOString(),
          started_at: start.toISOString(), calm_started_at: calm.toISOString(), ended_at: end.toISOString(),
        });
      }
    }
  }
  if (!rows.every((r) => (r.emotion ? EMOTIONS[r.emotion] : BODY_FEELINGS[r.body_feeling]) && (!r.reason_key || REASONS[r.reason_key]))) throw new Error('demo data mismatch');
  await db.insertBreaks(rows);
  return cls;
}
