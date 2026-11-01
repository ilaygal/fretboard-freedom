import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, TUNINGS, midiAt, pitchClassAt } from '@/theory';
import { NOTE_FINDER_LEVELS } from '@/content/noteFinderLevels';
import type { Attempt } from '@/data';
import {
  checkName,
  checkPlayed,
  checkTap,
  drillId,
  heatmap,
  itemsFor,
  levelOfDrillId,
  levelRegion,
  promptNoteName,
  questionFor,
  regionPositions,
  suggestedLevel,
  tapFindAll,
  weakestNotes,
} from './model';

const level = (id: string) => NOTE_FINDER_LEVELS.find((l) => l.id === id)!;

describe('note finder levels', () => {
  it('low E naturals: 7 note names, 8 positions in frets 0-12', () => {
    const r = levelRegion(level('lowE'), STANDARD_TUNING, 22);
    const pos = regionPositions(r, STANDARD_TUNING);
    // E F G A B C D E: frets 0 1 3 5 7 8 10 12
    expect(pos.map((p) => p.fret)).toEqual([0, 1, 3, 5, 7, 8, 10, 12]);
    expect(itemsFor('find', r, STANDARD_TUNING).length).toBe(7);
    expect(itemsFor('name', r, STANDARD_TUNING).length).toBe(8);
  });

  it('caps levels at the guitar\'s fret count', () => {
    expect(levelRegion(level('wholeNeck'), STANDARD_TUNING, 21).range).toEqual({ from: 0, to: 21 });
    expect(levelRegion(level('above12'), STANDARD_TUNING, 15).range).toEqual({ from: 12, to: 15 });
  });

  it('every level has items in every mode and tuning, and every question has a target', () => {
    for (const t of TUNINGS) {
      for (const l of NOTE_FINDER_LEVELS) {
        const r = levelRegion(l, t, 22);
        for (const mode of ['name', 'find', 'findAll', 'play'] as const) {
          const items = itemsFor(mode, r, t);
          expect(items.length, `${t.id} ${l.id} ${mode}`).toBeGreaterThan(0);
          for (const k of items) {
            const q = questionFor(mode, k, r, t);
            expect(q.targets.length).toBeGreaterThan(0);
            for (const p of q.targets) expect(pitchClassAt(t, p)).toBe(q.pc);
          }
        }
      }
    }
  });
});

describe('answers', () => {
  const r = levelRegion(level('open'), STANDARD_TUNING, 22);

  it('checks a find tap on the right string only', () => {
    const q = questionFor('find', 'note:7@s3', r, STANDARD_TUNING); // G on the G string
    expect(checkTap(q, { string: 3, fret: 0 })).toBe(true);
    expect(checkTap(q, { string: 6, fret: 3 })).toBe(false);
  });

  it('checks a named note', () => {
    const q = questionFor('name', 'pos:5:3', r, STANDARD_TUNING); // C
    expect(checkName(q, 0)).toBe(true);
    expect(checkName(q, 12)).toBe(true);
    expect(checkName(q, 1)).toBe(false);
  });

  it('tracks find-all taps until every target is found', () => {
    const q = questionFor('findAll', 'all:7', r, STANDARD_TUNING); // G in frets 0-5
    expect(q.targets.length).toBe(4); // 6/3, 4/5, 3/0, 1/3
    let st = { found: [] as string[], misses: 0 };
    let res = tapFindAll(q, st, { string: 6, fret: 3 });
    expect(res.result).toBe('hit');
    st = res.state;
    res = tapFindAll(q, st, { string: 6, fret: 3 });
    expect(res.result).toBe('repeat');
    res = tapFindAll(q, st, { string: 5, fret: 3 });
    expect(res.result).toBe('miss');
    st = res.state;
    for (const p of [{ string: 4, fret: 5 }, { string: 3, fret: 0 }, { string: 1, fret: 3 }]) {
      res = tapFindAll(q, st, p);
      st = res.state;
    }
    expect(res.done).toBe(true);
    expect(st.misses).toBe(1);
  });

  it('checks a played note, octave-aware on request', () => {
    const q = questionFor('play', 'note:9@s3', r, STANDARD_TUNING); // A on the G string = A3 (fret 2)
    const a3 = midiAt(STANDARD_TUNING, { string: 3, fret: 2 });
    expect(checkPlayed(q, a3, STANDARD_TUNING, true)).toBe(true);
    expect(checkPlayed(q, a3 + 12, STANDARD_TUNING, false)).toBe(true);
    expect(checkPlayed(q, a3 + 12, STANDARD_TUNING, true)).toBe(false);
    expect(checkPlayed(q, a3 + 1, STANDARD_TUNING, false)).toBe(false);
  });

  it('names accidentals both ways in prompts', () => {
    expect(promptNoteName(1)).toBe('C#/Db');
    expect(promptNoteName(0)).toBe('C');
  });
});

describe('progress', () => {
  const att = (pos: string, correct: boolean, drill = 'notes.find.lowE'): Attempt => ({
    profileId: 'p', drillId: drill, itemKey: 'x', pos, correct, ms: 1000, at: 0, input: 'tap',
  });

  it('builds a heatmap and finds weak notes', () => {
    const list = [att('6:3', true), att('6:3', false), att('6:5', true), att('6:5', true), att('6:5', true), att('6:3', false), att('6:3', true)];
    const h = heatmap(list);
    expect(h.get('6:3')).toEqual({ correct: 2, total: 4 });
    expect(weakestNotes(list, STANDARD_TUNING)).toEqual([{ pc: 7, accuracy: 0.5 }]);
  });

  it('suggests the first level not yet passed', () => {
    const passed = Array.from({ length: 20 }, () => att('6:0', true));
    expect(suggestedLevel(new Map()).id).toBe('lowE');
    expect(suggestedLevel(new Map([['lowE', passed]])).id).toBe('aString');
    const shaky = [...passed.slice(0, 15), ...Array.from({ length: 5 }, () => att('6:0', false))];
    expect(suggestedLevel(new Map([['lowE', shaky]])).id).toBe('lowE');
  });

  it('encodes level in drill ids', () => {
    expect(levelOfDrillId(drillId('find', 'lowE'))).toBe('lowE');
    expect(levelOfDrillId('ear.intervals')).toBeUndefined();
  });
});
