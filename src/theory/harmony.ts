import type { ChordInfo } from './chord';
import { mod12, type PitchClass } from './note';
import type { ScaleId } from './scale';

/** What a note means over the chord that is sounding right now. */
export type RoleOverChord = 'chordRoot' | 'chordTone' | 'blue' | 'avoid' | 'scale' | 'outside';

const DOMINANT = new Set(['7', '9']);

/**
 * Classifies a note against the current chord, inside a key and scale.
 * - Chord tones first (the chord's own root separately).
 * - Blue notes: the key's b5 in the blues scale, and the key's b3 over a dominant chord.
 *   They get their own colour and are never called "avoid".
 * - Avoid notes: a scale note a half step above a chord tone.
 */
export function roleOverChord(
  pc: PitchClass,
  chord: ChordInfo,
  keyTonicPc: PitchClass,
  scale: ScaleId,
  scalePcs: readonly PitchClass[],
): RoleOverChord {
  const p = mod12(pc);
  const tones = chord.tones.map((t) => t.pc);
  if (p === chord.tones[0]?.pc) return 'chordRoot';
  if (tones.includes(p)) return 'chordTone';
  if (!scalePcs.includes(p)) return 'outside';
  const fromKey = mod12(p - keyTonicPc);
  if (scale === 'blues' && fromKey === 6) return 'blue';
  if (fromKey === 3 && DOMINANT.has(chord.type) && scalePcs.includes(mod12(keyTonicPc + 3))) return 'blue';
  if (tones.includes(mod12(p - 1))) return 'avoid';
  return 'scale';
}
