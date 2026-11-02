import { getMaster, getTone } from './engine';

export interface ActiveRecording {
  /** Stops and returns the audio. */
  stop(): Promise<{ blob: Blob; mime: string; seconds: number }>;
}

/** Whether this browser can record (MediaRecorder; Safari 14.1+). */
export function canRecord(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

function pickMime(): string {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

/**
 * Records what you hear (the band and app sounds) plus, if given, the microphone, into one track.
 * Nothing is sent anywhere; the result stays on the device.
 */
export function startRecording(mic: AudioNode | null): ActiveRecording {
  const tone = getTone();
  const master = getMaster();
  if (!tone || !master || !canRecord()) throw new Error('Recording is not available');
  const ctx = tone.getContext().rawContext as AudioContext;
  const dest = ctx.createMediaStreamDestination();
  master.connect(dest);
  mic?.connect(dest);
  const mime = pickMime();
  const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const started = performance.now();
  rec.start(1000);
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          master.disconnect(dest);
          try {
            mic?.disconnect(dest);
          } catch {
            /* already gone */
          }
          const type = rec.mimeType || mime || 'audio/webm';
          resolve({ blob: new Blob(chunks, { type }), mime: type, seconds: (performance.now() - started) / 1000 });
        };
        rec.stop();
      }),
  };
}
