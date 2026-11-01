import { frequencyToMidi, midiToName, type AccidentalPreference } from '@/theory';

export interface PitchReading {
  frequency: number;
  /** 0..1, how periodic the signal is (pitchy's clarity). */
  clarity: number;
  /** RMS level of the frame, 0..1. */
  volume: number;
}

export interface NoteReading {
  midi: number;
  /** Deviation from the nearest equal-tempered note, -50..50. */
  cents: number;
  name: string;
}

/** Nearest note to a frequency and how far off it is. */
export function noteFromFrequency(freq: number, pref: AccidentalPreference = 'sharps', a4 = 440): NoteReading {
  const exact = frequencyToMidi(freq, a4);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 100), name: midiToName(midi, pref) };
}

export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / buf.length);
}

/** Guitar range with some headroom: drop D low string (~73 Hz) up to fret 24 on string 1 (~1319 Hz). */
export const GUITAR_MIN_HZ = 60;
export const GUITAR_MAX_HZ = 1400;

export interface StabilizerOptions {
  minClarity: number;
  minVolume: number;
  /** Frames the same note must be heard before it counts as played. */
  holdFrames: number;
  /** Max cents a frame may wander from the note and still count as the same note. */
  toleranceCents: number;
}

export const DEFAULT_STABILIZER: StabilizerOptions = { minClarity: 0.9, minVolume: 0.01, holdFrames: 4, toleranceCents: 40 };

/**
 * Turns a stream of noisy pitch frames into "note played" events: a note must be clear, loud enough
 * and steady for a few frames, and is reported once until silence or a different note.
 */
export class PitchStabilizer {
  private candidate: number | null = null;
  private count = 0;
  private reported: number | null = null;

  constructor(private readonly opts: StabilizerOptions = DEFAULT_STABILIZER) {}

  /** Feed one frame; returns a MIDI note when a new stable note is detected. */
  push(r: PitchReading): number | null {
    const valid =
      r.clarity >= this.opts.minClarity &&
      r.volume >= this.opts.minVolume &&
      r.frequency >= GUITAR_MIN_HZ &&
      r.frequency <= GUITAR_MAX_HZ;
    if (!valid) {
      this.candidate = null;
      this.count = 0;
      if (r.volume < this.opts.minVolume) this.reported = null; // silence: the same note may be played again
      return null;
    }
    const exact = frequencyToMidi(r.frequency);
    const midi = Math.round(exact);
    if (Math.abs(exact - midi) * 100 > this.opts.toleranceCents) return null;
    if (midi === this.candidate) this.count++;
    else {
      this.candidate = midi;
      this.count = 1;
    }
    if (this.count >= this.opts.holdFrames && this.reported !== midi) {
      this.reported = midi;
      return midi;
    }
    return null;
  }

  reset() {
    this.candidate = null;
    this.count = 0;
    this.reported = null;
  }
}
