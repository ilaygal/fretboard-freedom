import { getScale, type ScaleId } from './scale';
import { mod12, pitchClassOf } from './note';
import { openMidi, stringCount, type Tuning } from './tuning';
import type { FretPos, FretRange } from './fretboard';

/**
 * Scale positions ("boxes"): fixed hand shapes that tile the neck.
 *
 * Shapes are built by walking up the scale string by string, a fixed number of notes per string
 * (2 for pentatonic boxes, 3 for seven-note scales), starting from a different scale note on the
 * lowest string for each position. Because the walk follows pitch, the shapes come out right in
 * any tuning (the B-string shift in standard tuning appears on its own).
 *
 * Position 1 starts on the home note on the lowest string, so for minor pentatonic it is the
 * familiar box with the root under the index finger. Positions 2.. go up the neck from there.
 */
export interface ScalePosition {
  /** 1-based position number. */
  index: number;
  notes: FretPos[];
  /** Lowest and highest fret used. */
  span: FretRange;
}

export type PositionSystem = 'pentatonicBox' | 'threePerString';

function shapeFrom(tuning: Tuning, pcsAsc: number[], startIdx: number, startFret: number, perString: number): FretPos[] {
  const lowest = stringCount(tuning);
  const out: FretPos[] = [];
  let idx = startIdx;
  let midi = openMidi(tuning, lowest) + startFret;
  for (let s = lowest; s >= 1; s--) {
    for (let k = 0; k < perString; k++) {
      if (!(s === lowest && k === 0)) {
        const cur = pcsAsc[idx % pcsAsc.length]!;
        idx++;
        const next = pcsAsc[idx % pcsAsc.length]!;
        midi += mod12(next - cur) || 12;
      }
      out.push({ string: s, fret: midi - openMidi(tuning, s) });
    }
  }
  return out;
}

function spanOf(notes: FretPos[]): FretRange {
  const frets = notes.map((n) => n.fret);
  return { from: Math.min(...frets), to: Math.max(...frets) };
}

function shift(notes: FretPos[], by: number): FretPos[] {
  return notes.map((n) => ({ string: n.string, fret: n.fret + by }));
}

/** Adds notes of `extraPcs` that fall inside the shape's fret span (e.g. the blue note in a blues box). */
function withExtras(tuning: Tuning, notes: FretPos[], extraPcs: number[]): FretPos[] {
  if (extraPcs.length === 0) return notes;
  const span = spanOf(notes);
  const extras: FretPos[] = [];
  for (let s = 1; s <= stringCount(tuning); s++) {
    for (let f = span.from; f <= span.to; f++) {
      if (extraPcs.includes(mod12(openMidi(tuning, s) + f))) extras.push({ string: s, fret: f });
    }
  }
  return [...notes, ...extras];
}

export function positionSystemFor(scale: ScaleId): PositionSystem {
  return scale === 'minorPentatonic' || scale === 'majorPentatonic' || scale === 'blues' ? 'pentatonicBox' : 'threePerString';
}

/** Sorts positions from the lowest string up, then by fret. */
function sortNotes(notes: FretPos[]): FretPos[] {
  return [...notes].sort((a, b) => b.string - a.string || a.fret - b.fret);
}

/** All positions of a scale for this tuning, placed on a neck with `maxFret` frets. */
export function scalePositions(tuning: Tuning, tonic: string, scale: ScaleId, maxFret: number): ScalePosition[] {
  const system = positionSystemFor(scale);
  // Blues uses the minor pentatonic boxes plus its blue note.
  const base = getScale(tonic, scale === 'blues' ? 'minorPentatonic' : scale);
  const pcsAsc = base.notes.map((n) => n.pc);
  const extraPcs = scale === 'blues' ? getScale(tonic, 'blues').notes.map((n) => n.pc).filter((pc) => !pcsAsc.includes(pc)) : [];
  const perString = system === 'pentatonicBox' ? 2 : 3;
  const lowestOpen = openMidi(tuning, stringCount(tuning));
  const firstFret = mod12(pitchClassOf(tonic) - lowestOpen);
  const tonicPc = pcsAsc[0]!;

  return pcsAsc.map((pc, i) => {
    const startFret = firstFret + mod12(pc - tonicPc);
    let notes = shapeFrom(tuning, pcsAsc, i, startFret, perString);
    let span = spanOf(notes);
    if (span.from < 0) notes = shift(notes, 12);
    span = spanOf(notes);
    if (span.to > maxFret && span.from - 12 >= 0) notes = shift(notes, -12);
    notes = withExtras(tuning, notes, extraPcs).filter((n) => n.fret >= 0 && n.fret <= maxFret);
    return { index: i + 1, notes: sortNotes(notes), span: spanOf(notes) };
  });
}
