import { describe, expect, it } from 'vitest';
import { computeLayout, slotWidth } from './geometry';

const base = { stringCount: 6, range: { from: 0, to: 12 }, orientation: 'horizontal' as const, leftHanded: false };

describe('fretboard geometry', () => {
  it('narrows slots up the neck, but stays tappable', () => {
    expect(slotWidth(12)).toBeCloseTo(slotWidth(0) / Math.SQRT2);
    expect(slotWidth(5)).toBeLessThan(slotWidth(4));
  });

  it('puts string 1 at the top and string 6 at the bottom in horizontal view', () => {
    const l = computeLayout(base);
    expect(l.note({ string: 1, fret: 3 }).y).toBeLessThan(l.note({ string: 6, fret: 3 }).y);
  });

  it('moves up the neck to the right for right-handed players', () => {
    const l = computeLayout(base);
    expect(l.note({ string: 1, fret: 5 }).x).toBeGreaterThan(l.note({ string: 1, fret: 0 }).x);
  });

  it('mirrors the neck for left-handed players', () => {
    const r = computeLayout(base);
    const l = computeLayout({ ...base, leftHanded: true });
    for (const fret of [0, 1, 5, 12]) {
      expect(l.note({ string: 2, fret }).x).toBeCloseTo(r.width - r.note({ string: 2, fret }).x);
      expect(l.note({ string: 2, fret }).y).toBeCloseTo(r.note({ string: 2, fret }).y);
    }
    expect(l.note({ string: 1, fret: 5 }).x).toBeLessThan(l.note({ string: 1, fret: 0 }).x);
  });

  it('in vertical view the headstock is on top and the low string on the left (right-handed)', () => {
    const v = computeLayout({ ...base, orientation: 'vertical' });
    expect(v.note({ string: 1, fret: 7 }).y).toBeGreaterThan(v.note({ string: 1, fret: 2 }).y);
    expect(v.note({ string: 6, fret: 3 }).x).toBeLessThan(v.note({ string: 1, fret: 3 }).x);
    const vl = computeLayout({ ...base, orientation: 'vertical', leftHanded: true });
    expect(vl.note({ string: 6, fret: 3 }).x).toBeGreaterThan(vl.note({ string: 1, fret: 3 }).x);
    expect(v.height).toBeGreaterThan(v.width);
  });

  it('draws a nut only when the open position is shown', () => {
    expect(computeLayout(base).frets.some((f) => f.isNut)).toBe(true);
    const mid = computeLayout({ ...base, range: { from: 5, to: 9 } });
    expect(mid.frets.some((f) => f.isNut)).toBe(false);
    expect(mid.frets.map((f) => f.fret)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(() => mid.note({ string: 1, fret: 2 })).toThrow();
  });

  it('places inlays, with a double dot at 12', () => {
    const l = computeLayout(base);
    expect(l.inlays.map((i) => i.fret)).toEqual([3, 5, 7, 9, 12]);
    expect(l.inlays.find((i) => i.fret === 12)!.points.length).toBe(2);
  });

  it('keeps every note inside the drawing and cells non-overlapping along a string', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      for (const leftHanded of [false, true]) {
        const l = computeLayout({ ...base, range: { from: 0, to: 22 }, orientation, leftHanded });
        for (let s = 1; s <= 6; s++) {
          for (let f = 0; f <= 22; f++) {
            const p = l.note({ string: s, fret: f });
            expect(p.x).toBeGreaterThan(0);
            expect(p.y).toBeGreaterThan(0);
            expect(p.x).toBeLessThan(l.width);
            expect(p.y).toBeLessThan(l.height);
          }
        }
      }
    }
  });
});
