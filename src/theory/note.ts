import { Note } from 'tonal';

/** Pitch class as a number 0..11, where C = 0. */
export type PitchClass = number;

/** How to name notes when there is no key context. */
export type AccidentalPreference = 'sharps' | 'flats';

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Parses a note name ("C#", "Eb4", "Fb") into its pitch class. Throws on invalid input. */
export function pitchClassOf(name: string): PitchClass {
  const note = Note.get(name);
  if (note.empty) throw new Error(`Invalid note name: ${name}`);
  return note.chroma;
}

export function isValidNoteName(name: string): boolean {
  return !Note.get(name).empty;
}

/** Name of a pitch class with no key context. */
export function pitchClassName(pc: PitchClass, pref: AccidentalPreference): string {
  const names = pref === 'flats' ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(pc)]!;
}

/** Scientific octave of a MIDI number (MIDI 60 = C4). */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** MIDI number to a note name with octave, e.g. 61 -> "C#4" or "Db4". */
export function midiToName(midi: number, pref: AccidentalPreference): string {
  return `${pitchClassName(midi, pref)}${octaveOf(midi)}`;
}

/** Note name with octave to MIDI. Throws on invalid input or a missing octave. */
export function nameToMidi(name: string): number {
  const note = Note.get(name);
  if (note.empty || note.midi === null || note.midi === undefined) {
    throw new Error(`Not a note with an octave: ${name}`);
  }
  return note.midi;
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Fractional MIDI number for a frequency (used by the tuner and pitch detection). */
export function frequencyToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Removes double accidentals and rare spellings (Cb, Fb, E#, B#) unless strict spelling is wanted. */
export function simplifyName(name: string): string {
  const pc = Note.get(name);
  if (pc.empty) throw new Error(`Invalid note name: ${name}`);
  const rare = ['Cb', 'Fb', 'E#', 'B#'];
  if (Math.abs(pc.alt) > 1 || rare.includes(pc.pc)) {
    const simplified = Note.simplify(pc.pc);
    // Note.simplify keeps rare names like Cb; map those through enharmonic.
    return rare.includes(simplified) ? Note.enharmonic(simplified) : simplified;
  }
  return pc.pc;
}

const FIXED_DO: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

/** Fixed-do solfège name (Do = C), keeping the accidental: "F#" -> "Fa♯". */
export function toFixedDo(name: string): string {
  const note = Note.get(name);
  if (note.empty) throw new Error(`Invalid note name: ${name}`);
  return `${FIXED_DO[note.letter]}${prettyAccidental(note.acc)}`;
}

/** Display form with real music symbols: "Bb" -> "B♭", "F##" -> "F𝄪". */
export function prettyNote(name: string): string {
  const note = Note.get(name);
  if (note.empty) return name;
  return `${note.letter}${prettyAccidental(note.acc)}`;
}

function prettyAccidental(acc: string): string {
  if (acc === '##') return '𝄪';
  if (acc === 'bb') return '𝄫';
  return acc.replace(/#/g, '♯').replace(/b/g, '♭');
}
