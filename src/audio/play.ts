import { getTone, unlockAudio } from './engine';
import { playGuitarNote } from './instruments/guitar';
import { phraseVoices, type PhraseNote } from './phrasing';

/** Tap-to-hear entry point used across the app. */
export function playMidi(midi: number): void {
  playGuitarNote(midi);
}

/**
 * Plays a phrase like a guitarist would (see `phraseVoices`): notes (null = rest) with durations in
 * sixteenths at a tempo, ringing over each other on different strings. `onNote` fires in time with
 * each note (for highlighting). Returns a function that stops it.
 */
export function playPhrase(notes: readonly PhraseNote[], bpm: number, onNote?: (index: number) => void): () => void {
  unlockAudio();
  const tone = getTone();
  if (!tone) return () => {};
  const sixteenth = 60 / bpm / 4;
  const start = tone.now() + 0.05;
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const v of phraseVoices(notes, bpm)) {
    playGuitarNote(v.midi, { time: start + v.time, duration: v.ring, velocity: v.velocity });
  }
  if (onNote) {
    let t = 0;
    notes.forEach((n, i) => {
      timers.push(setTimeout(() => onNote(i), (0.05 + t) * 1000));
      t += n.dur * sixteenth;
    });
    timers.push(setTimeout(() => onNote(-1), (0.05 + t) * 1000));
  }
  return () => timers.forEach(clearTimeout);
}
