import { Scale } from 'tonal';
import { pitchClassOf, simplifyName, type PitchClass } from './note';
import { symbolFromTonal, type IntervalSymbol } from './interval';

export type ScaleId =
  | 'minorPentatonic'
  | 'majorPentatonic'
  | 'blues'
  | 'major'
  | 'minor'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'locrian'
  | 'harmonicMinor'
  | 'melodicMinor';

export interface ScaleDef {
  id: ScaleId;
  /** Name Tonal understands. */
  tonalName: string;
  /** Short English label shown in the UI (translated through i18n by id). */
  label: string;
  /** Whether the scale sounds major or minor; used for default tonic spelling and colours. */
  feel: 'major' | 'minor';
}

export const SCALES: readonly ScaleDef[] = [
  { id: 'minorPentatonic', tonalName: 'minor pentatonic', label: 'Minor pentatonic', feel: 'minor' },
  { id: 'majorPentatonic', tonalName: 'major pentatonic', label: 'Major pentatonic', feel: 'major' },
  { id: 'blues', tonalName: 'blues', label: 'Blues', feel: 'minor' },
  { id: 'major', tonalName: 'major', label: 'Major', feel: 'major' },
  { id: 'minor', tonalName: 'aeolian', label: 'Natural minor', feel: 'minor' },
  { id: 'dorian', tonalName: 'dorian', label: 'Dorian', feel: 'minor' },
  { id: 'mixolydian', tonalName: 'mixolydian', label: 'Mixolydian', feel: 'major' },
  { id: 'lydian', tonalName: 'lydian', label: 'Lydian', feel: 'major' },
  { id: 'phrygian', tonalName: 'phrygian', label: 'Phrygian', feel: 'minor' },
  { id: 'locrian', tonalName: 'locrian', label: 'Locrian', feel: 'minor' },
  { id: 'harmonicMinor', tonalName: 'harmonic minor', label: 'Harmonic minor', feel: 'minor' },
  { id: 'melodicMinor', tonalName: 'melodic minor', label: 'Melodic minor', feel: 'minor' },
];

export function getScaleDef(id: ScaleId): ScaleDef {
  const def = SCALES.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown scale: ${id}`);
  return def;
}

export interface ScaleNote {
  name: string;
  pc: PitchClass;
  /** Interval from the tonic in scale context (2, 4, 6 rather than 9, 11, 13). */
  interval: IntervalSymbol;
}

export interface ScaleInfo {
  tonic: string;
  id: ScaleId;
  notes: ScaleNote[];
}

export interface SpellingOptions {
  /** Keep theory-correct spellings like Cb, E#, F## instead of simplifying them. */
  strict?: boolean;
}

/** Notes of a scale, spelled for the key. */
export function getScale(tonic: string, id: ScaleId, opts: SpellingOptions = {}): ScaleInfo {
  const def = getScaleDef(id);
  const s = Scale.get(`${tonic} ${def.tonalName}`);
  if (s.empty) throw new Error(`Cannot build scale ${tonic} ${def.tonalName}`);
  const notes = s.notes.map((name, i) => {
    const spelled = opts.strict ? name : simplifyName(name);
    return {
      name: spelled,
      pc: pitchClassOf(name),
      interval: symbolFromTonal(s.intervals[i]!, false),
    };
  });
  return { tonic: opts.strict ? tonic : simplifyName(tonic), id, notes };
}
