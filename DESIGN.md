---
name: Calm Compass
description: Low-stimulation calm-break app for autistic students, plus a teacher dashboard
colors:
  bg: "#f5f3ee"
  card: "#ffffff"
  ink: "#2f3a40"
  muted: "#556166"
  line: "#e3dfd6"
  accent: "#3f6e70"
  accent-soft: "#dceeee"
  warn: "#a8683a"
  ok: "#477452"
  angry: "#d9826b"
  scared: "#9a87c0"
  sad: "#7f9cc4"
  overwhelmed: "#6fa6a8"
  lonely: "#c08fa8"
  not-sure: "#8a9499"
typography:
  heading:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 3vw, 2.2rem)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: ".9rem"
    lineHeight: 1.45
rounded:
  sm: "10px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.card}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: ".8rem 1rem"
---

## Overview
The interface is quiet and warm-neutral: off-white paper, soft white cards, one muted teal accent. The kid side is a single-task overlay with large icon tiles and a fixed bottom bar (Back, an optional action, Sound). The teacher side is a scannable dashboard of cards, with charts in reports.

## Colors
- The neutrals (`bg`, `card`, `ink`, `muted`, `line`) carry almost everything.
- `accent` is reserved for primary actions and focus.
- Each emotion has a `color`, a darker `ink` for text, and a `soft` tint for its tile and overlay background. These live in `src/content.js` and are the only colors allowed inline.
- `warn` marks things that need attention, never errors aimed at the student.
- `ok` marks positive outcomes.
- Body text meets WCAG AA.

## Typography
- Use Atkinson Hyperlegible everywhere, through `src/fonts.js`.
- There is one heading size plus body and small. Kid screens use few words at a large size.

## Layout
- The content column is `.wrap` (960px max) with `.stack` vertical rhythm of 16px.
- Kid steps are centered, with tile grids that reflow on narrow screens.
- The break bar is pinned to the bottom of the overlay.

## Elevation & Depth
Use a single soft shadow (`0 2px 10px rgba(47,58,64,.06)`) plus a 1px `line` border. Nothing floats higher.

## Shapes
- Radii: 18px for cards and tiles, 12px for controls, 10px for small chips, and pills for status tags.
- Icons come from Tabler (outline), inlined through `src/icons.js`.

## Components
- `.tile`: a big icon-plus-label choice.
- `.seg`: segmented control.
- `.card`: container.
- `.pill`: status.
- `.break-bar`: the overlay's action bar.
- Teacher student cards are sorted by need, and the Needs-you strip is sticky.
- Focus is shown with a 3px `accent` outline.

## Do's and Don'ts
Do:
- Put all styling in `src/styles.css` and use the variables.
- Keep motion gentle and remove it under reduced motion.
- Give every step a skip.

Don't:
- No inline colors, spacing, or fonts (emotion colors are the exception).
- No flashing.
- No red "wrong" states.
- No emoji.
- No scores or streaks.
- No dense text on kid screens.
