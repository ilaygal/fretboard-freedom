import { playGuitarNote } from './instruments/guitar';

/** Tap-to-hear entry point used across the app. */
export function playMidi(midi: number): void {
  playGuitarNote(midi);
}
