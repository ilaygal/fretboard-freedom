import { Scale } from 'tonal';
import { mod12, pitchClassName, type AccidentalPreference, type PitchClass, SHARP_NAMES, FLAT_NAMES } from './note';
import { getScaleDef, type ScaleId } from './scale';

const RARE = new Set(['Cb', 'Fb', 'E#', 'B#']);

function spellingCost(tonic: string, tonalScale: string): number {
  const s = Scale.get(`${tonic} ${tonalScale}`);
  if (s.empty) return Number.POSITIVE_INFINITY;
  return s.notes.reduce((sum, n) => {
    const acc = n.replace(/^[A-G]/, '');
    return sum + acc.length + (RARE.has(n) ? 1 : 0);
  }, 0);
}

/**
 * The most readable tonic name for a pitch class in a given scale:
 * picks whichever of the sharp/flat spellings gives the scale fewer accidentals
 * (Db major over C# major, C# minor over Db minor). Ties go to F# for pitch class 6
 * and to the flat name otherwise (Eb minor over D# minor).
 */
export function preferredTonic(pc: PitchClass, scale: ScaleId): string {
  const sharp = SHARP_NAMES[mod12(pc)]!;
  const flat = FLAT_NAMES[mod12(pc)]!;
  if (sharp === flat) return sharp;
  const tonal = getScaleDef(scale).tonalName;
  const cs = spellingCost(sharp, tonal);
  const cf = spellingCost(flat, tonal);
  if (cs < cf) return sharp;
  if (cf < cs) return flat;
  return mod12(pc) === 6 ? sharp : flat;
}

/** Whether a key tends to be written with sharps or flats. */
export function accidentalPreferenceOf(tonic: string, scale: ScaleId, fallback: AccidentalPreference): AccidentalPreference {
  const s = Scale.get(`${tonic} ${getScaleDef(scale).tonalName}`);
  if (s.notes.some((n) => /^[A-G]b/.test(n))) return 'flats';
  if (s.notes.some((n) => /^[A-G]#/.test(n))) return 'sharps';
  return fallback;
}

/**
 * Returns a function that names any pitch class inside a key: scale notes as the key spells them,
 * other notes with the key's sharp/flat direction.
 */
export function speller(
  scaleNotes: readonly { name: string; pc: PitchClass }[],
  pref: AccidentalPreference,
): (pc: PitchClass) => string {
  const map = new Map<number, string>();
  for (const n of scaleNotes) map.set(n.pc, n.name);
  return (pc) => map.get(mod12(pc)) ?? pitchClassName(pc, pref);
}
