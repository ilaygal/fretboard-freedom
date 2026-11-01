import { nameToMidi, midiToName } from './note';

export interface Tuning {
  id: string;
  name: string;
  /** Open-string MIDI numbers from the lowest-pitched string to the highest (E2 A2 D3 G3 B3 E4). */
  lowToHigh: number[];
}

function fromNames(id: string, name: string, notes: string): Tuning {
  return { id, name, lowToHigh: notes.split(/\s+/).map(nameToMidi) };
}

export const TUNINGS: readonly Tuning[] = [
  fromNames('standard', 'Standard (E A D G B E)', 'E2 A2 D3 G3 B3 E4'),
  fromNames('dropD', 'Drop D (D A D G B E)', 'D2 A2 D3 G3 B3 E4'),
  fromNames('eb', 'Half step down (Eb Ab Db Gb Bb Eb)', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4'),
  fromNames('dStandard', 'Whole step down (D G C F A D)', 'D2 G2 C3 F3 A3 D4'),
  fromNames('openG', 'Open G (D G D G B D)', 'D2 G2 D3 G3 B3 D4'),
  fromNames('dadgad', 'DADGAD', 'D2 A2 D3 G3 A3 D4'),
];

export const STANDARD_TUNING: Tuning = TUNINGS[0]!;

export function getTuning(id: string, custom?: Tuning): Tuning {
  if (custom && custom.id === id) return custom;
  return TUNINGS.find((t) => t.id === id) ?? STANDARD_TUNING;
}

/** Builds a custom tuning from text like "D2 A2 D3 G3 B3 E4". Throws on bad input. */
export function parseTuning(text: string, name = 'Custom'): Tuning {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 4 || parts.length > 8) throw new Error('A tuning needs 4 to 8 strings');
  const lowToHigh = parts.map(nameToMidi);
  return { id: 'custom', name, lowToHigh };
}

export function stringCount(t: Tuning): number {
  return t.lowToHigh.length;
}

/**
 * Open MIDI note of a string. Strings are numbered the guitarist's way:
 * string 1 is the highest-pitched (thin E), string 6 the lowest (thick E).
 */
export function openMidi(t: Tuning, stringNumber: number): number {
  const n = stringCount(t);
  if (stringNumber < 1 || stringNumber > n) throw new Error(`No string ${stringNumber} in a ${n}-string tuning`);
  return t.lowToHigh[n - stringNumber]!;
}

export function describeTuning(t: Tuning): string {
  return t.lowToHigh.map((m) => midiToName(m, 'flats').replace(/\d+$/, '')).join(' ');
}
