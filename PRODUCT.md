# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
- **Students (/kid):** autistic middle and early high school students, some of them nonspeaking. They open the app mid-distress on a classroom laptop or tablet, either on their own or because a teacher started a break for them.
- **Instructors (/teacher):** special-education teachers and aides. They use a live dashboard while they are teaching and read reports afterwards.
- **Demo audience:** special-needs clinics evaluating the app at the Capital Hacks hackathon.

## Product Purpose
Calm Compass gives a student a short, predictable calm break. The student picks how they feel, then optionally notes a body feeling, how strong it is, and what happened. They choose a coping strategy, then do a 60-second calming activity (rain, waves, music, breathing, drawing, or tracing a path). At the end they say whether it helped.

The teacher sees who needs them right now. Over time they see patterns: which feelings come up, what triggers them, which subject is hardest, and which strategies actually help.

Success means:
- a student can get through a break with taps only and no reading;
- a teacher can understand the live view at a glance.

## Positioning
The app is calm first and data second. Every question can be skipped, nothing is ever scored or punitive, and the student owns their coping plan. Teacher analytics come out of breaks the student actually chose to log. There is no sensing or surveillance.

## Operating Context
- Classroom laptops and tablets, used during lessons.
- A teacher can start a break remotely. They can also send a calming sound they uploaded.
- One class has many subjects. The teacher sets the current subject, so the student is never asked for it.
- The app works with Supabase (realtime) or in a local demo mode with no backend. "Create demo class" generates three realistic students.

## Capabilities and Constraints
- Stack: Vite multi-page app (index, kid, teacher), vanilla JS with template strings, the `esc()` helper for all user text, Chart.js, and Supabase.
- No new frameworks.
- Schema changes are additive only.
- Out of scope: voice recognition, camera, facial data, and photos of students.
- The student flow stays short. Every step has big tap targets and an easy skip.

## Evidence on Hand
- The only data is demo data from `src/demo.js` (Maya, Leo, Sam), which is fictional.
- There are no real users, testimonials, outcomes, or clinical validation. Do not imply any.

## Product Principles
1. Never punitive: no scores, streaks, failure states, or "wrong" answers.
2. Predictable over novel: the same steps, in the same place, every time.
3. Skippable by default: every question has a low-effort way out.
4. Icon first, words second, read-aloud available.
5. The teacher view answers "who needs me now?" before anything else.

## Accessibility & Inclusion
- Low stimulation: muted colors, no flashing, and gentle motion only. Respect `prefers-reduced-motion`.
- Large tap targets and taps-only operation.
- Keyboard reachable, with focus kept inside the break overlay.
- Atkinson Hyperlegible type.
- Sound is off-switchable.
