/** What kind of click a metronome tick is. */
export type ClickKind = 'bar' | 'beat' | 'sub';

/** The clicks in one bar: the first beat accented, other beats normal, subdivisions quiet. */
export function clickPattern(beatsPerBar: number, subdivision: number, accentFirst = true): ClickKind[] {
  if (beatsPerBar < 1 || subdivision < 1) throw new Error('Need at least one beat and one subdivision');
  const out: ClickKind[] = [];
  for (let b = 0; b < beatsPerBar; b++) {
    for (let s = 0; s < subdivision; s++) {
      out.push(s > 0 ? 'sub' : b === 0 && accentFirst ? 'bar' : 'beat');
    }
  }
  return out;
}

export const MIN_BPM = 30;
export const MAX_BPM = 260;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Tempo from the last few taps (tap tempo). Ignores taps after a long pause. */
export function tapTempo(tapTimesMs: number[]): number | null {
  const recent: number[] = [];
  for (let i = tapTimesMs.length - 1; i >= 0; i--) {
    const t = tapTimesMs[i]!;
    if (recent.length && recent[0]! - t > 2000) break;
    recent.unshift(t);
    if (recent.length === 6) break;
  }
  if (recent.length < 3) return null;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]!);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return clampBpm(60000 / avg);
}

/**
 * Estimates audio + touch latency from a tap-along: the median of (tap time - nearest click time).
 * Outliers (more than half a beat off) are ignored. Returns null if there are too few usable taps.
 */
export function estimateLatencyMs(clickTimesMs: number[], tapTimesMs: number[], beatMs: number): number | null {
  if (clickTimesMs.length === 0) return null;
  const offsets: number[] = [];
  for (const tap of tapTimesMs) {
    let best = Infinity;
    for (const c of clickTimesMs) if (Math.abs(tap - c) < Math.abs(best)) best = tap - c;
    if (Math.abs(best) <= beatMs / 2) offsets.push(best);
  }
  if (offsets.length < 4) return null;
  offsets.sort((a, b) => a - b);
  const mid = Math.floor(offsets.length / 2);
  const median = offsets.length % 2 ? offsets[mid]! : (offsets[mid - 1]! + offsets[mid]!) / 2;
  return Math.round(median);
}
