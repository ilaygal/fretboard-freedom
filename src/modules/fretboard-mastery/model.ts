import {
  allPositions,
  midiAt,
  mod12,
  pitchClassAt,
  pitchClassName,
  posKey,
  stringCount,
  type FretPos,
  type FretRange,
  type Tuning,
} from '@/theory';
import type { Attempt } from '@/data';
import { LEVEL_PASS_ACCURACY, LEVEL_PASS_MIN_ATTEMPTS, NOTE_FINDER_LEVELS, type NoteFinderLevel } from '@/content/noteFinderLevels';

export type NoteDrillMode = 'name' | 'find' | 'findAll' | 'play';

export const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export interface LevelRegion {
  strings: number[];
  range: FretRange;
  pcs: number[];
}

/** The concrete strings, frets and notes of a level on this player's guitar. */
export function levelRegion(level: NoteFinderLevel, tuning: Tuning, fretCount: number): LevelRegion {
  const all = Array.from({ length: stringCount(tuning) }, (_, i) => i + 1);
  const strings = level.strings.length ? level.strings.filter((s) => s <= all.length) : all;
  const to = Math.min(level.to, fretCount);
  const from = Math.min(level.from, to);
  return { strings, range: { from, to }, pcs: level.naturalsOnly ? NATURALS : [...Array(12).keys()] };
}

export function regionPositions(region: LevelRegion, tuning: Tuning): FretPos[] {
  return allPositions(tuning, region.range).filter(
    (p) => region.strings.includes(p.string) && region.pcs.includes(pitchClassAt(tuning, p)),
  );
}

/** Spaced-repetition items each mode practises. */
export function itemsFor(mode: NoteDrillMode, region: LevelRegion, tuning: Tuning): string[] {
  const positions = regionPositions(region, tuning);
  if (mode === 'name') return positions.map((p) => `pos:${posKey(p)}`);
  if (mode === 'findAll') return [...new Set(positions.map((p) => pitchClassAt(tuning, p)))].map((pc) => `all:${pc}`);
  const keys = new Set(positions.map((p) => `note:${pitchClassAt(tuning, p)}@s${p.string}`));
  return [...keys];
}

export interface Question {
  mode: NoteDrillMode;
  itemKey: string;
  /** The note asked about (pitch class). */
  pc: number;
  /** For "name": the position shown. */
  shown?: FretPos;
  /** For "find"/"play": the string asked for. */
  string?: number;
  /** Every correct position within the level. */
  targets: FretPos[];
  expectedMs: number;
}

export function questionFor(mode: NoteDrillMode, itemKey: string, region: LevelRegion, tuning: Tuning): Question {
  const positions = regionPositions(region, tuning);
  if (itemKey.startsWith('pos:')) {
    const [s, f] = itemKey.slice(4).split(':').map(Number);
    const shown = { string: s!, fret: f! };
    return { mode, itemKey, pc: pitchClassAt(tuning, shown), shown, targets: [shown], expectedMs: 4000 };
  }
  if (itemKey.startsWith('all:')) {
    const pc = Number(itemKey.slice(4));
    const targets = positions.filter((p) => pitchClassAt(tuning, p) === pc);
    return { mode, itemKey, pc, targets, expectedMs: 2500 * targets.length };
  }
  const m = /^note:(\d+)@s(\d+)$/.exec(itemKey);
  if (!m) throw new Error(`Unknown item ${itemKey}`);
  const pc = Number(m[1]);
  const string = Number(m[2]);
  const targets = positions.filter((p) => p.string === string && pitchClassAt(tuning, p) === pc);
  return { mode, itemKey, pc, string, targets, expectedMs: mode === 'play' ? 6000 : 4000 };
}

/** "C♯/D♭"-style name for prompts with no key: accidentals get both names, so nobody is tripped by spelling. */
export function promptNoteName(pc: number): string {
  const sharp = pitchClassName(pc, 'sharps');
  const flat = pitchClassName(pc, 'flats');
  return sharp === flat ? sharp : `${sharp}/${flat}`;
}

export type TapResult = 'hit' | 'miss' | 'repeat';

/** State of a "find all" question as taps come in. */
export interface FindAllState {
  found: string[];
  misses: number;
}

export function tapFindAll(q: Question, state: FindAllState, pos: FretPos): { state: FindAllState; result: TapResult; done: boolean } {
  const key = posKey(pos);
  const isTarget = q.targets.some((t) => posKey(t) === key);
  if (isTarget && state.found.includes(key)) return { state, result: 'repeat', done: false };
  const next = isTarget ? { ...state, found: [...state.found, key] } : { ...state, misses: state.misses + 1 };
  return { state: next, result: isTarget ? 'hit' : 'miss', done: next.found.length === q.targets.length };
}

export function checkTap(q: Question, pos: FretPos): boolean {
  return q.targets.some((t) => t.string === pos.string && t.fret === pos.fret);
}

export function checkName(q: Question, pc: number): boolean {
  return mod12(pc) === q.pc;
}

/** Mic answer: the right note, and with `exactOctave` the pitch of one of the target positions. */
export function checkPlayed(q: Question, midi: number, tuning: Tuning, exactOctave: boolean): boolean {
  if (mod12(midi) !== q.pc) return false;
  return !exactOctave || q.targets.some((t) => midiAt(tuning, t) === midi);
}

export interface PositionStat {
  correct: number;
  total: number;
}

/** Accuracy per neck position from logged attempts (the weak-spot heatmap). */
export function heatmap(attempts: readonly Attempt[]): Map<string, PositionStat> {
  const out = new Map<string, PositionStat>();
  for (const a of attempts) {
    if (!a.pos) continue;
    const s = out.get(a.pos) ?? { correct: 0, total: 0 };
    s.total++;
    if (a.correct) s.correct++;
    out.set(a.pos, s);
  }
  return out;
}

export function heatColour(stat: PositionStat | undefined): string | undefined {
  if (!stat || stat.total === 0) return undefined;
  const acc = stat.correct / stat.total;
  if (acc >= 0.85) return '#34d399';
  if (acc >= 0.6) return '#f5c542';
  return '#ff6b4a';
}

/** Note names ranked from weakest to strongest, from attempts with a position. */
export function weakestNotes(attempts: readonly Attempt[], tuning: Tuning, limit = 3): { pc: number; accuracy: number }[] {
  const byPc = new Map<number, PositionStat>();
  for (const a of attempts) {
    if (!a.pos) continue;
    const [s, f] = a.pos.split(':').map(Number);
    if (!s || s > stringCount(tuning)) continue;
    const pc = pitchClassAt(tuning, { string: s, fret: f! });
    const st = byPc.get(pc) ?? { correct: 0, total: 0 };
    st.total++;
    if (a.correct) st.correct++;
    byPc.set(pc, st);
  }
  return [...byPc.entries()]
    .filter(([, s]) => s.total >= 3)
    .map(([pc, s]) => ({ pc, accuracy: s.correct / s.total }))
    .filter((x) => x.accuracy < 1)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

/**
 * The level to suggest: the first one not yet passed (85% over the last 20 attempts in that level).
 * Players may still pick any level; this only drives the "recommended" badge.
 */
export function suggestedLevel(attemptsByLevel: ReadonlyMap<string, readonly Attempt[]>): NoteFinderLevel {
  for (const level of NOTE_FINDER_LEVELS) {
    const recent = (attemptsByLevel.get(level.id) ?? []).slice(-LEVEL_PASS_MIN_ATTEMPTS);
    const acc = recent.length ? recent.filter((a) => a.correct).length / recent.length : 0;
    if (recent.length < LEVEL_PASS_MIN_ATTEMPTS || acc < LEVEL_PASS_ACCURACY) return level;
  }
  return NOTE_FINDER_LEVELS[NOTE_FINDER_LEVELS.length - 1]!;
}

/** Drill ids encode mode and level, so attempts can be grouped by both. */
export function drillId(mode: NoteDrillMode, levelId: string): string {
  return `notes.${mode}.${levelId}`;
}

export function levelOfDrillId(id: string): string | undefined {
  const parts = id.split('.');
  return parts[0] === 'notes' ? parts[2] : undefined;
}
