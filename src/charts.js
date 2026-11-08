// Reports + trend charts shared by the instructor and student views.
import { Chart, registerables } from 'chart.js';
import { EMOTIONS, BODY_FEELINGS, REASONS, SUBJECTS, HELPED, STRENGTH, STIMULI, stimulusLabel, strategyLabel, subjectStats } from './content.js';

Chart.register(...registerables);
Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;
Chart.defaults.color = '#556166';

const live = new Map(); // container -> charts, so re-renders don't leak canvases
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// "What helped": strategies ranked by average helped score (3 = yes, 2 = a little, 1 = no).
// Only strategies tried at least twice with an answer, so one lucky break doesn't top the list.
export function whatHelped(breaks, minTries = 2) {
  const by = {};
  for (const b of breaks) {
    if (!b.strategy_used || !b.helped) continue;
    (by[b.strategy_used] ||= []).push(b.helped);
  }
  return Object.entries(by).filter(([, xs]) => xs.length >= minTries)
    .map(([key, xs]) => ({ key, avg: avg(xs), n: xs.length }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n);
}

export function summarize(breaks) {
  const count = (f) => breaks.reduce((m, b) => { const k = f(b); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
  const strengths = breaks.filter((b) => b.strength).map((b) => b.strength);
  const durations = breaks.filter((b) => b.ended_at).map((b) => (new Date(b.ended_at) - new Date(b.started_at)) / 1000);
  // Self-advocacy trend: share of breaks the student asked for, first half vs second half of the time period
  const t0 = breaks.length ? new Date(breaks[0].started_at).getTime() : 0;
  const t1 = breaks.length ? new Date(breaks[breaks.length - 1].started_at).getTime() : 0;
  const mid = (t0 + t1) / 2;
  const early = breaks.filter((b) => new Date(b.started_at).getTime() < mid);
  const late = breaks.filter((b) => new Date(b.started_at).getTime() >= mid);
  const selfPct = (xs) => (xs.length ? Math.round((100 * xs.filter((b) => b.initiated_by === 'student').length) / xs.length) : null);
  return {
    total: breaks.length,
    byInstructor: breaks.filter((b) => b.initiated_by === 'instructor').length,
    bySelf: breaks.filter((b) => b.initiated_by === 'student').length,
    selfEarly: selfPct(early),
    selfLate: selfPct(late),
    emotions: count((b) => b.emotion),
    reasons: count((b) => b.reason_key),
    subjects: count((b) => b.subject),
    helped: whatHelped(breaks),
    stimuli: count((b) => b.stimulus),
    avgStrength: avg(strengths)?.toFixed(1) ?? null,
    avgMinutes: avg(durations) != null ? (avg(durations) / 60).toFixed(1) : null,
  };
}

const dayKey = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Which subject stresses a student most. One student: a ranked table of their subjects.
// All students: each student's hardest subject side by side.
function subjectCard(breaks, { multi, studentsById }) {
  const caveat = '<p class="muted small">Counts breaks, not time spent in each subject.</p>';
  const fmt = (x) => (x == null ? '–' : x.toFixed(1));
  if (!multi) {
    const rows = subjectStats(breaks);
    if (!rows.length) return '';
    const top = rows[0];
    return `<div class="card subject-card"><h3>Which subject is hardest?</h3>
      <p class="subject-top"><b>${esc(top.label)}</b>: ${top.n} break${top.n === 1 ? '' : 's'}, average strength ${fmt(top.avgStrength)} of 5</p>
      <table><thead><tr><th>Subject</th><th>Breaks</th><th>Avg strength</th><th>Break helped</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.n}</td><td>${fmt(r.avgStrength)}</td><td>${r.helpedPct == null ? '–' : `${r.helpedPct}%`}</td></tr>`).join('')}
      </tbody></table>${caveat}</div>`;
  }
  const byStudent = {};
  for (const b of breaks) (byStudent[b.student_id] ||= []).push(b);
  const rows = Object.entries(byStudent).map(([id, bs]) => ({ name: studentsById[id]?.name ?? '–', all: subjectStats(bs) })).filter((r) => r.all.length)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!rows.length) return '';
  return `<div class="card subject-card"><h3>Hardest subject for each student</h3>
    <table><thead><tr><th>Student</th><th>Most breaks in</th><th>Breaks</th><th>Avg strength</th><th>Next</th></tr></thead><tbody>
      ${rows.map(({ name, all: [t, n2] }) => `<tr><td>${esc(name)}</td><td><b>${esc(t.label)}</b></td><td>${t.n}</td><td>${fmt(t.avgStrength)}</td><td>${n2 ? `${esc(n2.label)} (${n2.n})` : '–'}</td></tr>`).join('')}
    </tbody></table>${caveat}<p class="muted small">Pick a student under "Show" for their full subject breakdown.</p></div>`;
}

// audience: 'teacher' | 'kid'. studentsById: for names in the table. multi: more than one student.
export function renderReport(container, breaks, { audience = 'teacher', studentsById = {}, multi = false, profile: profileFor = null } = {}) {
  (live.get(container) || []).forEach((c) => c.destroy());
  const s = summarize(breaks);
  const kid = audience === 'kid';
  // Single-student views can show that student's own strategy text; class-wide views say "Own idea".
  const profile = profileFor ?? (!multi && breaks[0] ? studentsById[breaks[0].student_id]?.profile : null);

  if (!breaks.length) {
    container.innerHTML = `<div class="card center muted">${kid ? 'No breaks yet. Your check-ins will show up here.' : 'No break sessions yet.'}</div>`;
    live.set(container, []); return;
  }

  if (kid) {
    container.innerHTML = `
      <div class="charts mt-12">
        <div class="card"><h3>Feelings I had most</h3><div class="chart-box"><canvas data-c="emo"></canvas></div></div>
        <div class="card"><h3>Breaks each day</h3><div class="chart-box"><canvas data-c="days"></canvas></div></div>
      </div>
      ${s.helped.filter((h) => h.avg >= 2).length ? `<div class="card helps-me"><h3>What helps me most</h3>
        <ol>${s.helped.filter((h) => h.avg >= 2).slice(0, 3).map((h) => `<li>${esc(strategyLabel(h.key, profile))}</li>`).join('')}</ol></div>` : ''}`;
  } else {
  const recent = [...breaks].reverse().slice(0, 30);
  container.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="muted">${kid ? 'Breaks taken' : 'Total breaks'}</span><b>${s.total}</b></div>
      ${kid ? '' : `<div class="stat"><span class="muted">Started by teacher</span><b>${s.byInstructor}</b></div>`}
      <div class="stat"><span class="muted">${kid ? 'Breaks I asked for' : 'Asked for by student'}</span><b>${s.bySelf}</b></div>
      <div class="stat"><span class="muted">Avg strength (1–5)</span><b>${s.avgStrength ?? '–'}</b></div>
      ${kid ? '' : `<div class="stat"><span class="muted">Avg break length</span><b>${s.avgMinutes ?? '–'} min</b></div>
      <div class="stat"><span class="muted">Self-requested, earlier → recent</span><b>${s.selfEarly ?? '–'}% → ${s.selfLate ?? '–'}%</b></div>`}
    </div>
    <div class="charts mt-16">
      <div class="card"><h3>${kid ? 'Feelings I had most' : 'Emotions'}</h3><div class="chart-box"><canvas data-c="emo"></canvas></div></div>
      <div class="card"><h3>${kid ? 'How strong my feelings were' : 'Strength trend (weekly average)'}</h3><div class="chart-box"><canvas data-c="strength"></canvas></div></div>
      <div class="card"><h3>${kid ? 'Breaks each day' : 'Breaks per day'}</h3><div class="chart-box"><canvas data-c="days"></canvas></div></div>
      <div class="card"><h3>${kid ? 'On-screen activities I used' : 'On-screen activities picked'}</h3><div class="chart-box"><canvas data-c="stim"></canvas></div></div>
      <div class="card"><h3>Top reasons</h3><div class="chart-box"><canvas data-c="reasons"></canvas></div></div>
      <div class="card"><h3>Breaks by subject</h3><div class="chart-box"><canvas data-c="subjects"></canvas></div></div>
      <div class="card"><h3>What helped <span class="muted small">(avg. of Yes 3 · A little 2 · No 1)</span></h3>
        ${s.helped.length ? '<div class="chart-box"><canvas data-c="helped"></canvas></div>' : '<p class="muted">Not enough "Did it help?" answers yet. Strategies show here once each is tried twice.</p>'}</div>
    </div>
    ${subjectCard(breaks, { multi, studentsById })}
    <div class="card mt-16 scroll-x">
      <h3>${kid ? 'My recent check-ins' : `Recent sessions <span class="muted h-note">(latest ${recent.length} of ${breaks.length})</span>`}</h3>
      <table><thead><tr><th>When</th>${multi ? '<th>Student</th>' : ''}${kid ? '' : '<th>Started by</th>'}<th>Subject</th><th>Feeling</th><th>Strength</th><th>What happened</th><th>Tried</th><th>Helped</th><th>Activity</th>${kid ? '' : '<th>Length</th>'}</tr></thead>
      <tbody>${recent.map((b) => {
        const em = EMOTIONS[b.emotion];
        const len = b.ended_at ? `${Math.max(1, Math.round((new Date(b.ended_at) - new Date(b.started_at)) / 60000))} min` : '<span class="pill warn">live</span>';
        return `<tr><td>${new Date(b.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
          ${multi ? `<td>${esc(studentsById[b.student_id]?.name ?? '–')}</td>` : ''}
          ${kid ? '' : `<td>${b.initiated_by === 'instructor' ? 'Teacher' : 'Student'}</td>`}
          <td>${SUBJECTS[b.subject] ?? '–'}</td>
          <td>${em ? `<span class="emo-inline" style="color:${em.ink}">${em.icon}</span> ${em.label}` : BODY_FEELINGS[b.body_feeling] ? `<span class="emo-inline">${BODY_FEELINGS[b.body_feeling].icon}</span> Not sure (${BODY_FEELINGS[b.body_feeling].label.toLowerCase()})` : '–'}</td>
          <td>${b.strength ? `${b.strength}/5` : '–'}</td>
          <td class="reason-cell">${[REASONS[b.reason_key] ? `<span class="emo-inline">${REASONS[b.reason_key].icon}</span> ${REASONS[b.reason_key].label}` : '', b.reason && b.reason !== '(skipped)' ? esc(b.reason) : ''].filter(Boolean).join(' · ') || '–'}</td>
          <td>${b.strategy_used ? esc(strategyLabel(b.strategy_used, studentsById[b.student_id]?.profile)) : '–'}</td>
          <td>${HELPED.find((h) => h.key === b.helped) ? `<span class="emo-inline">${HELPED.find((h) => h.key === b.helped).icon}</span> ${HELPED.find((h) => h.key === b.helped).label}` : '–'}</td>
          <td>${b.stimulus ? `${STIMULI[b.stimulus]?.icon ?? ''} ${esc(stimulusLabel(b.stimulus, studentsById[b.student_id]))}` : '–'}</td>
          ${kid ? '' : `<td>${len}</td>`}</tr>`;
      }).join('')}</tbody></table></div>`;
  }

  const cv = (k) => container.querySelector(`[data-c="${k}"]`);
  const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false } } };
  const charts = [];

  const emoKeys = Object.keys(EMOTIONS).filter((k) => s.emotions[k]);
  charts.push(new Chart(cv('emo'), {
    type: 'bar',
    data: { labels: emoKeys.map((k) => EMOTIONS[k].label),
      datasets: [{ data: emoKeys.map((k) => s.emotions[k]), backgroundColor: emoKeys.map((k) => EMOTIONS[k].color), borderRadius: 8 }] },
    options: { ...base, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } } } },
  }));

  // Weekly average strength: smoother than daily, shows the trend clearly
  const weeks = new Map();
  for (const b of breaks) {
    if (!b.strength) continue;
    const d = new Date(b.started_at); d.setDate(d.getDate() - d.getDay());
    const k = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k).push(b.strength);
  }
  if (!kid) charts.push(new Chart(cv('strength'), {
    type: 'line',
    data: { labels: [...weeks.keys()],
      datasets: [{ data: [...weeks.values()].map((xs) => +avg(xs).toFixed(2)),
        borderColor: '#9a87c0', backgroundColor: 'rgba(154,135,192,.15)', fill: true, tension: .35, pointRadius: 3 }] },
    options: { ...base, scales: { y: { min: 1, max: 5, ticks: { stepSize: 1, callback: (v) => `${v} ${STRENGTH.find((x) => x.key === v)?.label ?? ''}` } }, x: { grid: { display: false } } } },
  }));

  const days = new Map();
  for (const b of breaks) {
    const k = dayKey(b.started_at);
    if (!days.has(k)) days.set(k, { instructor: 0, student: 0 });
    days.get(k)[b.initiated_by === 'instructor' ? 'instructor' : 'student']++;
  }
  charts.push(new Chart(cv('days'), {
    type: 'bar',
    data: { labels: [...days.keys()], datasets: [
      { label: 'Teacher started', data: [...days.values()].map((d) => d.instructor), backgroundColor: '#c9a46b', borderRadius: 6 },
      { label: kid ? 'I asked' : 'Student asked', data: [...days.values()].map((d) => d.student), backgroundColor: '#3f6e70', borderRadius: 6 },
    ] },
    options: { ...base, plugins: { legend: { display: true, position: 'bottom' } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
  }));

  const stimKeys = Object.keys(s.stimuli);
  if (!kid) charts.push(new Chart(cv('stim'), {
    type: 'doughnut',
    data: { labels: stimKeys.map((k) => STIMULI[k]?.label ?? k),
      datasets: [{ data: stimKeys.map((k) => s.stimuli[k]), backgroundColor: ['#3f6e70', '#8fb0b1', '#c9d8d8', '#a39e93', '#5f5b53', '#d8cfbf', '#b9a37c'], borderWidth: 0 }] },
    options: { ...base, cutout: '60%', plugins: { legend: { display: true, position: 'bottom' } } },
  }));

  // Top reasons + subjects: horizontal bars, labels read left to right.
  const hbar = (key, entries, color) => {
    const el = cv(key); if (!el) return;
    charts.push(new Chart(el, {
      type: 'bar',
      data: { labels: entries.map(([l]) => l), datasets: [{ data: entries.map(([, n]) => n), backgroundColor: color, borderRadius: 6 }] },
      options: { ...base, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } },
    }));
  };
  hbar('reasons', Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => [REASONS[k]?.label ?? k, n]), '#3f6e70');
  hbar('subjects', Object.entries(s.subjects).sort((a, b) => b[1] - a[1]).map(([k, n]) => [SUBJECTS[k] ?? k, n]), '#8fb0b1');
  const hp = cv('helped');
  if (hp) charts.push(new Chart(hp, {
    type: 'bar',
    data: { labels: s.helped.slice(0, 6).map((h) => `${strategyLabel(h.key, multi ? null : profile)} (${h.n})`),
      datasets: [{ data: s.helped.slice(0, 6).map((h) => +h.avg.toFixed(2)), backgroundColor: '#477452', borderRadius: 6 }] },
    options: { ...base, indexAxis: 'y', scales: { x: { min: 1, max: 3, ticks: { stepSize: 1, callback: (v) => HELPED.find((h) => h.key === v)?.label ?? '' } }, y: { grid: { display: false } } } },
  }));

  live.set(container, charts);
}
