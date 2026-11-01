import type { FretPos, FretRange } from '@/theory';

export type Orientation = 'horizontal' | 'vertical';

export interface LayoutInput {
  stringCount: number;
  range: FretRange;
  orientation: Orientation;
  leftHanded: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FretboardLayout {
  width: number;
  height: number;
  /** Where a note dot sits. */
  note(pos: FretPos): Point;
  /** The tappable rectangle around a note position. */
  cell(pos: FretPos): { x: number; y: number; width: number; height: number };
  /** The line for string n (1 = highest pitch). */
  string(n: number): Segment;
  /** Fret wires shown, including the nut (fret 0) when the range starts at the open position. */
  frets: { fret: number; line: Segment; isNut: boolean }[];
  inlays: { fret: number; points: Point[] }[];
  fretNumbers: { fret: number; at: Point }[];
  noteRadius: number;
  /** The wood: the area between the outer strings over the shown frets. */
  board: { x: number; y: number; width: number; height: number };
}

// Internal units: the SVG viewBox scales them to the screen.
const SLOT = 64; // width of fret 1's slot along the neck
const OPEN_SLOT = 44; // room for open-string notes before the nut
const SPACING = 40; // distance between strings
const PAD_ALONG = 12;
const PAD_ACROSS = 44; // room for fret numbers on one side
const PAD_ACROSS_OTHER = 24;

/**
 * Fret slots narrow up the neck like a real guitar, but only half as fast,
 * so high frets stay big enough to tap on a phone.
 */
export function slotWidth(fret: number): number {
  return SLOT * 2 ** (-fret / 24);
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

export function computeLayout(input: LayoutInput): FretboardLayout {
  const { stringCount, range, orientation, leftHanded } = input;
  if (range.to < range.from) throw new Error('Fret range is reversed');
  const hasOpen = range.from === 0;
  const firstFretted = Math.max(1, range.from);

  // Along-neck positions (a = 0 at the nut side of the drawing).
  const wireAt = new Map<number, number>(); // fret wire n sits at the far edge of slot n
  let a = PAD_ALONG + (hasOpen ? OPEN_SLOT : 0);
  wireAt.set(firstFretted - 1, a);
  const slotCentre = new Map<number, number>();
  if (hasOpen) slotCentre.set(0, PAD_ALONG + OPEN_SLOT / 2);
  for (let f = firstFretted; f <= range.to; f++) {
    const w = slotWidth(f);
    slotCentre.set(f, a + w / 2);
    a += w;
    wireAt.set(f, a);
  }
  const alongLength = a + PAD_ALONG;
  const acrossLength = PAD_ACROSS + PAD_ACROSS_OTHER + SPACING * (stringCount - 1);

  // Across: c = position of string; string 1 nearest the "top".
  const stringC = (n: number) => PAD_ACROSS_OTHER + SPACING * (n - 1);

  const map = (along: number, across: number): Point => {
    if (orientation === 'horizontal') {
      return { x: leftHanded ? alongLength - along : along, y: across };
    }
    // Vertical: headstock at the top. Right-handed: low string on the left, like a chord chart.
    return { x: leftHanded ? across : acrossLength - across, y: along };
  };
  const width = orientation === 'horizontal' ? alongLength : acrossLength;
  const height = orientation === 'horizontal' ? acrossLength : alongLength;

  const seg = (a1: number, c1: number, a2: number, c2: number): Segment => {
    const p = map(a1, c1);
    const q = map(a2, c2);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  };

  const firstC = stringC(1);
  const lastC = stringC(stringCount);
  const startA = wireAt.get(firstFretted - 1)!;
  const endA = wireAt.get(range.to) ?? startA;

  const frets = [...wireAt.entries()].map(([fret, at]) => ({
    fret,
    line: seg(at, firstC, at, lastC),
    isNut: fret === 0,
  }));

  const midC = (firstC + lastC) / 2;
  const inlays = INLAY_FRETS.filter((f) => f >= firstFretted && f <= range.to).map((f) => {
    const at = slotCentre.get(f)!;
    const points =
      f % 12 === 0
        ? [map(at, stringC(Math.ceil(stringCount / 2) - 1) + SPACING / 2), map(at, stringC(Math.ceil(stringCount / 2) + 1) + SPACING / 2)]
        : [map(at, midC)];
    return { fret: f, points };
  });

  const numberC = lastC + SPACING / 2 + 14;
  const fretNumbers = [...slotCentre.keys()]
    .filter((f) => f > 0)
    .map((f) => ({ fret: f, at: map(slotCentre.get(f)!, numberC) }));

  const b1 = map(startA, firstC - SPACING / 2);
  const b2 = map(endA, lastC + SPACING / 2);
  const board = {
    x: Math.min(b1.x, b2.x),
    y: Math.min(b1.y, b2.y),
    width: Math.abs(b2.x - b1.x),
    height: Math.abs(b2.y - b1.y),
  };

  const slotOf = (fret: number) => (fret === 0 ? OPEN_SLOT : slotWidth(fret));

  return {
    width,
    height,
    noteRadius: 14,
    board,
    note: (pos) => {
      const at = slotCentre.get(pos.fret);
      if (at === undefined) throw new Error(`Fret ${pos.fret} is outside the shown range`);
      return map(at, stringC(pos.string));
    },
    cell: (pos) => {
      const at = slotCentre.get(pos.fret);
      if (at === undefined) throw new Error(`Fret ${pos.fret} is outside the shown range`);
      const w = slotOf(pos.fret);
      const centre = map(at, stringC(pos.string));
      const along = w;
      const across = SPACING;
      return orientation === 'horizontal'
        ? { x: centre.x - along / 2, y: centre.y - across / 2, width: along, height: across }
        : { x: centre.x - across / 2, y: centre.y - along / 2, width: across, height: along };
    },
    string: (n) => seg(hasOpen ? PAD_ALONG : startA, stringC(n), endA, stringC(n)),
    frets,
    inlays,
    fretNumbers,
  };
}
