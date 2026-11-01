import { Note } from 'tonal';
import { getChord, type ChordInfo, type ChordTypeId } from './chord';
import { simplifyName } from './note';
import type { SpellingOptions } from './scale';

/**
 * Roman-numeral chord symbols, always counted from the major scale of the key's home note:
 * "I", "vi", "bVII", "V7", "ii7", "iiø7", "vii°", "Imaj7", "i7".
 * Upper case = major, lower case = minor. A minor key writes its chords as i, bIII, bVI, bVII.
 */
export type Numeral = string;

const DEGREE_INTERVALS = ['1P', '2M', '3M', '4P', '5P', '6M', '7M'] as const;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export interface ParsedNumeral {
  /** Interval from the home note to the chord root, in Tonal notation ("3m", "4A"). */
  interval: string;
  type: ChordTypeId;
}

const NUMERAL_RE = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/;

function shiftInterval(interval: string, acc: 'b' | '#' | undefined): string {
  if (!acc) return interval;
  const num = interval.slice(0, -1);
  const q = interval.slice(-1);
  if (acc === 'b') return `${num}${q === 'P' ? 'd' : 'm'}`;
  return `${num}A`;
}

function chordTypeFor(major: boolean, suffix: string): ChordTypeId {
  switch (suffix) {
    case '':
      return major ? 'maj' : 'min';
    case '7':
      return major ? '7' : 'm7';
    case 'maj7':
      return 'maj7';
    case '6':
      return major ? '6' : 'm6';
    case '9':
      return major ? '9' : 'm9';
    case 'maj9':
      return 'maj9';
    case 'sus2':
      return 'sus2';
    case 'sus4':
      return 'sus4';
    case '5':
      return '5';
    case 'add9':
      return 'add9';
    case '°':
    case 'dim':
      return 'dim';
    case '°7':
    case 'dim7':
      return 'dim7';
    case 'ø':
    case 'ø7':
    case 'm7b5':
      return 'm7b5';
    case '+':
    case 'aug':
      return 'aug';
    default:
      throw new Error(`Unknown chord suffix in numeral: ${suffix}`);
  }
}

export function parseNumeral(numeral: Numeral): ParsedNumeral {
  const m = NUMERAL_RE.exec(numeral);
  if (!m) throw new Error(`Not a roman numeral: ${numeral}`);
  const acc = m[1] as 'b' | '#' | undefined;
  const roman = m[2]!;
  const suffix = m[3] ?? '';
  const degree = ROMAN.indexOf(roman.toUpperCase() as (typeof ROMAN)[number]);
  const major = roman === roman.toUpperCase();
  return { interval: shiftInterval(DEGREE_INTERVALS[degree]!, acc), type: chordTypeFor(major, suffix) };
}

/** The chord a numeral stands for in a key, spelled from the home note ("bVII" in D = C, in F = Eb). */
export function chordFromNumeral(tonic: string, numeral: Numeral, opts: SpellingOptions = {}): ChordInfo {
  const { interval, type } = parseNumeral(numeral);
  const root = Note.transpose(tonic, interval);
  if (!root) throw new Error(`Cannot transpose ${tonic} by ${interval}`);
  return getChord(opts.strict ? root : simplifyName(root), type, opts);
}

export function resolveProgression(tonic: string, numerals: readonly Numeral[], opts: SpellingOptions = {}): ChordInfo[] {
  return numerals.map((n) => chordFromNumeral(tonic, n, opts));
}
