/**
 * The app's single audio engine. Tone.js is loaded in the background at startup so that
 * the first tap can start audio synchronously, which iOS Safari requires.
 */
type ToneModule = typeof import('tone');

let tone: ToneModule | null = null;
let loading: Promise<ToneModule> | null = null;
let master: import('tone').Volume | null = null;

/** Start loading the audio library. Safe to call many times. */
export function preloadAudio(): Promise<ToneModule> {
  loading ??= import('tone').then((m) => {
    tone = m;
    return m;
  });
  return loading;
}

/** The loaded Tone module, or null if it is still loading. */
export function getTone(): ToneModule | null {
  return tone;
}

/** Shared output bus, so everything can be muted or levelled in one place. */
export function getMaster(): import('tone').Volume | null {
  if (!tone) return null;
  master ??= new tone.Volume(-4).toDestination();
  return master;
}

/**
 * iOS mutes Web Audio when the ring/silent switch is on, unless the page asks for "playback".
 * Safari 16.4+ supports navigator.audioSession.
 */
export function setAudioSession(type: 'playback' | 'play-and-record') {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = type;
    } catch {
      /* not supported */
    }
  }
}

let sessionSet = false;

/** Must be called from inside a user gesture (tap/click/key). */
export function unlockAudio(): void {
  if (!sessionSet) {
    setAudioSession('playback');
    sessionSet = true;
  }
  if (!tone) {
    void preloadAudio();
    return;
  }
  if (tone.getContext().state !== 'running') void tone.start();
}

export function isAudioReady(): boolean {
  return tone !== null && tone.getContext().state === 'running';
}
