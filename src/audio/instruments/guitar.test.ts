import { describe, expect, it } from 'vitest';
import { SAMPLE_MIDIS, sampleFile } from './guitar';

describe('guitar recordings', () => {
  it('names files the way the sample set does', () => {
    expect(sampleFile(40)).toBe('E2.mp3');
    expect(sampleFile(61)).toBe('Cs4.mp3');
    expect(sampleFile(74)).toBe('D5.mp3');
  });

  it('has a recording for every semitone from D2 to E6', () => {
    expect(SAMPLE_MIDIS).toHaveLength(51);
    const files = Object.keys(import.meta.glob('/public/samples/guitar/*.mp3')).map((f) => f.split('/').pop());
    for (const m of SAMPLE_MIDIS) expect(files).toContain(sampleFile(m));
  });
});
