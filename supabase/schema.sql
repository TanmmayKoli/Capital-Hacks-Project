-- Calm Compass v2 schema. Paste into Supabase → SQL Editor → Run.

create table if not exists classes (
  code         text primary key,
  teacher_name text not null,
  created_at   timestamptz not null default now()
);

create table if not exists students (
  id               uuid primary key default gen_random_uuid(),
  class_code       text not null references classes(code) on delete cascade,
  name             text not null,
  -- { favorites: {character, game, food, song, hobby},
  --   frequency: {angry, scared, sad, overwhelmed, lonely, happy, calm, proud, excited} (1-5),
  --   happy: [text, text],
  --   subjects: [SUBJECTS keys], strategies: [up to 3 STRATEGIES keys], own_strategies: [text] }
  profile          jsonb not null,
  status           text not null default 'learning',  -- 'learning' | 'break'
  current_break    uuid,
  stimulus         text,   -- stimulus the instructor picked for the current break
  default_stimulus text,   -- optional: always use this one (skips the instructor prompt)
  audio_url        text,   -- instructor-uploaded calming audio for this student
  audio_name       text,
  created_at       timestamptz not null default now()
);

create table if not exists breaks (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  class_code      text not null references classes(code) on delete cascade,
  initiated_by    text not null,              -- 'instructor' | 'student'
  -- started | emotion | strength | reason | strategies | waiting_stimulus | calming | calm_done | done
  step            text not null default 'started',
  emotion         text,                       -- null when the student tapped "I'm not sure"
  strength        int,                        -- 1-5
  reason          text,                       -- optional words the student typed, or '(skipped)'
  stimulus        text,                       -- rain | waves | music | breathe | upload
  started_at      timestamptz not null default now(),
  calm_started_at timestamptz,
  extra_minutes   int not null default 0,         -- times the student tapped "One more minute"
  student_ready   boolean not null default false, -- student tapped "I'm ready" after calm time
  ended_at        timestamptz
);
-- Class context (phase 2): the teacher sets the current subject on the dashboard;
-- every new break copies it, so reports can show breaks by subject.
alter table classes add column if not exists subject text;  -- english | math | science | social | other
alter table breaks  add column if not exists subject text;

-- Coping strategies (phase 3): which one the student tried, and whether the break helped.
alter table breaks add column if not exists strategy_used text;  -- STRATEGIES key in src/content.js, or 'own:<their own idea>'
alter table breaks add column if not exists helped        int;   -- 3 = yes, 2 = a little, 1 = no

-- Icons-first check-in (phase 1): which tile the student tapped.
alter table breaks add column if not exists reason_key   text;  -- see REASONS in src/content.js (loud, crowd, people, left_out, work, test, change, body, unsure)
alter table breaks add column if not exists body_feeling text;  -- hot | shaky | tight | tired | heavy | unknown (when emotion is "not sure")
-- If you created the v2 tables before these columns existed:
alter table breaks add column if not exists extra_minutes int not null default 0;
alter table breaks add column if not exists student_ready boolean not null default false;
-- Activity timer set by the teacher (minutes chosen, and when it ends; +2 min moves the end).
alter table breaks add column if not exists timer_minutes int;
alter table breaks add column if not exists timer_ends_at timestamptz;
-- Activity switches (max 3 by the student) and the teacher's controls: pause, skip, "pick another".
alter table breaks add column if not exists switches int not null default 0;
alter table breaks add column if not exists paused_at timestamptz;
alter table breaks add column if not exists skipped boolean not null default false;
alter table breaks add column if not exists choose_again boolean not null default false;
-- Custom timer in 30-second steps (timer_minutes stays as the rounded value), and the teacher's
-- "30-second breathing" prompt while an activity is paused.
alter table breaks add column if not exists timer_seconds int;
alter table breaks add column if not exists breathe_at timestamptz;

create index if not exists breaks_student_idx on breaks(student_id, started_at);
create index if not exists breaks_class_idx   on breaks(class_code, started_at);

-- Realtime: stream row changes to the portals
-- (Safe to rerun: only adds a table that isn't in the publication yet.)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'students') then
    alter publication supabase_realtime add table students; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'breaks') then
    alter publication supabase_realtime add table breaks; end if;
end $$;

-- Storage bucket for instructor-uploaded calming audio
insert into storage.buckets (id, name, public) values ('calm-audio', 'calm-audio', true)
on conflict (id) do nothing;

-- HACKATHON-ONLY access: anyone with the anon key can read/write.
-- Before real use with students' data: add Supabase Auth, tie teachers to classes,
-- and replace these with per-user policies (COPPA / FERPA).
alter table classes  enable row level security;
alter table students enable row level security;
alter table breaks   enable row level security;
drop policy if exists "demo all classes" on classes;
create policy "demo all classes" on classes  for all using (true) with check (true);
drop policy if exists "demo all students" on students;
create policy "demo all students" on students for all using (true) with check (true);
drop policy if exists "demo all breaks" on breaks;
create policy "demo all breaks" on breaks   for all using (true) with check (true);
drop policy if exists "demo calm-audio read" on storage.objects;
create policy "demo calm-audio read" on storage.objects for select using (bucket_id = 'calm-audio');
drop policy if exists "demo calm-audio upload" on storage.objects;
create policy "demo calm-audio upload" on storage.objects for insert with check (bucket_id = 'calm-audio');
