/** Progressive levels for "Know every note": string by string, then region by region. */
export interface NoteFinderLevel {
  id: string;
  /** Strings in play (1 = high E). Empty = all strings. */
  strings: number[];
  from: number;
  /** Highest fret; capped at the player's fret count. Use 99 for "the whole neck". */
  to: number;
  /** Only the natural notes (no sharps/flats), the gentler start. */
  naturalsOnly: boolean;
}

export const NOTE_FINDER_LEVELS: readonly NoteFinderLevel[] = [
  { id: 'lowE', strings: [6], from: 0, to: 12, naturalsOnly: true },
  { id: 'aString', strings: [5], from: 0, to: 12, naturalsOnly: true },
  { id: 'lowTwo', strings: [6, 5], from: 0, to: 12, naturalsOnly: false },
  { id: 'dString', strings: [4], from: 0, to: 12, naturalsOnly: true },
  { id: 'gString', strings: [3], from: 0, to: 12, naturalsOnly: true },
  { id: 'bString', strings: [2], from: 0, to: 12, naturalsOnly: true },
  { id: 'highE', strings: [1], from: 0, to: 12, naturalsOnly: true },
  { id: 'open', strings: [], from: 0, to: 5, naturalsOnly: false },
  { id: 'middle', strings: [], from: 5, to: 9, naturalsOnly: false },
  { id: 'upTo12', strings: [], from: 7, to: 12, naturalsOnly: false },
  { id: 'above12', strings: [], from: 12, to: 17, naturalsOnly: false },
  { id: 'wholeNeck', strings: [], from: 0, to: 99, naturalsOnly: false },
];

/** Accuracy over the last attempts needed before the next level is suggested. */
export const LEVEL_PASS_ACCURACY = 0.85;
export const LEVEL_PASS_MIN_ATTEMPTS = 20;
