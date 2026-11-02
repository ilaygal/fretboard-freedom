/**
 * How a guitarist's single-note line sounds, as opposed to a keyboard's: a note keeps ringing until
 * its own string is played again (or the hand moves on), notes on the same string close together are
 * slurred (hammer-ons, pull-offs, slides: softer, no new pick attack), and timing and touch vary a little.
 * Pure, so it is unit-tested; `playPhrase` turns the result into sound.
 */
export interface PhraseNote {
  midi: number | null;
  /** Length in sixteenth notes. */
  dur: number;
  /** Where it is played, when known (string 1 = high E). */
  pos?: { string: number; fret: number } | null;
}

export interface Voice {
  index: number;
  midi: number;
  /** Seconds from the phrase start. */
  time: number;
  /** How long it rings, in seconds. */
  ring: number;
  velocity: number;
  slur: boolean;
}

/** Longest a note may ring past its written length when nothing stops it. */
const LET_RING = 1.6;

export function phraseVoices(notes: readonly PhraseNote[], bpm: number, rng: () => number = Math.random): Voice[] {
  const sixteenth = 60 / bpm / 4;
  const starts: number[] = [];
  let t = 0;
  for (const n of notes) {
    starts.push(t);
    t += n.dur * sixteenth;
  }
  const end = t;
  const voices: Voice[] = [];
  let prev: { pos?: PhraseNote['pos']; midi: number; start: number; dur: number } | null = null;
  notes.forEach((n, i) => {
    if (n.midi === null) {
      prev = null;
      return;
    }
    const start = starts[i]!;
    const written = n.dur * sixteenth;
    // Rings until the same string sounds again; without string info, until the next note plus a short overlap.
    let stop = Math.min(end + LET_RING, start + written + LET_RING);
    for (let j = i + 1; j < notes.length; j++) {
      const m = notes[j]!;
      if (m.midi === null) continue;
      const sameString = n.pos && m.pos ? n.pos.string === m.pos.string : true;
      if (sameString) {
        stop = Math.min(stop, starts[j]! + (n.pos && m.pos ? 0.02 : 0.12));
        break;
      }
    }
    const slur =
      prev !== null &&
      !!prev.pos &&
      !!n.pos &&
      prev.pos.string === n.pos.string &&
      Math.abs(prev.pos.fret - n.pos.fret) <= 2 &&
      prev.midi !== n.midi &&
      start - prev.start <= sixteenth * 2.01;
    // On the beat a little stronger; the rest varies a little.
    const onBeat = Math.abs(start / (sixteenth * 4) - Math.round(start / (sixteenth * 4))) < 0.01;
    const touch = 0.9 + rng() * 0.1;
    const velocity = Math.min(1, (slur ? 0.55 : onBeat ? 0.88 : 0.78) * touch);
    const jitter = i === 0 ? 0 : (rng() - 0.5) * 0.014;
    voices.push({ index: i, midi: n.midi, time: Math.max(0, start + jitter), ring: Math.max(0.12, stop - start), velocity, slur });
    prev = { pos: n.pos, midi: n.midi, start, dur: n.dur };
  });
  return voices;
}
