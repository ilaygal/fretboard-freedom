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
| Domain | `src/domain` | Drill engine, spaced repetition, backing-track arranger, planner | theory, data, content |
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
  gesture). `playMidi()` (`src/audio/play.ts`) is the tap-to-hear entry point. It plays real acoustic guitar recordings,
  one per semitone D2-D5 (`public/samples/guitar-acoustic`, rebuilt by `scripts/prepare-guitar-samples.sh`), so notes are
  not pitch-shifted (shifting made them sound thin and metallic). The recordings load once (`loadGuitarBuffers`) and
  every guitar shares them (`makeGuitarSampler`: eased-off top end plus a little of the shared `getRoom()` reverb).
  Taps made while they load wait up to ~0.6 s for them; only if loading is slow or fails does a soft triangle synth
  stand in. Never use bright plucked/FM synths for guitar or chords: they read as metallic. Everything goes through `getMaster()`. The metronome runs on Tone's transport and
  reports ticks via `Tone.Draw` so visuals stay in sync.
- **Backing tracks:** styles (drum/bass/comp patterns as strings, 16-step straight or 12-step triplet grid) and
  progressions (roman numerals, one per bar) are data in `src/content/backing.ts`. Numerals always count from the
  home note's major scale (minor keys write i, bIII, bVI, bVII); `src/theory/progression.ts` resolves them with
  key-aware spelling. `src/domain/backing/arrange.ts` turns style + chords into timed notes in transport ticks
  (PPQ 192, tempo-independent): bass from chord tones in B0-D#2, comp as close voicings with voice leading around
  middle C. `src/audio/backing/player.ts` (`backing`) plays them with synth drums, a round triangle-wave bass and strummed
  acoustic-guitar chords (the shared recordings, 12 ms per string) on a looping `Tone.Part`, with per-channel mix (`settings.backingMix`), and reports every beat
  through `Tone.Draw`. Starting the band stops the metronome (they share the transport).
- **Jam screens** (`src/modules/jam`): `/play` (Free Play) opens with a random jam (`randomJam`, leaning to the
  player's liked styles and guitar-friendly keys), so Home -> Free Play -> Play is two taps. `/improv` (Improv Lab)
  keeps the same jam and adds hand positions (neck zooms to the box), training wheels (full map, chord notes only,
  home notes only, off) and label modes. During the last beat of a bar, the next chord's new notes show as `target`.
  Note roles over the current chord come from `roleOverChord` (`src/theory/harmony.ts`).
- **Scale positions** (`src/theory/positions.ts`): built by walking up the scale string by string, 2 notes per
  string for pentatonic boxes (blues = minor pentatonic box plus the b5 inside its span) and 3 per string for
  seven-note scales. Following pitch makes the shapes right in any tuning. CAGED scale shapes are planned for Phase 8.
- **Chord voicings** (`src/theory/voicings.ts`): triads (close, every inversion, adjacent string sets) and drop-2 /
  drop-3 shapes are found by pitch with `placeInOrder` (each note the next higher occurrence on the next string,
  stretch at most `MAX_STRETCH` = 4 frets), so they work in any tuning. CAGED shapes are templates and only appear
  when `hasStandardIntervals(tuning)` (standard, Eb, D standard); other tunings show triads and drop shapes.
  `voiceLeadPath` picks one voicing per chord inside a fret window by dynamic programming (least total voice
  movement, small penalty for changing string set). `nameChord` names tapped notes; `transposeSymbol` moves chords.
- **Chords screen** (`src/modules/chords`, `/chords`): Find a chord (shape families, step through every voicing,
  other places greyed), Play a progression (band + voice-led shapes inside a 5-fret window, next shape and voice
  movement lines on the last beat, "names only" to play from memory), Name my chord (tap one note per string),
  Change key (transpose with a capo hint). The band logic is shared through `useBand` (`src/app/useBand.ts`) and
  the sticky now/next bar is `StageBar` (`src/components/stage`).
- **Improv challenges** (`src/modules/challenges`, `/challenges`): constraints are data in `src/content/challenges.ts`
  (rule kinds: free, strings, chordTones, targetThird, fewNotes, callResponse, rhythmOnly, newPosition). While the band
  plays, each mic note is stamped with bar/beat from `backing.ticksNow()` minus the detection delay (~130 ms +
  `latencyMs`), and `analyseImprov` (`src/domain/improv/analysis.ts`) builds the report: chord-note %, in-key %, range,
  low/mid/high register split, and a rule score. String and position rules are checked by pitch range (a mic hears
  pitch, not strings). `verdict` turns it into 0-3 stars and at most two plain tips. Passed challenges are attempts
  with drill id `improv.<id>`.
- **Recording:** `src/audio/recorder.ts` records the master bus plus the mic through a MediaStreamDestination
  (MediaRecorder, mp4 preferred for iOS, else webm). Recordings live in `repos.recordings` and are **device-only**:
  `LOCAL_ONLY_TABLES` keeps them out of backup export/import (blobs are large).
- **Lick library** (`src/modules/licks`, `/licks`): original licks in `src/content/licks.ts`, written as semitones
  from the home note with sixteenth-note durations, so every lick works in every key. `placeLick` puts a lick inside a
  scale box; "Hear it" uses `playPhrase`; "Play it back" follows the mic note by note with `LickFollower` (pitch
  class, rests skipped; attempt drill id `licks.playback.<id>`); "Next key" walks `ALL_KEYS_ORDER`. "Make your own"
  saves tapped notes relative to the home note at or below the first note (`repos.licks`, schema v3).
- **Pitch detection:** `listenToMic()` uses an `AnalyserNode` (fftSize 4096) polled ~30x/s with pitchy (McLeod).
  An AudioWorklet was the plan, but the analyser is simpler and reliable on iOS; revisit only if latency matters.
  Mic constraints turn off echo cancellation, noise suppression and AGC. `PitchStabilizer` turns noisy frames into
  "note played" events (clear, loud, steady for 4 frames, reported once until silence). While the mic is on,
  `navigator.audioSession.type` is `play-and-record`, otherwise `playback`.
- **Practice data:** every answer is an `Attempt` (`repos.attempts`), with the neck position when there is one
  (feeds the heatmap). Spaced repetition is FSRS-lite (`src/domain/srs/fsrs.ts`, FSRS-4.5 default weights) on
  stable item keys: `pos:<string>:<fret>`, `note:<pc>@s<string>`, `all:<pc>`. `pickNext` weights items by urgency
  and never repeats the last few. Drill ids are `notes.<mode>.<levelId>`.
- **Note-finder levels** are data in `src/content/noteFinderLevels.ts`: string by string (natural notes first), then
  fret regions, then the whole neck. A level is "passed" at 85% over its last 20 attempts; that only drives the
  "Next up" badge, players can pick any level.
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
- Feedback colours: the correct answer is always green (`ANSWER_GREEN`), a wrong tap gets a red ring. Never show
  the answer in the red/orange root colour; it reads as "wrong".
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
- [x] Phase 2: Fretboard Mastery (name/find/find-all/play-by-mic, levels, heatmap, octave shapes), tuner, metronome, timing check, drill engine, spaced repetition
- [x] Phase 3: backing-track engine, Free Play, Improv Lab core (CAGED scale shapes moved to Phase 8)
- [x] Phase 4: Chords Everywhere (triads, CAGED, drop-2/3, voice-led progression trainer, chord builder, transpose; circle of fifths and CAGED scale shapes moved to Phase 8)
- [x] Phase 5: improv challenges, mic analysis, lick library, recording
- [ ] Phase 6: Ear Training
- [ ] Phase 7: Solo Study (alphaTab)
- [ ] Phase 8: planner, progress, PWA polish, Hebrew, circle of fifths, CAGED scale shapes
- [ ] Phase 9: Transcription Assistant
