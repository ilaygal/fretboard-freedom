import { getMaster, getRoom, getTone, unlockAudio } from '../engine';

/**
 * Guitar recordings: one sample per semitone from D2 to E6 (fret 24 on the high string), so a note
 * is never pitch-shifted. Built by scripts/prepare-guitar-samples.sh (source in SOURCE.txt).
 */
const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const LOWEST = 38; // D2
const HIGHEST = 88; // E6

export function sampleFile(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
}

export const SAMPLE_MIDIS: readonly number[] = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => LOWEST + i);

type ToneNS = typeof import('tone');
type Buffers = Record<number, import('tone').ToneAudioBuffer>;

let buffers: Buffers | null = null;
let loading: Promise<Buffers> | null = null;
let loadStarted = 0;
let loadFailed = false;

/** Loads the recordings once; every guitar (yours and the band's) shares them. */
export function loadGuitarBuffers(): Promise<Buffers> | null {
  const tone = getTone();
  if (!tone) return null;
  if (!loading) loadStarted = performance.now();
  loading ??= Promise.all(
    SAMPLE_MIDIS.map((m) =>
      new tone.ToneAudioBuffer().load(`${import.meta.env.BASE_URL}samples/guitar/${sampleFile(m)}`).then((b) => [m, b] as const),
    ),
  ).then((pairs) => {
    buffers = Object.fromEntries(pairs);
    return buffers;
  });
  loading.catch(() => {
    loadFailed = true;
  });
  return loading;
}

/** The loaded recordings, or null while they load. */
export function guitarBuffers(): Buffers | null {
  return buffers;
}

/**
 * A sampler on the shared recordings with a gentle tone: the harsh top end is eased off and a
 * little room is added, like a mic a short way from the guitar.
 */
export function makeGuitarSampler(tone: ToneNS, b: Buffers, out: import('tone').ToneAudioNode, opts: { room?: number; tone?: number } = {}) {
  // The recordings are already warmed (see the prepare script); this only trims what is left up top.
  const shelf = new tone.Filter({ type: 'highshelf', frequency: 5000, gain: -2 });
  const air = new tone.Filter({ type: 'lowpass', frequency: opts.tone ?? 9000, rolloff: -12 });
  // Short release: a note stops like a string being touched; how long it rings is set by its duration.
  const sampler = new tone.Sampler({ urls: b, release: 0.12, attack: 0 });
  sampler.chain(shelf, air, out);
  const room = opts.room === 0 ? null : getRoom();
  if (room) {
    const send = new tone.Gain(opts.room ?? 0.2).connect(room);
    air.connect(send);
  }
  return sampler;
}

let sampler: import('tone').Sampler | null = null;
let soft: import('tone').PolySynth | null = null;
/** Taps made while the recordings are still loading, played when they arrive (if still fresh). */
let waiting: { midi: number; at: number; duration: number; velocity: number }[] = [];

function ensureSampler() {
  const tone = getTone();
  const out = getMaster();
  if (!tone || !out || sampler) return;
  const b = guitarBuffers();
  if (b) {
    sampler = makeGuitarSampler(tone, b, out);
    return;
  }
  void loadGuitarBuffers()?.then(() => {
    ensureSampler();
    const t = getTone();
    if (!t || !sampler) return;
    const now = performance.now();
    for (const w of waiting) if (now - w.at < 600) playGuitarNote(w.midi, { duration: w.duration, velocity: w.velocity });
    waiting = [];
  });
}

/** A soft, round stand-in used only if the recordings are slow to arrive (first visit, slow network). */
function softSynth(tone: ToneNS, out: import('tone').ToneAudioNode) {
  if (!soft) {
    const lp = new tone.Filter({ type: 'lowpass', frequency: 1800, rolloff: -24 }).connect(out);
    soft = new tone.PolySynth(tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.9, sustain: 0.05, release: 0.6 },
    }).connect(lp);
    soft.volume.value = -8;
  }
  return soft;
}

/** Start fetching guitar recordings. Called early so they are ready by the first tap. */
export function preloadGuitar() {
  void loadGuitarBuffers();
}

/** Plays one guitar note now (or at a Tone time). Call from a user gesture the first time. */
export function playGuitarNote(midi: number, opts: { duration?: number; time?: number; velocity?: number } = {}) {
  unlockAudio();
  const tone = getTone();
  const out = getMaster();
  if (!tone || !out) return;
  ensureSampler();
  const duration = opts.duration ?? 2.5;
  // A touch of variation so repeated notes don't sound like a machine.
  const velocity = Math.min(1, (opts.velocity ?? 0.85) * (0.94 + Math.random() * 0.08));
  const freq = tone.Frequency(midi, 'midi').toFrequency();
  const time = opts.time ?? tone.now();
  if (sampler) {
    sampler.triggerAttackRelease(freq, duration, time, velocity);
  } else if (opts.time === undefined && !loadFailed && performance.now() - loadStarted < 5000 && waiting.length < 8) {
    // Wait a moment for the real guitar rather than play a synthetic one.
    waiting.push({ midi, at: performance.now(), duration, velocity });
  } else {
    softSynth(tone, out).triggerAttackRelease(freq, Math.min(duration, 1.2), time, velocity * 0.8);
  }
}

/** Plays several notes as a strum (low to high), e.g. to hear an octave shape. */
export function strum(midis: number[], gapSeconds = 0.04) {
  const tone = getTone();
  if (!tone) return;
  const now = tone.now();
  [...midis].sort((a, b) => a - b).forEach((m, i) => playGuitarNote(m, { time: now + i * gapSeconds }));
}
