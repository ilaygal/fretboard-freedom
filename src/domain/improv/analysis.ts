import { midiAt, mod12, openMidi, stringCount, type ChordInfo, type FretPos, type Tuning } from '@/theory';
import type { ChallengeRule } from '@/content/challenges';

/** One note the mic heard while the band played. `bar` counts from 0 since Play; `beat` is 0..4. */
export interface HeardNote {
  midi: number;
  bar: number;
  beat: number;
}

export interface ImprovContext {
  /** The progression's chords, one per bar, looping. */
  chords: readonly ChordInfo[];
  scalePcs: readonly number[];
  tuning: Tuning;
  maxFret: number;
  /** For newPosition: the notes of the hand position to stay in. */
  box?: readonly FretPos[];
  /** How many bars were played. */
  bars: number;
}

export interface ImprovReport {
  notes: number;
  /** Share of notes that belonged to the chord sounding at the time. */
  chordTonePct: number;
  /** Share of notes in the scale or the current chord (i.e. not "outside"). */
  insidePct: number;
  lowest: number | null;
  highest: number | null;
  /** How much of the guitar's range was used, low/middle/high thirds. */
  registers: { low: number; mid: number; high: number };
  /** Distinct pitch classes used. */
  distinctNotes: number;
  /** Bars with at least one note. */
  barsPlayed: number;
  /** How well the challenge rule was kept, 0..1. */
  score: number;
  /** Extra numbers a rule reports (e.g. thirds landed). */
  detail: Record<string, number>;
}

export function chordAtBar(chords: readonly ChordInfo[], bar: number): ChordInfo {
  const n = chords.length;
  return chords[((bar % n) + n) % n]!;
}

function guitarRange(t: Tuning, maxFret: number) {
  return { low: openMidi(t, stringCount(t)), high: openMidi(t, 1) + maxFret };
}

/** The pitches you can reach on a set of strings. */
export function stringsRange(t: Tuning, strings: number[], maxFret: number) {
  const opens = strings.map((s) => openMidi(t, s));
  return { low: Math.min(...opens), high: Math.max(...opens) + maxFret };
}

function share(n: number, of: number) {
  return of === 0 ? 0 : n / of;
}

function ruleScore(rule: ChallengeRule, heard: HeardNote[], ctx: ImprovContext): { score: number; detail: Record<string, number> } {
  const n = heard.length;
  switch (rule.kind) {
    case 'free':
    case 'chordTones': {
      const tones = heard.filter((h) => chordAtBar(ctx.chords, h.bar).tones.some((t) => t.pc === mod12(h.midi))).length;
      return { score: share(tones, n), detail: {} };
    }
    case 'strings': {
      const r = stringsRange(ctx.tuning, rule.strings, ctx.maxFret);
      return { score: share(heard.filter((h) => h.midi >= r.low && h.midi <= r.high).length, n), detail: {} };
    }
    case 'fewNotes': {
      const distinct = new Set(heard.map((h) => mod12(h.midi))).size;
      return { score: n === 0 ? 0 : distinct <= rule.count ? 1 : rule.count / distinct, detail: { distinct } };
    }
    case 'rhythmOnly': {
      const counts = new Map<number, number>();
      for (const h of heard) counts.set(mod12(h.midi), (counts.get(mod12(h.midi)) ?? 0) + 1);
      const top = Math.max(0, ...counts.values());
      return { score: share(top, n), detail: { distinct: counts.size } };
    }
    case 'callResponse': {
      // Bars 1, 3, 5... (index 0, 2, 4) are the band's; yours are 2, 4, 6...
      const inYourBars = heard.filter((h) => h.bar % 2 === 1).length;
      return { score: share(inYourBars, n), detail: { inYourBars } };
    }
    case 'newPosition': {
      if (!ctx.box?.length) return { score: 0, detail: {} };
      const midis = ctx.box.map((p) => midiAt(ctx.tuning, p));
      const low = Math.min(...midis) - 1;
      const high = Math.max(...midis) + 1;
      return { score: share(heard.filter((h) => h.midi >= low && h.midi <= high).length, n), detail: {} };
    }
    case 'targetThird': {
      // First note in each bar, if it came in early (before beat 2), should be the chord's 3rd.
      let tries = 0;
      let hits = 0;
      for (let bar = 0; bar < ctx.bars; bar++) {
        const first = heard.filter((h) => h.bar === bar).sort((a, b) => a.beat - b.beat)[0];
        if (!first || first.beat >= 1) continue;
        tries++;
        const chord = chordAtBar(ctx.chords, bar);
        const third = chord.tones.find((t) => t.interval === '3' || t.interval === 'b3');
        if (third && third.pc === mod12(first.midi)) hits++;
      }
      return { score: share(hits, Math.max(tries, Math.ceil(ctx.bars / 2))), detail: { hits, tries } };
    }
  }
}

/** The report after a challenge (or any jam): what you played and how well you kept the rule. */
export function analyseImprov(heard: HeardNote[], rule: ChallengeRule, ctx: ImprovContext): ImprovReport {
  const n = heard.length;
  const range = guitarRange(ctx.tuning, ctx.maxFret);
  const third = (range.high - range.low) / 3;
  const registers = { low: 0, mid: 0, high: 0 };
  let tones = 0;
  let inside = 0;
  for (const h of heard) {
    const pc = mod12(h.midi);
    const chord = chordAtBar(ctx.chords, h.bar);
    const isTone = chord.tones.some((t) => t.pc === pc);
    if (isTone) tones++;
    if (isTone || ctx.scalePcs.includes(pc)) inside++;
    if (h.midi < range.low + third) registers.low++;
    else if (h.midi < range.low + 2 * third) registers.mid++;
    else registers.high++;
  }
  const midis = heard.map((h) => h.midi);
  const { score, detail } = ruleScore(rule, heard, ctx);
  return {
    notes: n,
    chordTonePct: share(tones, n),
    insidePct: share(inside, n),
    lowest: n ? Math.min(...midis) : null,
    highest: n ? Math.max(...midis) : null,
    registers,
    distinctNotes: new Set(midis.map(mod12)).size,
    barsPlayed: new Set(heard.map((h) => h.bar)).size,
    score,
    detail,
  };
}

/** Converts a transport tick count (since Play) into bar and beat, after removing the mic's delay. */
export function tickToBarBeat(ticks: number, delayTicks: number, ppq: number): { bar: number; beat: number } {
  const t = Math.max(0, ticks - delayTicks);
  const barTicks = ppq * 4;
  return { bar: Math.floor(t / barTicks), beat: (t % barTicks) / ppq };
}
