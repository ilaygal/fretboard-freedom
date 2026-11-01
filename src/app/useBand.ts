import { useCallback, useEffect, useRef, useState } from 'react';
import { backing, type BackingTrack, type Mix, type Position } from '@/audio/backing/player';

/**
 * Drives the backing band from a screen: play/stop, the current bar and beat, Space to toggle.
 * A new track restarts the band from bar 1; a new tempo just changes speed. Leaving the screen stops it.
 */
export function useBand(track: BackingTrack, bpm: number, mix: Mix) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState<Position>({ bar: 0, beat: 0 });

  useEffect(() => backing.onPosition(setPos), []);
  useEffect(() => () => backing.stop(), []);

  const lastTrack = useRef(track);
  useEffect(() => {
    if (lastTrack.current === track) return;
    lastTrack.current = track;
    setPos({ bar: 0, beat: 0 });
    if (backing.playing) backing.play(track, bpm);
  }, [track, bpm]);
  useEffect(() => {
    if (backing.playing) backing.setTempo(bpm);
  }, [bpm]);
  useEffect(() => backing.setMix(mix), [mix]);

  const toggle = useCallback(() => {
    if (backing.playing) {
      backing.stop();
      setPlaying(false);
      setPos({ bar: 0, beat: 0 });
    } else {
      backing.setMix(mix);
      backing.play(track, bpm);
      setPlaying(true);
    }
  }, [track, bpm, mix]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { playing, pos, toggle };
}
