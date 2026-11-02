import { useCallback, useEffect, useRef, useState } from 'react';
import { listenToMic, micErrorKind, type MicError, type MicListener } from '@/audio/pitch/mic';
import type { PitchReading } from '@/audio/pitch/analysis';

/**
 * Microphone as a React hook. `start()` must be called from a tap (iOS asks for permission then).
 * Frames go to `onFrame`, which may change between renders.
 */
export function useMic(onFrame: (r: PitchReading) => void) {
  const handler = useRef(onFrame);
  handler.current = onFrame;
  const listener = useRef<MicListener | null>(null);
  const [state, setState] = useState<'off' | 'starting' | 'on'>('off');
  const [error, setError] = useState<MicError | null>(null);

  const start = useCallback(async () => {
    if (listener.current) return;
    setState('starting');
    setError(null);
    try {
      listener.current = await listenToMic((r) => handler.current(r));
      setState('on');
    } catch (e) {
      setError(micErrorKind(e));
      setState('off');
    }
  }, []);

  const stop = useCallback(() => {
    listener.current?.stop();
    listener.current = null;
    setState('off');
  }, []);

  useEffect(() => () => listener.current?.stop(), []);
  /** The live mic node (for recording), or null when off. */
  const source = () => listener.current?.source ?? null;
  return { state, error, start, stop, source };
}
