import type { Numeral, ScaleId } from '@/theory';

/**
 * Backing-track styles and progressions, as data. Everything here is original or a generic
 * chord pattern (no songs).
 *
 * Patterns are one bar long, one character per grid step:
 *   X = accent, x = normal hit, o = soft (ghost) hit, . = rest.
 * Straight styles use 16 steps (sixteenth notes); shuffle styles use 12 (eighth-note triplets).
 *
 * Bass patterns use one token per step, separated by spaces:
 *   R = chord root, 5 = fifth, 8 = root an octave up, 3 = third, 7 = seventh (b7 on dominant/minor),
 *   6 = sixth, A = approach (a half step below the next chord's root), - = hold, . = rest.
 *
 * Comp (chords) patterns use the same hit characters as drums; a hit lasts until the next hit
 * or `compLength` steps, whichever is shorter.
 */
export type StyleId = 'rock' | 'blues' | 'funk' | 'pop' | 'ballad' | 'reggae' | 'jazz';

export interface StyleDef {
  id: StyleId;
  /** 16 = straight sixteenths, 12 = triplet (shuffle/swing) grid. */
  steps: 16 | 12;
  bpm: { min: number; max: number; default: number };
  drums: { kick: string; snare: string; hat: string; ride?: string };
  bass: string;
  comp: string;
  /** Longest a chord hit rings, in steps. */
  compLength: number;
  /** Which chord colour suits the style: plain triads or sevenths. */
  chordColour: 'triad' | 'seventh';
}

export const STYLES: readonly StyleDef[] = [
  {
    id: 'rock',
    steps: 16,
    bpm: { min: 80, max: 150, default: 112 },
    drums: { kick: 'X.....x.x.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'R - R - R - R - R - R - R - 5 -',
    comp: 'x.......x.......',
    compLength: 8,
    chordColour: 'triad',
  },
  {
    id: 'blues',
    steps: 12,
    bpm: { min: 60, max: 130, default: 88 },
    drums: { kick: 'X.....x.....', snare: '...X.....X..', hat: 'x.ox.ox.ox.o' },
    bass: 'R - 3 5 - 6 8 - 6 5 - 3',
    comp: '...x.o...x.o',
    compLength: 2,
    chordColour: 'seventh',
  },
  {
    id: 'funk',
    steps: 16,
    bpm: { min: 80, max: 120, default: 98 },
    drums: { kick: 'X..x..x...x..x..', snare: '....X..o.o..X..o', hat: 'xoxoxoxoxoxoxoxo' },
    bass: 'R . . 8 . . R . . . 5 . 7 . 8 .',
    comp: '..x..x.o..x..x.o',
    compLength: 1,
    chordColour: 'seventh',
  },
  {
    id: 'pop',
    steps: 16,
    bpm: { min: 80, max: 130, default: 104 },
    drums: { kick: 'X.....x.X.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'R - - R - - R - R - - R - - 5 -',
    comp: 'x..x..x.x..x..x.',
    compLength: 3,
    chordColour: 'triad',
  },
  {
    id: 'ballad',
    steps: 16,
    bpm: { min: 56, max: 84, default: 68 },
    drums: { kick: 'X.........x.....', snare: '........X.......', hat: 'x...x...x...x...' },
    bass: 'R - - - - - - - 5 - - - - - - -',
    comp: 'X.......x.......',
    compLength: 16,
    chordColour: 'triad',
  },
  {
    id: 'reggae',
    steps: 16,
    bpm: { min: 66, max: 90, default: 76 },
    drums: { kick: '........X.......', snare: '........X.......', hat: '..x...x...x...x.' },
    bass: 'R - - . . . 5 - 8 - - . 5 . 3 .',
    comp: '....x.......x...',
    compLength: 2,
    chordColour: 'triad',
  },
  {
    id: 'jazz',
    steps: 12,
    bpm: { min: 70, max: 180, default: 120 },
    drums: { kick: 'o...........', snare: '...........o', hat: '...x.....x..', ride: 'x..x.xx..x.x' },
    bass: 'R - - 3 - - 5 - - A - -',
    comp: 'x.......x...',
    compLength: 4,
    chordColour: 'seventh',
  },
];

export function getStyle(id: StyleId): StyleDef {
  const s = STYLES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown style: ${id}`);
  return s;
}

export interface ProgressionDef {
  id: string;
  /** One numeral per bar. Seventh styles add sevenths to plain numerals on their own. */
  bars: Numeral[];
  mode: 'major' | 'minor';
  /** Styles this progression suits, best first. */
  styles: StyleId[];
  /** Scales that work over the whole progression, easiest first. */
  scales: ScaleId[];
}

export const PROGRESSIONS: readonly ProgressionDef[] = [
  { id: 'popAnthem', bars: ['I', 'V', 'vi', 'IV'], mode: 'major', styles: ['pop', 'rock', 'ballad'], scales: ['majorPentatonic', 'major'] },
  { id: 'sadTurn', bars: ['vi', 'IV', 'I', 'V'], mode: 'major', styles: ['pop', 'ballad', 'rock'], scales: ['majorPentatonic', 'major'] },
  { id: 'threeChord', bars: ['I', 'IV', 'V', 'IV'], mode: 'major', styles: ['rock', 'pop', 'reggae'], scales: ['majorPentatonic', 'major'] },
  { id: 'doowop', bars: ['I', 'vi', 'IV', 'V'], mode: 'major', styles: ['ballad', 'pop'], scales: ['majorPentatonic', 'major'] },
  {
    id: 'twelveBar',
    bars: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    mode: 'major',
    styles: ['blues', 'rock', 'jazz'],
    scales: ['minorPentatonic', 'blues', 'majorPentatonic'],
  },
  {
    id: 'quickChange',
    bars: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    mode: 'major',
    styles: ['blues'],
    scales: ['minorPentatonic', 'blues', 'majorPentatonic'],
  },
  { id: 'minorRock', bars: ['i', 'bVII', 'bVI', 'bVII'], mode: 'minor', styles: ['rock', 'ballad'], scales: ['minorPentatonic', 'minor'] },
  { id: 'epicMinor', bars: ['i', 'bVI', 'bIII', 'bVII'], mode: 'minor', styles: ['pop', 'rock', 'ballad'], scales: ['minorPentatonic', 'minor'] },
  { id: 'minorBlues', bars: ['i7', 'i7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'bVI7', 'V7', 'i7', 'V7'], mode: 'minor', styles: ['blues', 'jazz'], scales: ['minorPentatonic', 'blues'] },
  { id: 'dorianVamp', bars: ['i7', 'IV7'], mode: 'minor', styles: ['funk', 'rock'], scales: ['minorPentatonic', 'dorian'] },
  { id: 'oneChordFunk', bars: ['I7', 'I7'], mode: 'major', styles: ['funk'], scales: ['minorPentatonic', 'mixolydian', 'blues'] },
  { id: 'mixoRock', bars: ['I', 'bVII', 'IV', 'I'], mode: 'major', styles: ['rock', 'reggae'], scales: ['majorPentatonic', 'mixolydian'] },
  { id: 'reggaeTwo', bars: ['i', 'iv'], mode: 'minor', styles: ['reggae'], scales: ['minorPentatonic', 'dorian'] },
  { id: 'twoFiveOne', bars: ['ii7', 'V7', 'Imaj7', 'Imaj7'], mode: 'major', styles: ['jazz'], scales: ['majorPentatonic', 'major'] },
  { id: 'minorTwoFive', bars: ['iiø7', 'V7', 'i7', 'i7'], mode: 'minor', styles: ['jazz'], scales: ['minorPentatonic', 'harmonicMinor'] },
];

export function getProgression(id: string): ProgressionDef {
  const p = PROGRESSIONS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown progression: ${id}`);
  return p;
}

/** Keys that sit well on guitar (open strings ring), picked more often by "Surprise me". */
export const FRIENDLY_KEYS = { major: ['E', 'A', 'G', 'D', 'C'], minor: ['E', 'A', 'D', 'B', 'G'] } as const;
