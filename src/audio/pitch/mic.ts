import { PitchDetector } from 'pitchy';
import { getTone, setAudioSession } from '../engine';
import { rms, type PitchReading } from './analysis';

export type MicError = 'denied' | 'unsupported' | 'failed';

export interface MicListener {
  stop(): void;
}

/**
 * Opens the microphone and calls `onFrame` about 30 times a second with the detected pitch.
 * Uses an AnalyserNode and the McLeod pitch method (pitchy), which works on iOS Safari.
 */
export async function listenToMic(onFrame: (r: PitchReading) => void): Promise<MicListener> {
  if (!navigator.mediaDevices?.getUserMedia) throw new MicErrorImpl('unsupported');
  setAudioSession('play-and-record');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Raw signal: voice processing would filter out a guitar.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    setAudioSession('playback');
    const name = (e as DOMException).name;
    throw new MicErrorImpl(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
  }
  const tone = getTone();
  const ctx: AudioContext = tone ? (tone.getContext().rawContext as AudioContext) : new AudioContext();
  if (ctx.state !== 'running') await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096; // ~85 ms at 48 kHz: enough periods of low E
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -60;

  let running = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    if (!running) return;
    analyser.getFloatTimeDomainData(buf);
    const [frequency, clarity] = detector.findPitch(buf, ctx.sampleRate);
    onFrame({ frequency, clarity, volume: rms(buf) });
    timer = setTimeout(tick, 33);
  };
  tick();

  return {
    stop() {
      running = false;
      clearTimeout(timer);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      setAudioSession('playback');
    },
  };
}

class MicErrorImpl extends Error {
  constructor(readonly kind: MicError) {
    super(kind);
  }
}

export function micErrorKind(e: unknown): MicError {
  return e instanceof MicErrorImpl ? e.kind : 'failed';
}
