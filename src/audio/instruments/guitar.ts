import { getMaster, getTone, unlockAudio } from '../engine';

/** Sampled notes, every minor third from E2 to C#5; Tone.Sampler fills the gaps by repitching. */
const SAMPLE_NOTES = ['E2', 'G2', 'A#2', 'C#3', 'E3', 'G3', 'A#3', 'C#4', 'E4', 'G4', 'A#4', 'C#5'];

function fileName(note: string) {
  return `${note.replace('#', 's')}.mp3`;
}

let sampler: import('tone').Sampler | null = null;
let samplerLoaded = false;
let plucks: import('tone').PluckSynth[] = [];
let nextPluck = 0;

function ensureSampler() {
  const tone = getTone();
  const out = getMaster();
  if (!tone || !out || sampler) return;
  sampler = new tone.Sampler({
    urls: Object.fromEntries(SAMPLE_NOTES.map((n) => [n, fileName(n)])),
    baseUrl: `${import.meta.env.BASE_URL}samples/guitar-acoustic/`,
    release: 1.2,
    onload: () => {
      samplerLoaded = true;
    },
  }).connect(out);
}

/** Synth fallback while samples load (or if they fail offline before first cache). */
function pluck() {
  const tone = getTone();
  const out = getMaster();
  if (!tone || !out) return null;
  if (plucks.length === 0) {
    plucks = Array.from({ length: 6 }, () => new tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.96 }).connect(out));
  }
  return plucks[nextPluck++ % plucks.length]!;
}

/** Start fetching guitar samples. Called early so they are ready by the first tap. */
export function preloadGuitar() {
  ensureSampler();
}

/** Plays one guitar note now (or at a Tone time). Call from a user gesture the first time. */
export function playGuitarNote(midi: number, opts: { duration?: number; time?: number; velocity?: number } = {}) {
  unlockAudio();
  const tone = getTone();
  if (!tone) return;
  ensureSampler();
  const freq = tone.Frequency(midi, 'midi').toFrequency();
  const time = opts.time ?? tone.now();
  if (sampler && samplerLoaded) {
    sampler.triggerAttackRelease(freq, opts.duration ?? 1.5, time, opts.velocity ?? 0.9);
  } else {
    pluck()?.triggerAttack(freq, time);
  }
}

/** Plays several notes as a strum (low to high), e.g. to hear an octave shape. */
export function strum(midis: number[], gapSeconds = 0.04) {
  const tone = getTone();
  if (!tone) return;
  const now = tone.now();
  [...midis].sort((a, b) => a - b).forEach((m, i) => playGuitarNote(m, { time: now + i * gapSeconds }));
}
