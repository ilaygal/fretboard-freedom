import { getTone, unlockAudio } from './engine';
import { playGuitarNote } from './instruments/guitar';

/** Tap-to-hear entry point used across the app. */
export function playMidi(midi: number): void {
  playGuitarNote(midi);
}

/**
 * Plays a phrase: notes (null = rest) with durations in sixteenths at a tempo.
 * `onNote` fires in time with each note (for highlighting). Returns a function that stops it.
 */
export function playPhrase(
  notes: readonly { midi: number | null; dur: number }[],
  bpm: number,
  onNote?: (index: number) => void,
): () => void {
  unlockAudio();
  const tone = getTone();
  if (!tone) return () => {};
  const sixteenth = 60 / bpm / 4;
  const start = tone.now() + 0.05;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  notes.forEach((n, i) => {
    if (n.midi !== null) playGuitarNote(n.midi, { time: start + t, duration: Math.max(0.15, n.dur * sixteenth * 1.1) });
    if (onNote) timers.push(setTimeout(() => onNote(i), (0.05 + t) * 1000));
    t += n.dur * sixteenth;
  });
  if (onNote) timers.push(setTimeout(() => onNote(-1), (0.05 + t) * 1000));
  return () => timers.forEach(clearTimeout);
}
