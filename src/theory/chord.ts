import { Chord } from 'tonal';
import { pitchClassOf, simplifyName, type PitchClass } from './note';
import { symbolFromTonal, type IntervalSymbol } from './interval';
import type { SpellingOptions } from './scale';

export type ChordTypeId =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | '5'
  | '6'
  | 'm6'
  | '7'
  | 'maj7'
  | 'm7'
  | 'm7b5'
  | 'dim7'
  | 'add9'
  | '9'
  | 'maj9'
  | 'm9';

export interface ChordTypeDef {
  id: ChordTypeId;
  /** Tonal chord type alias. */
  tonal: string;
  /** Suffix written after the root: "", "m", "7", "maj7"... */
  suffix: string;
  label: string;
}

export const CHORD_TYPES: readonly ChordTypeDef[] = [
  { id: 'maj', tonal: 'M', suffix: '', label: 'Major' },
  { id: 'min', tonal: 'm', suffix: 'm', label: 'Minor' },
  { id: 'dim', tonal: 'dim', suffix: 'dim', label: 'Diminished' },
  { id: 'aug', tonal: 'aug', suffix: 'aug', label: 'Augmented' },
  { id: 'sus2', tonal: 'sus2', suffix: 'sus2', label: 'Sus2' },
  { id: 'sus4', tonal: 'sus4', suffix: 'sus4', label: 'Sus4' },
  { id: '5', tonal: '5', suffix: '5', label: 'Power chord' },
  { id: '6', tonal: '6', suffix: '6', label: 'Major 6' },
  { id: 'm6', tonal: 'm6', suffix: 'm6', label: 'Minor 6' },
  { id: '7', tonal: '7', suffix: '7', label: 'Dominant 7' },
  { id: 'maj7', tonal: 'maj7', suffix: 'maj7', label: 'Major 7' },
  { id: 'm7', tonal: 'm7', suffix: 'm7', label: 'Minor 7' },
  { id: 'm7b5', tonal: 'm7b5', suffix: 'm7b5', label: 'Half-diminished' },
  { id: 'dim7', tonal: 'dim7', suffix: 'dim7', label: 'Diminished 7' },
  { id: 'add9', tonal: 'add9', suffix: 'add9', label: 'Add 9' },
  { id: '9', tonal: '9', suffix: '9', label: 'Dominant 9' },
  { id: 'maj9', tonal: 'maj9', suffix: 'maj9', label: 'Major 9' },
  { id: 'm9', tonal: 'm9', suffix: 'm9', label: 'Minor 9' },
];

export function getChordTypeDef(id: ChordTypeId): ChordTypeDef {
  const def = CHORD_TYPES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown chord type: ${id}`);
  return def;
}

export interface ChordTone {
  name: string;
  pc: PitchClass;
  /** Interval from the chord root in chord context (keeps 9, 11, 13). */
  interval: IntervalSymbol;
}

export interface ChordInfo {
  root: string;
  type: ChordTypeId;
  symbol: string;
  tones: ChordTone[];
}

export function getChord(root: string, type: ChordTypeId, opts: SpellingOptions = {}): ChordInfo {
  const def = getChordTypeDef(type);
  const c = Chord.getChord(def.tonal, root);
  if (c.empty) throw new Error(`Cannot build chord ${root}${def.suffix}`);
  const spelledRoot = opts.strict ? root : simplifyName(root);
  return {
    root: spelledRoot,
    type,
    symbol: `${spelledRoot}${def.suffix}`,
    tones: c.notes.map((name, i) => ({
      name: opts.strict ? name : simplifyName(name),
      pc: pitchClassOf(name),
      interval: symbolFromTonal(c.intervals[i]!, true),
    })),
  };
}
