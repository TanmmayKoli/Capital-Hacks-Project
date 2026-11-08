# 🧭 Calm Compass (v2)

Calm breaks for neurodivergent middle and early high school students: check in, reset for 60 seconds, get back to learning.
Capital Hacks 5.0 · Health track.

## How it works

Built for autistic students, including students with language delays and nonspeaking students: **icons first, typing always optional.**

**Student onboarding (7 short steps)**
1. **Basic info:** first name + class code (links them to the teacher's class; no email).
2. **Subjects:** which subjects they have with this teacher (tap any, or skip).
3. **Five favorites:** character/show, game, food, song, hobby (plain text, shown to the teacher). Favorites, feeling frequency and happy things are all optional, so a student who does not type can still finish setup.
4. **How often** they feel Angry, Scared, Sad, Overwhelmed, Lonely (1–5).
5. **How often** they feel Happy, Calm, Proud, Excited (1–5).
6. **Two things that make them happy.**
7. **What helps them calm down:** tap up to 3 strategies (each marked "Ask first" if it means leaving their seat), and add as many of their own ideas as they like (up to 5).

**Live session**
1. The teacher sets the **subject** on the dashboard (saved onto every break; if it isn't set and the student has only one subject, that one is used). The teacher taps **Start calm break** (3 s to cancel), or the student taps **I need a break**.
2. **Start with a breath:** a 30-second breathing circle is the first thing on screen, before any question.
3. **Three quick questions:** **How do you feel?** (five emotions, or **I'm not sure** → body feelings), **How strong?** (1–5), **What happened?** (one icon tap; "Add words" is optional and Skip is always there).
4. **Pick something to relax:** one list with on-screen activities (rain, waves, soft music, breathing circle, **draw**, **trace the path**, and the teacher's uploaded sound if there is one) and the student's coping strategies (their own picks first; they can add a new idea right there). Picking nothing starts the breathing circle.
5. The activity **starts right away**. The teacher gets "set a timer" in the **Needs you** strip and taps **2 / 5 / 10 min**, or sets a **custom time** in 30-second steps (−30 s / +30 s → Set); the countdown pops up on the student's screen.
6. **Switching:** the student can switch to a different activity up to **3 times** per break (the timer keeps going). Both screens show how many switches are used.
7. **Teacher stays in charge:** on the student's card, **Pause / Resume** (freezes the timer; while paused, **30-sec breathing** starts a breathing exercise on the student's screen), **End activity**, or **Another activity** (lets the student pick again; doesn't count as a switch, and adds 2 minutes if time had run out).
8. When the timer runs out, the student sees **Time's up · Did it help?** and the teacher gets a soft chime, a toast and **Resume class / 2 more min / Another activity** in the Needs you strip. The teacher resumes class → **break report** (including switches and timer).

Every student step has big tap targets, read-aloud (🔊), Back, and a Skip or optional path. Students' answers stay hidden on the teacher dashboard until the teacher taps "Show answers" (safe to project).

**Reports:** emotions, strength trend, breaks per day (teacher-started vs student-asked), on-screen activities picked, **top reasons**, **breaks by subject**, **what helped** (strategies ranked by average "Did it help?"), **which subject is hardest** for each student, self-requested share over time, and a session table. Students see a short reflection, their last check-ins, and "What helps me most".

## Run locally (no setup)
```bash
npm install
npm run dev
```
With no Supabase keys set, the app runs in **local demo mode**: open `/teacher` and `/kid` as two tabs in the same browser and they sync. Use this as the backup demo if venue wifi dies. (Uploaded audio must be under 2.5 MB in local mode.)

## Connect Supabase
1. Create a project at supabase.com.
2. In the SQL Editor, paste and run `supabase/schema.sql`. It creates the tables, turns on realtime, creates the `calm-audio` storage bucket, and adds demo access rules. (If you ran the v1 schema in the same project, drop the old `breaks` and `students` tables first.)
3. Copy `.env.example` to `.env` and fill in values from Project Settings → API:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. `npm run dev`. The landing page should say "Connected to Supabase". `npm run dev` uses `--host`, so phones/tablets on the same wifi can open `http://<your-ip>:5173/kid`.

## Deploy to Vercel
Push to GitHub → vercel.com → Add New Project → import. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, then deploy. `vercel.json` turns on clean URLs, so `/kid` and `/teacher` work.

## Demo script (about 3 min)
1. **Teacher laptop:** `/teacher` → **Create demo class** (3 students, 4 weeks of history). Show **Reports**: top reasons, breaks by subject, what helped, and self-requested breaks rising.
2. **Tablet/phone:** `/kid` → onboard live as "Maya" with the demo class code. Pick 2–3 strategies.
3. Teacher: set **Subject: Math** → Maya's card → **Start calm break**.
4. Maya: 30-second breath, then taps only: *I'm not sure → Shaky → 4 → Too loud → Draw → Start.* The feed updates at each tap.
5. Teacher: **Needs you → 5 min.** The countdown appears on Maya's screen while she draws.
6. Time's up: Maya taps **Did it help? Yes.** The teacher hears a chime and taps **Resume class** → the break report shows feeling, reason, subject, activity, timer and whether it helped.

Rehearsal tip: open both pages with `?fast` (`/kid?fast`, `/teacher?fast`): the pause takes 3 seconds and each timer minute takes 5 seconds.

## Structure
```
index.html / kid.html / teacher.html   pages (Vite multi-page)
src/content.js   emotions (+ positive), body feelings, reasons, subjects, strategies, stimuli, getCopingPlan()
src/kid.js       onboarding (7 steps), icon-first break flow, read-aloud, student check-ins
src/teacher.js   live cards, stimulus prompt, calming settings + upload, feed, report popup, reports tab
src/charts.js    Chart.js reports shared by both portals
src/calm.js      generated calming audio, uploaded audio, breathing circle, drawing pad, trace the path
src/db.js        Supabase data layer (+ storage upload) with local fallback; copies subject onto breaks
src/icons.js     Tabler line icons (inline SVG)
src/ui.js        toasts, retries, offline banner, friendly errors
src/fonts.js     self-hosted Atkinson Hyperlegible
src/demo.js      demo class generator
supabase/schema.sql
```

## Design choices (good to mention to judges)
- **Not punitive:** "You're not in trouble." Students can also ask for breaks, and reports track the shift from instructor-started to self-requested breaks, which is the self-regulation goal.
- **Calm, predictable sensory design:** muted colors, sounds always fade in and out, big tap targets, respects reduced-motion settings, 🔊 read-aloud on questions.
- **Personal, not generic:** instructors see each student's favorites and happy things, and can upload calming audio per student.
- **Built to grow:** every check-in logs emotion, strength and reason, and `getCopingPlan()` is the hook for per-emotion coping plans later (today every distress check-in uses one shared plan).

## Before real-world use / scaling
- The demo access rules in `schema.sql` let anyone with the anon key read and write. Add Supabase Auth plus per-teacher policies before using real student data (COPPA/FERPA), plus parent consent.
- A browser can't truly lock a device. Pair it with iPad Guided Access or Chromebook kiosk mode if needed.
- Only upload audio you have the rights to use (your own recordings or free-license tracks).
- **Future:** per-emotion coping plans, a parent portal, LLM-written weekly summaries, and optional wearables for stress signals.
