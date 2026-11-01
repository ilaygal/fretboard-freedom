/**
 * The app's single audio engine. Tone.js is loaded in the background at startup so that
 * the first tap can start audio synchronously, which iOS Safari requires.
 */
type ToneModule = typeof import('tone');

let tone: ToneModule | null = null;
let loading: Promise<ToneModule> | null = null;
let voices: import('tone').PluckSynth[] = [];
let nextVoice = 0;
const VOICES = 6;

/** Start loading the audio library. Safe to call many times. */
export function preloadAudio(): Promise<ToneModule> {
  loading ??= import('tone').then((m) => {
    tone = m;
    return m;
  });
  return loading;
}

/**
 * iOS mutes Web Audio when the ring/silent switch is on, unless the page asks for "playback".
 * Safari 16.4+ supports navigator.audioSession.
 */
function preferPlaybackSession() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
  }
}

/** Must be called from inside a user gesture (tap/click/key). */
export function unlockAudio(): void {
  preferPlaybackSession();
  if (!tone) {
    void preloadAudio();
    return;
  }
  if (tone.getContext().state !== 'running') void tone.start();
}

export function isAudioReady(): boolean {
  return tone !== null && tone.getContext().state === 'running';
}

function voice(): import('tone').PluckSynth | null {
  if (!tone) return null;
  if (voices.length === 0) {
    const out = new tone.Volume(-6).toDestination();
    voices = Array.from({ length: VOICES }, () =>
      new tone!.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.96 }).connect(out),
    );
  }
  const v = voices[nextVoice % VOICES]!;
  nextVoice++;
  return v;
}

/** Plays one plucked note now. Call from a user gesture the first time. */
export function playMidi(midi: number): void {
  unlockAudio();
  const v = voice();
  if (!tone || !v) return;
  v.triggerAttack(tone.Frequency(midi, 'midi').toFrequency(), tone.now());
}
