import {
  midiAt,
  mod12,
  openMidi,
  pitchClassOf,
  scalePositions,
  stringCount,
  type FretPos,
  type ScaleId,
  type ScalePosition,
  type Tuning,
} from '@/theory';

export interface LickNoteLike {
  st: number | null;
  dur: number;
}

export interface PlacedNote {
  /** null for a rest. */
  midi: number | null;
  pos: FretPos | null;
  dur: number;
}

/** Hand positions a lick is shown in: its scale's boxes (pentatonic boxes or 3-per-string shapes). */
export function lickBoxes(tuning: Tuning, tonic: string, scale: ScaleId, maxFret: number): ScalePosition[] {
  return scalePositions(tuning, tonic, scale, maxFret);
}

/**
 * Puts a lick on the neck in a key, inside one hand position: notes the box has are played there;
 * passing notes go on the nearest string within a fret of the box. The lick's home note is the lowest
 * home note inside the box (unless that pushes the lick off the neck).
 */
export function placeLick(tuning: Tuning, tonic: string, notes: readonly LickNoteLike[], box: ScalePosition, maxFret: number): PlacedNote[] {
  const tonicPc = pitchClassOf(tonic);
  const boxMidis = box.notes.map((p) => midiAt(tuning, p));
  const roots = boxMidis.filter((m) => mod12(m) === tonicPc).sort((a, b) => a - b);
  const sts = notes.flatMap((x) => (x.st === null ? [] : [x.st]));
  const lowest = openMidi(tuning, stringCount(tuning));
  const highest = openMidi(tuning, 1) + maxFret;
  let base = roots[0] ?? Math.min(...boxMidis);
  // Keep the whole lick playable.
  while (base + Math.min(0, ...sts) < lowest) base += 12;
  while (base + Math.max(0, ...sts) > highest && base - 12 + Math.min(0, ...sts) >= lowest) base -= 12;

  let prev: FretPos | null = null;
  return notes.map((x) => {
    if (x.st === null) return { midi: null, pos: null, dur: x.dur };
    const midi = base + x.st;
    const inBox = box.notes.filter((p) => midiAt(tuning, p) === midi);
    let options = inBox;
    if (options.length === 0) {
      options = [];
      for (let s = 1; s <= stringCount(tuning); s++) {
        const f = midi - openMidi(tuning, s);
        if (f >= Math.max(0, box.span.from - 1) && f <= Math.min(maxFret, box.span.to + 1)) options.push({ string: s, fret: f });
      }
    }
    if (options.length === 0) {
      for (let s = 1; s <= stringCount(tuning); s++) {
        const f = midi - openMidi(tuning, s);
        if (f >= 0 && f <= maxFret) options.push({ string: s, fret: f });
      }
    }
    const centre = (box.span.from + box.span.to) / 2;
    const p0 = prev;
    const pos =
      options.sort(
        (a, b) =>
          (p0 ? Math.abs(a.string - p0.string) - Math.abs(b.string - p0.string) : 0) * 2 +
          Math.abs(a.fret - centre) -
          Math.abs(b.fret - centre),
      )[0] ?? null;
    if (pos) prev = pos;
    return { midi, pos, dur: x.dur };
  });
}

/** Follows a player through a lick by mic: the next expected note must be heard to move on. */
export class LickFollower {
  private i = 0;
  wrong = 0;
  constructor(
    private readonly expected: readonly number[],
    private readonly exactOctave: boolean,
  ) {}

  get index(): number {
    return this.i;
  }

  get done(): boolean {
    return this.i >= this.expected.length;
  }

  /** Feed a heard note; returns whether it was the one expected. Repeats of the previous note are ignored. */
  hear(midi: number): 'right' | 'wrong' | 'ignored' {
    if (this.done) return 'ignored';
    const want = this.expected[this.i]!;
    const ok = this.exactOctave ? midi === want : mod12(midi) === mod12(want);
    if (ok) {
      this.i++;
      return 'right';
    }
    const last = this.expected[this.i - 1];
    if (last !== undefined && (this.exactOctave ? midi === last : mod12(midi) === mod12(last))) return 'ignored';
    this.wrong++;
    return 'wrong';
  }
}
