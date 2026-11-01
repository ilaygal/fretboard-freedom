import { getMaster, getTone, unlockAudio } from './engine';
import { clampBpm, clickPattern, type ClickKind } from './timing';

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  /** 1 = quarter notes, 2 = eighths, 3 = triplets, 4 = sixteenths. */
  subdivision: number;
  accentFirst: boolean;
}

export type TickListener = (index: number, kind: ClickKind) => void;

/**
 * A click track on Tone's transport. `onTick` fires in sync with the sound (via Tone.Draw),
 * so the UI can flash the beat.
 */
export class Metronome {
  private loop: import('tone').Loop | null = null;
  private synth: import('tone').MembraneSynth | null = null;
  private step = 0;
  private listeners = new Set<TickListener>();
  options: MetronomeOptions = { bpm: 90, beatsPerBar: 4, subdivision: 1, accentFirst: true };

  onTick(fn: TickListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get running(): boolean {
    return this.loop !== null;
  }

  update(opts: Partial<MetronomeOptions>) {
    this.options = { ...this.options, ...opts, bpm: clampBpm(opts.bpm ?? this.options.bpm) };
    const tone = getTone();
    if (!tone) return;
    tone.getTransport().bpm.value = this.options.bpm;
    if (this.loop) this.loop.interval = `${4 * this.options.subdivision}n`;
  }

  start() {
    unlockAudio();
    const tone = getTone();
    const out = getMaster();
    if (!tone || !out || this.loop) return;
    this.synth ??= new tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
    }).connect(out);
    const transport = tone.getTransport();
    transport.bpm.value = this.options.bpm;
    this.step = 0;
    this.loop = new tone.Loop((time) => {
      const pattern = clickPattern(this.options.beatsPerBar, this.options.subdivision, this.options.accentFirst);
      const i = this.step % pattern.length;
      const kind = pattern[i]!;
      const note = kind === 'bar' ? 'C6' : kind === 'beat' ? 'G5' : 'G4';
      const vel = kind === 'bar' ? 1 : kind === 'beat' ? 0.7 : 0.35;
      this.synth!.triggerAttackRelease(note, '64n', time, vel);
      tone.getDraw().schedule(() => this.listeners.forEach((l) => l(i, kind)), time);
      this.step++;
    }, `${4 * this.options.subdivision}n`).start(0);
    transport.start('+0.05');
  }

  stop() {
    const tone = getTone();
    this.loop?.dispose();
    this.loop = null;
    if (tone) {
      tone.getTransport().stop();
      tone.getTransport().position = 0;
    }
  }
}

export const metronome = new Metronome();
