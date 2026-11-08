// Data layer. Uses Supabase when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
// Otherwise falls back to LOCAL mode: localStorage + BroadcastChannel, so the kid and
// instructor portals still sync across tabs in the same browser (wifi-dies backup demo).
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const MODE = URL && KEY ? 'supabase' : 'local';

const uuid = () => crypto.randomUUID();
// If the teacher hasn't set a subject and the student only has one subject, use that one.
const onlySubject = (student) => { const s = student?.profile?.subjects; return Array.isArray(s) && s.length === 1 ? s[0] : null; };
const now = () => new Date().toISOString();
export const makeCode = () =>
  Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---------------------------------------------------------------- Supabase
function supabaseDb() {
  const sb = createClient(URL, KEY);
  const one = async (q) => { const { data, error } = await q; if (error) throw error; return data; };

  return {
    async createClass(teacherName) {
      for (let i = 0; i < 5; i++) {
        const code = makeCode();
        const { data, error } = await sb.from('classes').insert({ code, teacher_name: teacherName }).select().single();
        if (!error) return data;
        if (error.code !== '23505') throw error; // retry only on duplicate code
      }
      throw new Error('Could not create class code');
    },
    getClass: (code) => one(sb.from('classes').select().eq('code', code).maybeSingle()),
    // Instructor's calming audio for one student -> Supabase Storage bucket "calm-audio"
    async uploadAudio(studentId, file) {
      const path = `${studentId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      const { error } = await sb.storage.from('calm-audio').upload(path, file, { contentType: file.type || 'audio/mpeg' });
      if (error) throw error;
      return { url: sb.storage.from('calm-audio').getPublicUrl(path).data.publicUrl, name: file.name };
    },
    createStudent: (s) => one(sb.from('students').insert(s).select().single()),
    getStudent: (id) => one(sb.from('students').select().eq('id', id).maybeSingle()),
    listStudents: (code) => one(sb.from('students').select().eq('class_code', code).order('created_at')),
    updateStudent: (id, patch) => one(sb.from('students').update(patch).eq('id', id).select().single()),
    updateClass: (code, patch) => one(sb.from('classes').update(patch).eq('code', code).select().single()),
    // Every new break gets the class's current subject (set by the teacher), whoever started it.
    async createBreak(b) {
      const c = await one(sb.from('classes').select('subject').eq('code', b.class_code).maybeSingle());
      const st = c?.subject ? null : await one(sb.from('students').select('profile').eq('id', b.student_id).maybeSingle());
      return one(sb.from('breaks').insert({ subject: c?.subject ?? onlySubject(st), ...b }).select().single());
    },
    insertBreaks: (rows) => one(sb.from('breaks').insert(rows).select()),
    updateBreak: (id, patch) => one(sb.from('breaks').update(patch).eq('id', id).select().single()),
    listBreaks: ({ studentId, classCode }) => {
      let q = sb.from('breaks').select().order('started_at');
      if (studentId) q = q.eq('student_id', studentId);
      if (classCode) q = q.eq('class_code', classCode);
      return one(q);
    },
    subscribeStudent(id, cb) {
      const ch = sb.channel(`student-${id}-${uuid()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `id=eq.${id}` },
          (p) => cb(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },
    // The student's tablet listens to its own break row (the teacher sets the activity timer there).
    subscribeBreak(id, cb) {
      const ch = sb.channel(`break-${id}-${uuid()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'breaks', filter: `id=eq.${id}` },
          (p) => cb(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },
    subscribeClass(code, { onStudent, onBreak }) {
      const ch = sb.channel(`class-${code}-${uuid()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `class_code=eq.${code}` },
          (p) => onStudent?.(p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks', filter: `class_code=eq.${code}` },
          (p) => onBreak?.(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },
    // Presence: kid announces itself; instructor sees who is online.
    announce(code, studentId) {
      const ch = sb.channel(`presence-${code}`, { config: { presence: { key: studentId } } });
      ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ studentId, at: now() }); });
      return () => sb.removeChannel(ch);
    },
    watchPresence(code, cb) {
      const ch = sb.channel(`presence-${code}`);
      ch.on('presence', { event: 'sync' }, () => cb(new Set(Object.keys(ch.presenceState())))).subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

// ---------------------------------------------------------------- Local fallback
function localDb() {
  const bc = new BroadcastChannel('calm-compass');
  const listeners = new Set();
  const load = (t) => { try { return JSON.parse(localStorage.getItem(`cc_${t}`) || '[]'); } catch { return []; } };
  const save = (t, rows) => { try { localStorage.setItem(`cc_${t}`, JSON.stringify(rows)); } catch {} };
  const emit = (msg) => { listeners.forEach((l) => l(msg)); bc.postMessage(msg); };
  bc.onmessage = (e) => listeners.forEach((l) => l(e.data));
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  const insert = (t, row) => { const rows = load(t); rows.push(row); save(t, rows); emit({ t, row }); return row; };
  const update = (t, id, patch) => {
    const rows = load(t); const i = rows.findIndex((r) => r.id === id || r.code === id);
    if (i < 0) throw new Error(`${t} ${id} not found`);
    rows[i] = { ...rows[i], ...patch }; save(t, rows); emit({ t, row: rows[i] }); return rows[i];
  };

  return {
    async createClass(teacherName) { return insert('classes', { code: makeCode(), teacher_name: teacherName, created_at: now() }); },
    async getClass(code) { return load('classes').find((c) => c.code === code) || null; },
    // Local mode keeps the file as a data URL in localStorage, so keep it small.
    async uploadAudio(_studentId, file) {
      if (file.size > 2.5 * 1024 * 1024) throw new Error('In local demo mode, audio files must be under 2.5 MB. Connect Supabase for bigger files.');
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      return { url, name: file.name };
    },
    async createStudent(s) { return insert('students', { id: uuid(), status: 'learning', stimulus: null, audio_url: null, audio_name: null, current_break: null, created_at: now(), ...s }); },
    async getStudent(id) { return load('students').find((s) => s.id === id) || null; },
    async listStudents(code) { return load('students').filter((s) => s.class_code === code); },
    async updateStudent(id, patch) { return update('students', id, patch); },
    async updateClass(code, patch) { return update('classes', code, patch); },
    // Every new break gets the class's current subject (set by the teacher), whoever started it.
    async createBreak(b) {
      const c = load('classes').find((x) => x.code === b.class_code);
      const st = c?.subject ? null : load('students').find((x) => x.id === b.student_id);
      return insert('breaks', { id: uuid(), step: 'started', started_at: now(), subject: c?.subject ?? onlySubject(st), ...b });
    },
    async updateBreak(id, patch) { return update('breaks', id, patch); },
    async insertBreaks(rows) {
      const all = load('breaks'); const out = rows.map((b) => ({ id: uuid(), step: 'started', started_at: now(), ...b }));
      save('breaks', [...all, ...out]); emit({ t: 'bulk' }); return out;
    },
    async listBreaks({ studentId, classCode }) {
      return load('breaks')
        .filter((b) => (!studentId || b.student_id === studentId) && (!classCode || b.class_code === classCode))
        .sort((a, b) => a.started_at.localeCompare(b.started_at));
    },
    subscribeStudent(id, cb) { return on(({ t, row }) => { if (t === 'students' && row?.id === id) cb(row); }); },
    subscribeBreak(id, cb) { return on(({ t, row }) => { if (t === 'breaks' && row?.id === id) cb(row); }); },
    subscribeClass(code, { onStudent, onBreak }) {
      return on(({ t, row }) => {
        if (row?.class_code !== code) return;
        if (t === 'students') onStudent?.(row);
        if (t === 'breaks') onBreak?.(row);
      });
    },
    announce(code, studentId) {
      const beat = () => emit({ t: 'presence', code, studentId, at: Date.now() });
      beat(); const iv = setInterval(beat, 2000);
      return () => clearInterval(iv);
    },
    watchPresence(code, cb) {
      const seen = new Map();
      const push = () => { const cut = Date.now() - 6000; cb(new Set([...seen].filter(([, at]) => at > cut).map(([id]) => id))); };
      const off = on((m) => { if (m.t === 'presence' && m.code === code) { seen.set(m.studentId, m.at); push(); } });
      const iv = setInterval(push, 2000);
      return () => { off(); clearInterval(iv); };
    },
  };
}

export const db = MODE === 'supabase' ? supabaseDb() : localDb();

// Small persistence helpers for "who am I on this device"
export const local = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
