import { describe, expect, it } from 'vitest';
import { roleOverChord } from './harmony';
import { getChord } from './chord';
import { getScale } from './scale';
import { pitchClassOf } from './note';

const pcs = (tonic: string, id: Parameters<typeof getScale>[1]) => getScale(tonic, id).notes.map((n) => n.pc);
const pc = pitchClassOf;

describe('roles over the current chord', () => {
  it('marks chord tones and the chord root', () => {
    const scale = pcs('C', 'major');
    expect(roleOverChord(pc('G'), getChord('G', 'maj'), 0, 'major', scale)).toBe('chordRoot');
    expect(roleOverChord(pc('B'), getChord('G', 'maj'), 0, 'major', scale)).toBe('chordTone');
  });

  it('calls a scale note a half step above a chord tone an avoid note', () => {
    const scale = pcs('C', 'major');
    expect(roleOverChord(pc('F'), getChord('C', 'maj'), 0, 'major', scale)).toBe('avoid');
    expect(roleOverChord(pc('C'), getChord('G', 'maj'), 0, 'major', scale)).toBe('avoid');
    expect(roleOverChord(pc('A'), getChord('C', 'maj'), 0, 'major', scale)).toBe('scale');
  });

  it('never calls blue notes avoid', () => {
    const scale = pcs('A', 'blues');
    const a = pc('A');
    // C over E7 is a half step above B, but it is the key's b3 over a dominant chord: blue.
    expect(roleOverChord(pc('C'), getChord('E', '7'), a, 'blues', scale)).toBe('blue');
    expect(roleOverChord(pc('Eb'), getChord('A', '7'), a, 'blues', scale)).toBe('blue');
    expect(roleOverChord(pc('Eb'), getChord('D', '7'), a, 'blues', scale)).toBe('blue');
  });

  it('marks notes outside the scale', () => {
    expect(roleOverChord(pc('F#'), getChord('C', 'maj'), 0, 'major', pcs('C', 'major'))).toBe('outside');
  });
});
