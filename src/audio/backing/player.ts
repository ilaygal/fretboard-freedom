import { getMaster, getRoom, getTone, unlockAudio } from '../engine';
import { guitarBuffers, loadGuitarBuffers, makeGuitarSampler } from '../instruments/guitar';
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
 * Plays a looping backing track: synth drums, a round synth bass and strummed acoustic-guitar chords
 * (a soft pad stands in for the guitar until its recordings have loaded).
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
    // The chords get a little room too, after their fader so muting them mutes the echo as well.
    const room = getRoom();
    if (room) channels.chords.connect(new tone.Gain(0.25).connect(room));
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
    ride.volume.value = -11;
    hat.volume.value = -14;
    snare.volume.value = -4;
    const bass = new tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 0.3, sustain: 0.6, release: 0.12 },
      filter: { Q: 0.7, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.004, decay: 0.2, sustain: 0.4, release: 0.15, baseFrequency: 160, octaves: 1.6 },
    }).connect(channels.bass);
    bass.volume.value = 0;
    // Until the guitar recordings arrive: a soft, warm pad (no bell-like FM tones).
    const padFilter = new tone.Filter({ type: 'lowpass', frequency: 1400, rolloff: -24 }).connect(channels.chords);
    const pad = new tone.PolySynth(tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 1.2, sustain: 0.2, release: 0.5 },
    }).connect(padFilter);
    pad.maxPolyphony = 16;
    pad.volume.value = -14;
    let guitar: import('tone').Sampler | null = null;
    const withGuitar = () => {
      const b = guitarBuffers();
      if (b && !guitar) {
        guitar = makeGuitarSampler(tone, b, channels.chords, { room: 0, tone: 6000 });
        guitar.volume.value = -6;
      }
    };
    withGuitar();
    if (!guitar) void loadGuitarBuffers()?.then(withGuitar);
    const comp = { pad, guitar: () => guitar };
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
      case 'comp': {
        const g = inst.comp.guitar();
        if (g) {
          // Strum low to high, a few milliseconds per string, like a pick across the strings.
          [...ev.midis]
            .sort((a, b) => a - b)
            .forEach((m, i) => g.triggerAttackRelease(tone.Frequency(m, 'midi').toFrequency(), dur + 0.5, time + i * 0.012, ev.velocity * (0.82 + i * 0.03)));
        } else {
          inst.comp.pad.triggerAttackRelease(
            ev.midis.map((m) => tone.Frequency(m, 'midi').toFrequency()),
            dur,
            time,
            ev.velocity * 0.8,
          );
        }
        break;
      }
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
    this.inst?.comp.pad.releaseAll();
    this.inst?.comp.guitar()?.releaseAll();
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
