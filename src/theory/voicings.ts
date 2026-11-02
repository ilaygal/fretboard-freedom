import { getChord, CHORD_TYPES, type ChordInfo, type ChordTypeId } from './chord';
import { mod12, pitchClassOf, type PitchClass } from './note';
import { midiAt, type FretPos, type FretRange } from './fretboard';
import { openMidi, stringCount, STANDARD_TUNING, type Tuning } from './tuning';

/**
 * Chord voicings: concrete places to play a chord.
 *
 * Triads and drop-2/drop-3 shapes are found by pitch (each note the next higher occurrence of its
 * pitch class on the next string), so they come out right in any tuning. CAGED shapes are templates
 * and only work in standard tuning or standard moved up/down (same string intervals).
 */
export type VoicingKind = 'triad' | 'drop2' | 'drop3' | 'caged';
export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';

export interface Voicing {
  kind: VoicingKind;
  /** Played notes, lowest string first. Strings not listed are not played. */
  notes: FretPos[];
  /** Which chord tone is in the bass: 0 = root (root position), 1 = first inversion, ... */
  inversion: number;
  /** Strings used, lowest-pitched first (e.g. [4, 3, 2]). */
  strings: number[];
  /** Lowest and highest fret pressed (open strings count as fret 0). */
  span: FretRange;
  shape?: CagedShape;
  /** CAGED shapes that are awkward to play, kept as reference. */
  reference?: boolean;
}

/** How far a hand stretches: highest minus lowest pressed fret, open strings excluded. */
export const MAX_STRETCH = 4;

/** Adjacent three-string sets, lowest-pitched first, for a six-string guitar. */
export function triadStringSets(t: Tuning): number[][] {
  const n = stringCount(t);
  const out: number[][] = [];
  for (let low = n; low >= 3; low--) out.push([low, low - 1, low - 2]);
  return out;
}

/** Four adjacent strings for drop-2: sets 6-3, 5-2, 4-1 (named 3-6, 2-5, 1-4 by guitarists). */
export function drop2StringSets(t: Tuning): number[][] {
  const n = stringCount(t);
  const out: number[][] = [];
  for (let low = n; low >= 4; low--) out.push([low, low - 1, low - 2, low - 3]);
  return out;
}

/** Drop-3 skips one string above the bass: bass on string 6 or 5. */
export function drop3StringSets(t: Tuning): number[][] {
  const n = stringCount(t);
  const out: number[][] = [];
  for (let low = n; low >= 5; low--) out.push([low, low - 2, low - 3, low - 4]);
  return out;
}

function pressedSpan(notes: FretPos[]): FretRange {
  const frets = notes.map((n) => n.fret);
  return { from: Math.min(...frets), to: Math.max(...frets) };
}

function stretch(notes: FretPos[]): number {
  const pressed = notes.map((n) => n.fret).filter((f) => f > 0);
  return pressed.length ? Math.max(...pressed) - Math.min(...pressed) : 0;
}

/**
 * Every way to play pitch classes in this exact low-to-high order on these strings, each note above
 * the one before it (within an octave), within the neck and a comfortable stretch.
 */
export function placeInOrder(t: Tuning, strings: number[], order: PitchClass[], maxFret: number): FretPos[][] {
  const out: FretPos[][] = [];
  const first = strings[0]!;
  for (let f = 0; f <= maxFret; f++) {
    if (mod12(openMidi(t, first) + f) !== mod12(order[0]!)) continue;
    const notes: FretPos[] = [{ string: first, fret: f }];
    let prev = openMidi(t, first) + f;
    let ok = true;
    for (let i = 1; i < order.length; i++) {
      const s = strings[i]!;
      const next = prev + (mod12(order[i]! - prev) || 12);
      const fret = next - openMidi(t, s);
      if (fret < 0 || fret > maxFret) {
        ok = false;
        break;
      }
      notes.push({ string: s, fret });
      prev = next;
    }
    if (ok && stretch(notes) <= MAX_STRETCH) out.push(notes);
  }
  return out;
}

function rotate<T>(xs: T[], k: number): T[] {
  return [...xs.slice(k), ...xs.slice(0, k)];
}

/** Chord tones used for four-note shapes: sevenths as they are; 9th chords drop the fifth. */
function fourTones(chord: ChordInfo): PitchClass[] | null {
  const pcs = chord.tones.map((t) => t.pc);
  if (pcs.length === 4) return pcs;
  if (pcs.length === 5) return pcs.filter((_, i) => i !== 2);
  return null;
}

function sortVoicings(vs: Voicing[]): Voicing[] {
  return vs.sort((a, b) => a.span.from - b.span.from || b.strings[0]! - a.strings[0]! || a.inversion - b.inversion);
}

/** Close triads (root position and both inversions) on every set of three adjacent strings. */
export function triadVoicings(t: Tuning, chord: ChordInfo, maxFret: number, sets = triadStringSets(t)): Voicing[] {
  const pcs = chord.tones.map((x) => x.pc).slice(0, 3);
  if (pcs.length < 3) return [];
  const out: Voicing[] = [];
  for (const strings of sets) {
    for (let inv = 0; inv < 3; inv++) {
      for (const notes of placeInOrder(t, strings, rotate(pcs, inv), maxFret)) {
        // Close position: the three notes fit inside one octave.
        if (midiAt(t, notes[2]!) - midiAt(t, notes[0]!) >= 12) continue;
        out.push({ kind: 'triad', notes, inversion: inv, strings, span: pressedSpan(notes) });
      }
    }
  }
  return sortVoicings(out);
}

/**
 * Drop voicings of four-note chords. From a close voicing c0 < c1 < c2 < c3 (an inversion),
 * drop-2 lowers c2 an octave (low to high: c2 c0 c1 c3); drop-3 lowers c1 (c1 c0 c2 c3).
 */
export function dropVoicings(t: Tuning, chord: ChordInfo, kind: 'drop2' | 'drop3', maxFret: number): Voicing[] {
  const tones = fourTones(chord);
  if (!tones) return [];
  const sets = kind === 'drop2' ? drop2StringSets(t) : drop3StringSets(t);
  const out: Voicing[] = [];
  for (const strings of sets) {
    for (let inv = 0; inv < 4; inv++) {
      const c = rotate(tones, inv);
      const order = kind === 'drop2' ? [c[2]!, c[0]!, c[1]!, c[3]!] : [c[1]!, c[0]!, c[2]!, c[3]!];
      const bassTone = tones.indexOf(order[0]!);
      for (const notes of placeInOrder(t, strings, order, maxFret)) {
        out.push({ kind, notes, inversion: bassTone, strings, span: pressedSpan(notes) });
      }
    }
  }
  return sortVoicings(out);
}

/** Open-chord shapes, frets for strings 6..1 (null = not played), and which string holds the root. */
interface CagedTemplate {
  shape: CagedShape;
  frets: (number | null)[];
  rootString: number;
  reference?: boolean;
}

const CAGED_MAJOR: CagedTemplate[] = [
  { shape: 'C', frets: [null, 3, 2, 0, 1, 0], rootString: 5 },
  { shape: 'A', frets: [null, 0, 2, 2, 2, 0], rootString: 5 },
  { shape: 'G', frets: [3, 2, 0, 0, 0, 3], rootString: 6 },
  { shape: 'E', frets: [0, 2, 2, 1, 0, 0], rootString: 6 },
  { shape: 'D', frets: [null, null, 0, 2, 3, 2], rootString: 4 },
];

const CAGED_MINOR: CagedTemplate[] = [
  { shape: 'C', frets: [null, 3, 1, 0, 1, null], rootString: 5, reference: true },
  { shape: 'A', frets: [null, 0, 2, 2, 1, 0], rootString: 5 },
  { shape: 'G', frets: [3, 1, 0, 0, 3, 3], rootString: 6, reference: true },
  { shape: 'E', frets: [0, 2, 2, 0, 0, 0], rootString: 6 },
  { shape: 'D', frets: [null, null, 0, 2, 3, 1], rootString: 4 },
];

/** True when the tuning has standard tuning's string intervals (E standard, Eb, D standard...). */
export function hasStandardIntervals(t: Tuning): boolean {
  if (stringCount(t) !== 6) return false;
  const base = t.lowToHigh[0]! - STANDARD_TUNING.lowToHigh[0]!;
  return t.lowToHigh.every((m, i) => m - STANDARD_TUNING.lowToHigh[i]! === base);
}

/** The five CAGED shapes of a major or minor chord, moved up the neck. Empty in other tunings. */
export function cagedVoicings(t: Tuning, chord: ChordInfo, maxFret: number): Voicing[] {
  if (!hasStandardIntervals(t) || (chord.type !== 'maj' && chord.type !== 'min')) return [];
  const templates = chord.type === 'maj' ? CAGED_MAJOR : CAGED_MINOR;
  const rootPc = chord.tones[0]!.pc;
  const out: Voicing[] = [];
  for (const tpl of templates) {
    const rootFretInTemplate = tpl.frets[6 - tpl.rootString]!;
    const rootPcInTemplate = mod12(openMidi(t, tpl.rootString) + rootFretInTemplate);
    let shift = mod12(rootPc - rootPcInTemplate);
    const maxTemplateFret = Math.max(...tpl.frets.map((f) => f ?? 0));
    if (shift + maxTemplateFret > maxFret) shift -= 12;
    if (shift < 0) continue;
    const notes: FretPos[] = [];
    tpl.frets.forEach((f, i) => {
      if (f !== null) notes.push({ string: 6 - i, fret: f + shift });
    });
    const bassTone = chord.tones.findIndex((x) => x.pc === mod12(midiAt(t, notes[0]!)));
    out.push({
      kind: 'caged',
      notes,
      inversion: Math.max(0, bassTone),
      strings: notes.map((n) => n.string),
      span: pressedSpan(notes),
      shape: tpl.shape,
      reference: tpl.reference,
    });
  }
  return out.sort((a, b) => a.span.from - b.span.from);
}

/** Total semitones the voices move from one voicing to the next (each voice to its nearest new note). */
export function movement(t: Tuning, a: Voicing, b: Voicing): number {
  const am = a.notes.map((n) => midiAt(t, n)).sort((x, y) => x - y);
  const bm = b.notes.map((n) => midiAt(t, n)).sort((x, y) => x - y);
  if (am.length === bm.length) return am.reduce((sum, m, i) => sum + Math.abs(m - bm[i]!), 0);
  return bm.reduce((sum, m) => sum + Math.min(...am.map((x) => Math.abs(x - m))), 0);
}

/** Whether every note of a voicing sits inside a fret window (open strings count as fret 0). */
export function insideWindow(v: Voicing, w: FretRange): boolean {
  return v.notes.every((n) => n.fret >= w.from && n.fret <= w.to);
}

/**
 * The smoothest way through a progression inside one fret window: one voicing per chord,
 * chosen so the voices move as little as possible (dynamic programming over all candidates).
 * Returns null if some chord has no voicing in the window.
 */
export function voiceLeadPath(t: Tuning, candidates: Voicing[][], w: FretRange): Voicing[] | null {
  const inWin = candidates.map((vs) => vs.filter((v) => insideWindow(v, w)));
  if (inWin.some((vs) => vs.length === 0)) return null;
  // cost[i][j]: best total movement ending with voicing j at chord i.
  let cost = inWin[0]!.map((v) => Math.abs((v.span.from + v.span.to) / 2 - (w.from + w.to) / 2) * 0.1);
  const back: number[][] = [];
  for (let i = 1; i < inWin.length; i++) {
    const prev = inWin[i - 1]!;
    const cur = inWin[i]!;
    const nextCost: number[] = [];
    const nextBack: number[] = [];
    for (const v of cur) {
      let best = Infinity;
      let arg = 0;
      prev.forEach((p, k) => {
        const c = cost[k]! + movement(t, p, v) + (p.strings.join() === v.strings.join() ? 0 : 1.5);
        if (c < best) {
          best = c;
          arg = k;
        }
      });
      nextCost.push(best);
      nextBack.push(arg);
    }
    cost = nextCost;
    back.push(nextBack);
  }
  let j = cost.indexOf(Math.min(...cost));
  const path: Voicing[] = [inWin[inWin.length - 1]![j]!];
  for (let i = back.length - 1; i >= 0; i--) {
    j = back[i]![j]!;
    path.unshift(inWin[i]![j]!);
  }
  return path;
}

export interface ChordName {
  root: string;
  type: ChordTypeId;
  /** Bass note when it isn't the root ("C/E"). */
  bass?: string;
  symbol: string;
}

const TYPE_PCS: { id: ChordTypeId; pcs: Set<number> }[] = CHORD_TYPES.filter((c) => c.id !== '5').map((c) => ({
  id: c.id,
  pcs: new Set(getChord('C', c.id).tones.map((x) => x.pc)),
}));

/**
 * Names a set of notes ("chord builder"). Every reading where some note is the root and the notes
 * match a known chord exactly; the reading with the bass note as root comes first.
 */
export function nameChord(pcs: PitchClass[], bassPc: PitchClass | null, spell: (pc: PitchClass) => string): ChordName[] {
  const set = new Set(pcs.map(mod12));
  const out: ChordName[] = [];
  if (set.size === 2) {
    const [a, b] = [...set];
    for (const root of [a!, b!]) {
      if (mod12((root === a ? b! : a!) - root) === 7) out.push(finish(root, '5'));
    }
    return out;
  }
  for (const root of set) {
    const rel = new Set([...set].map((p) => mod12(p - root)));
    for (const tp of TYPE_PCS) {
      if (tp.pcs.size === rel.size && [...rel].every((x) => tp.pcs.has(x))) out.push(finish(root, tp.id));
    }
  }
  function finish(root: number, type: ChordTypeId): ChordName {
    const rootName = spell(root);
    const symbol = getChord(rootName, type).symbol;
    const bass = bassPc !== null && mod12(bassPc) !== root ? spell(bassPc) : undefined;
    return { root: rootName, type, bass, symbol: bass ? `${symbol}/${bass}` : symbol };
  }
  return out.sort((x, y) => Number(Boolean(x.bass)) - Number(Boolean(y.bass)));
}

/** Moves a chord symbol's root (and bass) by semitones: "Am" +3 -> "Cm". */
export function transposeSymbol(symbol: string, semitones: number, spell: (pc: PitchClass) => string): string {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol.trim());
  if (!m) throw new Error(`Not a chord symbol: ${symbol}`);
  const root = spell(mod12(pitchClassOf(m[1]!) + semitones));
  const bass = m[3] ? `/${spell(mod12(pitchClassOf(m[3]) + semitones))}` : '';
  return `${root}${m[2]}${bass}`;
}
