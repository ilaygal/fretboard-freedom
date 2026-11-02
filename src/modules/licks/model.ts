import { midiAt, mod12, pitchClassAt, posKey, type FretPos, type ScaleId, type Tuning } from '@/theory';
import type { FretMarker } from '@/components/fretboard';
import { ALL_KEYS_ORDER, LICKS, type LickNote } from '@/content/licks';
import type { SavedLick } from '@/data';
import type { PlacedNote } from '@/domain/licks/licks';

/** The correct answer is always this green. */
export const ANSWER_GREEN = '#34d399';

/** Scales a lick can live in (built-in licks use these; your own licks pick one). */
export const LICK_SCALES: readonly ScaleId[] = ['minorPentatonic', 'majorPentatonic', 'blues', 'major', 'minor', 'dorian', 'mixolydian'];

/** A lick as the screen shows it: built in, or one you made. */
export interface LickView {
  id: string;
  scale: ScaleId;
  notes: readonly LickNote[];
  tags: readonly string[];
  bpm: number;
  level: 1 | 2 | 3;
  /** Set for your own licks (shown by name instead of a translated title). */
  name?: string;
}

function asScale(s: string): ScaleId {
  return (LICK_SCALES as readonly string[]).includes(s) ? (s as ScaleId) : 'minorPentatonic';
}

/** Your own licks first, then the built-in ones. */
export function allLicks(saved: readonly SavedLick[]): LickView[] {
  const mine: LickView[] = saved.map((s) => ({ id: s.id, scale: asScale(s.scale), notes: s.notes, tags: s.tags, bpm: 90, level: 1, name: s.name }));
  return [...mine, ...LICKS];
}

/** Every tag in use, most common first. */
export function lickTags(licks: readonly LickView[]): string[] {
  const count = new Map<string, number>();
  for (const l of licks) for (const t of l.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** "Next key" walks the keys guitarists use most first, then the rest, then wraps. */
export function nextKey(pc: number): number {
  const i = ALL_KEYS_ORDER.indexOf(mod12(pc));
  return ALL_KEYS_ORDER[(i + 1) % ALL_KEYS_ORDER.length]!;
}

export interface LickMarkerState {
  tuning: Tuning;
  tonicPc: number;
  /** The note sounding (Hear it) or expected next (Play it back); -1 for none. */
  active: number;
  /** Notes already played back correctly (shown green). */
  played: number;
}

/**
 * The lick on the neck: each place gets the number of the first note played there that is still
 * to come (so a repeated note shows where you go next). Home notes keep their colour.
 */
export function lickMarkers(placed: readonly PlacedNote[], s: LickMarkerState): FretMarker[] {
  const byPos = new Map<string, { pos: FretPos; indexes: number[] }>();
  placed.forEach((n, i) => {
    if (!n.pos) return;
    const k = posKey(n.pos);
    const e = byPos.get(k) ?? { pos: n.pos, indexes: [] };
    e.indexes.push(i);
    byPos.set(k, e);
  });
  const out: FretMarker[] = [];
  for (const { pos, indexes } of byPos.values()) {
    const upcoming = indexes.find((i) => i >= s.played);
    const shown = upcoming ?? indexes[0]!;
    const isActive = indexes.includes(s.active);
    const allPlayed = upcoming === undefined && s.played > 0;
    const home = pitchClassAt(s.tuning, pos) === mod12(s.tonicPc);
    out.push({
      pos,
      id: `lick-${posKey(pos)}`,
      label: String(isActive ? s.active + 1 : shown + 1),
      role: isActive ? 'target' : home ? 'root' : 'scale',
      color: allPlayed && !isActive ? ANSWER_GREEN : undefined,
      description: `note ${indexes.map((i) => i + 1).join(', ')}, string ${pos.string} fret ${pos.fret}`,
    });
  }
  return out;
}

/**
 * Tapped notes become a lick that works in every key: semitones from the home note at or below the
 * first note. Every note is an eighth, the last one longer.
 */
export function tapsToNotes(tuning: Tuning, taps: readonly FretPos[], tonicPc: number): { st: number; dur: number }[] {
  if (taps.length === 0) return [];
  const midis = taps.map((p) => midiAt(tuning, p));
  const first = midis[0]!;
  const base = first - mod12(first - tonicPc);
  return midis.map((m, i) => ({ st: m - base, dur: i === midis.length - 1 ? 4 : 2 }));
}

/** The pitches to play back, rests left out. */
export function expectedMidis(placed: readonly PlacedNote[]): number[] {
  return placed.flatMap((n) => (n.midi === null ? [] : [n.midi]));
}

/** Index into `placed` of the k-th sounding note (skipping rests). */
export function soundingIndex(placed: readonly PlacedNote[], k: number): number {
  let seen = -1;
  for (let i = 0; i < placed.length; i++) {
    if (placed[i]!.midi !== null) seen++;
    if (seen === k) return i;
  }
  return placed.length;
}
