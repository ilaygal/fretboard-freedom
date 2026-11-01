# Fretboard Freedom: working notes

## Goal
A personal guitar platform that makes the player feel free on the neck: know every note, play chords anywhere,
recognise music by ear, understand solos, and improvise. It must feel like an instrument and a game, not homework.
Top UX rule: at most two taps from opening the app to hearing a backing track (from Phase 3 on).

It starts as a single-player app but must be shareable: nothing about one player is hardcoded. Every module reads
the active profile and its settings.

Plan doc (architecture, phases, risks): https://claude.ai/artifact/4vfFmYK3v8DostBbCH83aj

## Player preferences that shape the product
- The first player does **not** want to become a theory expert. Default `theoryLevel` is `simple`: plain-language
  explanations ("home note" for root), theory symbols only on request (`detailed`, or the Intervals label mode).
- Primary device is an **iPhone**: test iOS Safari first (audio unlock on first tap, `navigator.audioSession`,
  mic in an installed PWA, safe areas). Vertical neck on narrow screens.
- Dark, stage-like UI, readable at arm's length, big tap targets (min 48 px), minimal typing.

## Musical conventions (decided; do not change without asking)
- **Strings** are numbered the guitarist's way: string 1 = highest pitch (thin E), string 6 = lowest.
  `Tuning.lowToHigh` lists open strings low to high; use `openMidi(tuning, stringNumber)`.
- **Octaves** are scientific: middle C = C4 = MIDI 60; standard tuning is E2 A2 D3 G3 B3 E4.
- **Spelling** is key-aware: scale notes as the key spells them (F# in D major, Bb in F major). Rare spellings
  (Cb, Fb, E#, B#, double accidentals) are simplified unless the `strictSpelling` setting is on. Notes outside a key
  follow the key's sharp/flat direction; with no key, the player's `accidentals` setting. Tonic names pick the
  spelling with fewer accidentals (Db major, C# minor, F# for pitch class 6, Eb minor).
- **Interval symbols:** R b2 2 b3 3 4 b5 5 b6 6 b7 7. In scale context 2/4/6; in chord context 9/11/13 (b9, #9,
  #11, b13). The scale's own character note wins: #4 in Lydian, b5 in blues/diminished, #5 in augmented, bb7 in dim7.
- **Solfège** is fixed do (Do = C), shown as a label mode.
- **Pentatonic position 1** = the minor pentatonic box with the root on string 6 under the index finger; positions
  2 to 5 go up the neck. Major pentatonic reuses the shapes from its own root.
- **Avoid notes** = a scale note a half step above a chord tone, held over that chord. Blue notes (b3 over a
  dominant chord, b5) get their own colour (`blue` role) and are never called "avoid".
- **CAGED:** all five shapes for major and minor; awkward minor shapes are "reference shapes". Other qualities use
  drop-2 (sets 1-4, 2-5, 3-6) and drop-3 (bass on string 6 or 5).
- **Triads:** close voicings on adjacent string sets first; spread triads later.
- **Ear training key context:** I-IV-V-I cadence first; minor keys use harmonic-minor V. Answers are big buttons.
- **Mic checks** accept the right pitch (and octave when asked); a mic cannot know which string was used.
- **Alternate tunings:** shape-based features (CAGED, boxes, drop voicings) work in standard and transposed tunings;
  open/modal tunings fall back to the algorithmic voicing finder.

## Architecture
Client-only React PWA, layered. Each layer only imports the layers below it.

| Layer | Folder | Holds | May import |
| --- | --- | --- | --- |
| Theory | `src/theory` | Pure TS music logic | `tonal` only |
| Audio | `src/audio` | Tone.js engine, instruments, pitch detection | Tone, pitchy, theory |
| Data | `src/data` | Dexie schema, repository interfaces + Dexie implementations, backup | dexie |
| Content | `src/content` | Progressions, styles, challenges, onboarding options as data | theory types |
| Domain | `src/domain` | Drill engine, spaced repetition, planner (Phase 2+) | theory, data, content |
| UI kit | `src/components` | Shared `Fretboard`, buttons, chips | theory types |
| Modules | `src/modules/*` | One folder per feature | everything above |
| App | `src/app` | Shell, routes, profile context | everything |

Key decisions:
- **Wrap Tonal, own the types** (`FretPos`, `Tuning`, `ScaleInfo`, `ChordInfo`). Modules never call Tonal directly.
- **Fretboard** (`src/components/fretboard`) is controlled and presentational. Geometry is a pure function
  (`computeLayout`) with tests: horizontal (string 1 on top, nut left) or vertical (headstock up, low string on the
  left), mirrored for left-handed players. Marker positions use the SVG `transform` attribute; CSS `translate(px)`
  on markers misplaces them when the SVG is scaled, so don't use it. Always LTR.
- **Data access only through repositories** (`repos.profiles`, `repos.backup`), so a synced backend (Supabase) can be
  added later. Settings are merged with `DEFAULT_SETTINGS` on read, so new settings need no migration.
- **Audio:** Tone.js is preloaded at startup; `unlockAudio()` runs on the first pointer/key event (iOS needs the
  gesture). `playMidi()` is the tap-to-hear entry point. Samples come in Phase 2.
- **Routing:** `HashRouter` (GitHub Pages has no rewrites). Base path `/fretboard-freedom/` (override with `VITE_BASE`).
- **i18n:** i18next, English strings in `src/i18n/en/common.json`. Every user-visible string goes through `t()`.
  `applyLanguage()` sets page `dir`; fretboard and tab views stay LTR.
- **PWA:** vite-plugin-pwa (autoUpdate). Icons are rendered from `public/icon.svg` by `node scripts/make-icons.cjs`.

## Conventions
- Strict TypeScript, `noUncheckedIndexedAccess`; no `any`. Named exports. Import with the `@/` alias.
- `src/theory` never imports React, Tone or Dexie. Modules never import Dexie; use `@/data` repositories.
- Nothing player-specific is hardcoded; defaults live in `DEFAULT_SETTINGS` or `src/content`.
- Every theory function has unit tests, including property-based tests (fast-check) across keys and tunings.
  A bug fix in theory starts with a failing test.
- Pure logic for a screen lives in a `model.ts` next to it, with tests.
- Commits: `phase-N: <what changed>`. Each phase ends with the app running, tests green, deployed, and this file updated.

## Commands
```bash
npm run dev         # dev server
npm test            # Vitest, all unit tests
npm run typecheck   # tsc -b
npm run build       # typecheck + production build into dist/
npm run preview     # serve dist/ at http://localhost:4173/fretboard-freedom/
node scripts/make-icons.cjs   # regenerate PWA icons (needs Playwright + Chromium)
```
CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every PR. `deploy.yml` deploys `main` to GitHub
Pages (repo Settings, Pages, Source: GitHub Actions).

## Phase status
- [x] Phase 1: foundation (theory core, fretboard, profile/settings/backup, onboarding, neck explorer, PWA, CI/deploy)
- [ ] Phase 2: Fretboard Mastery, tuner, metronome, pitch detection, drill engine, spaced repetition
- [ ] Phase 3: backing-track engine, Free Play, Improv Lab core
- [ ] Phase 4: Chords Everywhere (triads first, CAGED, drop-2/3, voice leading, chord builder, lookup tools)
- [ ] Phase 5: improv challenges, mic analysis, lick library, recording
- [ ] Phase 6: Ear Training
- [ ] Phase 7: Solo Study (alphaTab)
- [ ] Phase 8: planner, progress, PWA polish, Hebrew
- [ ] Phase 9: Transcription Assistant
