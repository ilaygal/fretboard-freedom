import type { ChallengeDef } from '@/content/challenges';
import { getStyle } from '@/content/backing';
import type { ImprovReport } from '@/domain/improv/analysis';
import type { Rng } from '@/domain/drills/engine';
import type { JamChoice, Wheels } from '@/modules/jam/model';

/** The jam a challenge starts with; the key is the player's pick (or a friendly default). */
export function challengeJam(def: ChallengeDef, tonicPc: number, bpm?: number): JamChoice {
  return { tonicPc, progressionId: def.progressionId, styleId: def.styleId, scale: def.scale, bpm: bpm ?? getStyle(def.styleId).bpm.default };
}

/** How much the neck helps during a challenge. */
export function wheelsFor(def: ChallengeDef): Wheels {
  switch (def.rule.kind) {
    case 'chordTones':
    case 'targetThird':
      return 'chordTones';
    default:
      return 'map';
  }
}

/** "New position": any box except box 1, the one everyone already knows. */
export function pickNewBox(rng: Rng, boxCount: number): number {
  if (boxCount <= 1) return 1;
  return 2 + Math.floor(rng() * (boxCount - 1));
}

/** In call and response, the band plays bars 1, 3, 5... and you answer in 2, 4, 6... */
export function yourTurn(def: ChallengeDef, absoluteBar: number): boolean {
  return def.rule.kind !== 'callResponse' || absoluteBar % 2 === 1;
}

export type Tip = 'playMore' | 'aimChord' | 'goHigher' | 'goLower' | 'moreNotes' | 'keepRule' | 'great';

export interface Verdict {
  /** 0 to 3 stars. */
  stars: number;
  passed: boolean;
  tips: Tip[];
}

/** Turns the numbers into stars and at most two friendly tips. */
export function verdict(def: ChallengeDef, r: ImprovReport): Verdict {
  if (r.notes === 0) return { stars: 0, passed: false, tips: ['playMore'] };
  const passed = r.score >= def.passAt && r.notes >= Math.min(4, def.bars);
  const ratio = def.passAt === 0 ? r.chordTonePct / 0.6 : r.score / def.passAt;
  const stars = !passed ? (ratio >= 0.6 ? 1 : 0) : ratio >= 1.15 || r.score >= 0.97 ? 3 : 2;
  const tips: Tip[] = [];
  if (!passed && def.rule.kind !== 'free') tips.push('keepRule');
  if (r.notes < def.bars) tips.push('playMore');
  if (r.chordTonePct < 0.35 && def.rule.kind !== 'rhythmOnly') tips.push('aimChord');
  const total = r.registers.low + r.registers.mid + r.registers.high;
  if (total >= 6 && r.registers.high === 0 && def.rule.kind !== 'strings') tips.push('goHigher');
  else if (total >= 6 && r.registers.low === 0 && def.rule.kind !== 'strings') tips.push('goLower');
  if (def.rule.kind === 'free' && r.distinctNotes <= 2) tips.push('moreNotes');
  if (tips.length === 0) tips.push('great');
  return { stars, passed: def.rule.kind === 'free' ? r.notes >= 4 : passed, tips: tips.slice(0, 2) };
}
