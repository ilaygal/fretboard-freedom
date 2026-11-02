import { getMaster, getTone, unlockAudio } from '../engine';
import { metronome } from '../metronome';

/** The instruments of a backing band. */
export type BandPart = 'kick' | 'snare' | 'hat' | 'ride' | 'bass' | 'comp';
export type MixChannel = 'drums' | 'bass' | 'chords';

/** One timed note of a backing track, in transport ticks (192 per quarter). */
export interface ScheduledNote {
  tick: number;
  part: BandPart;
  midis: number[];
  durTicks: number;
  velocity: number;
}

export interface BackingTrack {
  events: ScheduledNote[];
  totalTicks: number;
  bars: number;
  /** Ticks per bar (768 in 4/4). */
  barTicks: number;
  /** Ticks per beat marker for the UI (192 = quarter notes). */
  beatTicks: number;
}

export interface Position {
  bar: number;
  beat: number;
}

type Listener = (p: Position) => void;

/** Mix levels from 0 (silent) to 1. */
export type Mix = Record<MixChannel, number>;

function toDb(level: number): number {
  return level <= 0.001 ? -Infinity : 20 * Math.log10(level);
}

type Tone = typeof import('tone');

/**
 * Plays a looping backing track: synth drums, bass and electric-piano chords.
 * Listeners hear about every beat in sync with the sound (Tone.Draw), so the neck can follow the chords.
 */
export class BackingPlayer {
  private part: import('tone').Part | null = null;
  private beats: import('tone').Loop | null = null;
  private inst: ReturnType<BackingPlayer['build']> | null = null;
  private listeners = new Set<Listener>();
  private track: BackingTrack | null = null;
  private mix: Mix = { drums: 0.8, bass: 0.8, chords: 0.6 };

  onPosition(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get playing(): boolean {
    return this.part !== null;
  }

  private build(tone: Tone, out: import('tone').ToneAudioNode) {
    const channels = {
      drums: new tone.Volume(toDb(this.mix.drums)).connect(out),
      bass: new tone.Volume(toDb(this.mix.bass)).connect(out),
      chords: new tone.Volume(toDb(this.mix.chords)).connect(out),
    };
    const kick = new tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 },
    }).connect(channels.drums);
    const snareFilter = new tone.Filter(1800, 'bandpass').connect(channels.drums);
    const snare = new tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(
      snareFilter,
    );
    const hatFilter = new tone.Filter(8000, 'highpass').connect(channels.drums);
    const hat = new tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } }).connect(
      hatFilter,
    );
    const ride = new tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.35, sustain: 0 } }).connect(
      hatFilter,
    );
    ride.volume.value = -8;
    hat.volume.value = -10;
    snare.volume.value = -4;
    const bass = new tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.004, decay: 0.25, sustain: 0.7, release: 0.08 },
      filter: { Q: 1, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.004, decay: 0.18, sustain: 0.35, release: 0.1, baseFrequency: 90, octaves: 2.6 },
    }).connect(channels.bass);
    bass.volume.value = -3;
    const comp = new tone.PolySynth(tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0.25, release: 0.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.4 },
    }).connect(channels.chords);
    comp.maxPolyphony = 16;
    comp.volume.value = -12;
    return { channels, kick, snare, hat, ride, bass, comp };
  }

  private trigger(tone: Tone, ev: ScheduledNote, time: number) {
    const inst = this.inst;
    if (!inst) return;
    const dur = tone.Ticks(ev.durTicks).toSeconds();
    switch (ev.part) {
      case 'kick':
        inst.kick.triggerAttackRelease('C1', '16n', time, ev.velocity);
        break;
      case 'snare':
        inst.snare.triggerAttackRelease('16n', time, ev.velocity);
        break;
      case 'hat':
        inst.hat.triggerAttackRelease('32n', time, ev.velocity);
        break;
      case 'ride':
        inst.ride.triggerAttackRelease('16n', time, ev.velocity * 0.8);
        break;
      case 'bass':
        inst.bass.triggerAttackRelease(tone.Frequency(ev.midis[0]!, 'midi').toFrequency(), dur, time, ev.velocity);
        break;
      case 'comp':
        inst.comp.triggerAttackRelease(
          ev.midis.map((m) => tone.Frequency(m, 'midi').toFrequency()),
          dur,
          time,
          ev.velocity * 0.8,
        );
        break;
    }
  }

  /** Starts (or restarts) playing a track at a tempo. Call from a tap the first time (iOS). */
  play(track: BackingTrack, bpm: number) {
    unlockAudio();
    const tone = getTone();
    const out = getMaster();
    if (!tone || !out) return;
    metronome.stop();
    this.stopInternal(tone);
    this.inst ??= this.build(tone, out);
    this.track = track;

    const transport = tone.getTransport();
    transport.bpm.value = bpm;
    this.part = new tone.Part<ScheduledNote>(
      (time, ev) => this.trigger(tone, ev, time),
      track.events.map((e) => ({ ...e, time: `${e.tick}i` })),
    );
    this.part.loop = true;
    this.part.loopEnd = `${track.totalTicks}i`;
    this.part.start(0);

    let beatIndex = 0;
    const beatsPerBar = track.barTicks / track.beatTicks;
    const totalBeats = (track.totalTicks / track.beatTicks) | 0;
    this.beats = new tone.Loop((time) => {
      const i = beatIndex % totalBeats;
      beatIndex++;
      const pos = { bar: Math.floor(i / beatsPerBar), beat: i % beatsPerBar };
      tone.getDraw().schedule(() => this.listeners.forEach((l) => l(pos)), time);
    }, `${track.beatTicks}i`).start(0);

    transport.position = 0;
    transport.start('+0.08');
  }

  /** Transport ticks since Play (192 per quarter), for timing what the player plays. */
  ticksNow(): number | null {
    const tone = getTone();
    if (!tone || !this.playing) return null;
    return tone.getTransport().ticks;
  }

  /** Current tempo, for converting delays to ticks. */
  bpmNow(): number {
    return getTone()?.getTransport().bpm.value ?? 120;
  }

  setTempo(bpm: number) {
    const tone = getTone();
    if (tone) tone.getTransport().bpm.rampTo(bpm, 0.2);
  }

  setMix(mix: Mix) {
    this.mix = mix;
    if (!this.inst) return;
    for (const ch of Object.keys(mix) as MixChannel[]) this.inst.channels[ch].volume.rampTo(toDb(mix[ch]), 0.05);
  }

  /** Swaps the track but keeps the groove going from the same bar position when possible. */
  replace(track: BackingTrack, bpm: number) {
    if (!this.playing) return;
    this.play(track, bpm);
  }

  private stopInternal(tone: Tone) {
    if (this.part) {
      this.part.dispose();
      this.part = null;
    }
    if (this.beats) {
      this.beats.dispose();
      this.beats = null;
    }
    const transport = tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.inst?.comp.releaseAll();
  }

  stop() {
    const tone = getTone();
    if (tone) this.stopInternal(tone);
    this.track = null;
  }

  get currentTrack(): BackingTrack | null {
    return this.track;
  }

}

export const backing = new BackingPlayer();
