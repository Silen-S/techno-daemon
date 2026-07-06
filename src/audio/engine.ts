import { bassNoteForStep, chordForBar } from "@/theory/harmony";
import type { TrackId, TrackState } from "@/types";

type ToneModule = typeof import("tone");

type EngineOptions = {
  onStep: (step: number) => void;
  onBar: (bar: number) => void;
};

type SynthNodes = {
  kick: import("tone").MembraneSynth;
  snare: import("tone").NoiseSynth;
  hat: import("tone").MetalSynth;
  bass: import("tone").MonoSynth;
  synth: import("tone").MonoSynth;
  filters: Record<TrackId, import("tone").Filter>;
  channel: import("tone").Channel;
  delay: import("tone").FeedbackDelay;
  reverb: import("tone").Reverb;
};

type KickPreset = { pitchDecay: number; octaves: number; decay: number; note: string };
type SnarePreset = { noiseType: "white" | "pink" | "brown"; decay: number; volume: number };
type HatPreset = { frequency: number; decay: number };
type BassPreset = { oscillator: "sine" | "square" | "sawtooth" | "fmsquare"; q: number };

const kickPresets: Record<string, KickPreset> = {
  "909 solid": { pitchDecay: 0.025, octaves: 6, decay: 0.34, note: "C2" },
  "808 hollow": { pitchDecay: 0.06, octaves: 7, decay: 0.5, note: "C1" },
  "short thud": { pitchDecay: 0.015, octaves: 4, decay: 0.18, note: "C2" },
  "rubber low": { pitchDecay: 0.09, octaves: 5, decay: 0.42, note: "A1" }
};

// ノイズ源はローパス後のピークが低いため、他トラックより高めの音量に設定する
const snarePresets: Record<string, SnarePreset> = {
  "dry plate": { noiseType: "white", decay: 0.12, volume: 14 },
  "clipped clap": { noiseType: "pink", decay: 0.09, volume: 17 },
  "short noise": { noiseType: "white", decay: 0.06, volume: 15 },
  "tin hit": { noiseType: "brown", decay: 0.15, volume: 16 }
};

const hatPresets: Record<string, HatPreset> = {
  "metal ticks": { frequency: 240, decay: 0.055 },
  "thin closed": { frequency: 320, decay: 0.035 },
  "white needle": { frequency: 380, decay: 0.05 },
  "dust hats": { frequency: 200, decay: 0.09 }
};

const bassPresets: Record<string, BassPreset> = {
  "sine pulse": { oscillator: "sine", q: 1.2 },
  "fm knock": { oscillator: "fmsquare", q: 1.6 },
  "square sub": { oscillator: "square", q: 1.4 },
  "cold acid": { oscillator: "sawtooth", q: 6 }
};

type LeadPreset = { oscillator: "sawtooth" | "square" | "triangle" | "fatsawtooth"; decay: number; sustain: number };

const leadPresets: Record<string, LeadPreset> = {
  "saw stab": { oscillator: "sawtooth", decay: 0.18, sustain: 0.12 },
  "square lead": { oscillator: "square", decay: 0.16, sustain: 0.3 },
  "soft pluck": { oscillator: "triangle", decay: 0.12, sustain: 0.02 },
  hoover: { oscillator: "fatsawtooth", decay: 0.22, sustain: 0.25 }
};

// filter値(0..1)を対数的にカットオフ周波数へ写像する
const filterFrequency = (value: number, min: number, max: number) =>
  min * Math.pow(max / min, Math.max(0, Math.min(1, value)));

export class BeatEngine {
  private Tone: ToneModule | null = null;
  private nodes: SynthNodes | null = null;
  private sequence: import("tone").Sequence<number> | null = null;
  private tracks: TrackState[] = [];
  private bpm = 128;
  private step = 0;
  private bar = 0;
  private options: EngineOptions;
  private appliedSoundIds: Partial<Record<TrackId, string>> = {};

  constructor(options: EngineOptions) {
    this.options = options;
  }

  async init() {
    if (this.Tone && this.nodes) {
      return;
    }

    this.Tone = await import("tone");
    await this.Tone.start();

    const channel = new this.Tone.Channel({ volume: -8 }).toDestination();
    // wetを明示しないと1.0(ディレイ音のみ)になり、接続先の音が丸ごと遅れて聞こえる
    const delay = new this.Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.22, wet: 0.22 }).connect(channel);
    const reverb = new this.Tone.Reverb({ decay: 2.8, wet: 0.14 }).connect(channel);
    await reverb.ready;

    const filters: Record<TrackId, import("tone").Filter> = {
      kick: new this.Tone.Filter({ type: "lowpass", frequency: 4000, rolloff: -12 }).connect(channel),
      snare: new this.Tone.Filter({ type: "lowpass", frequency: 4000, rolloff: -12 }).connect(reverb),
      hat: new this.Tone.Filter({ type: "lowpass", frequency: 8000, rolloff: -12 }).connect(channel),
      bass: new this.Tone.Filter({ type: "lowpass", frequency: 1200, rolloff: -24 }).connect(delay),
      synth: new this.Tone.Filter({ type: "lowpass", frequency: 2600, rolloff: -12 }).connect(delay)
    };

    const kick = new this.Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.34, sustain: 0.01, release: 0.15 }
    }).connect(filters.kick);

    const snare = new this.Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0.01, release: 0.08 }
    }).connect(filters.snare);

    const hat = new this.Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.055, release: 0.015 },
      harmonicity: 4.8,
      modulationIndex: 18,
      resonance: 2800,
      octaves: 1.2
    }).connect(filters.hat);
    hat.frequency.value = 240;

    const bass = new this.Tone.MonoSynth({
      volume: 4,
      oscillator: { type: "square" },
      filter: { Q: 1.4, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.002, decay: 0.11, sustain: 0.18, release: 0.06 },
      filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.18, release: 0.08, baseFrequency: 80, octaves: 2.4 }
    }).connect(filters.bass);

    const synth = new this.Tone.MonoSynth({
      volume: 4,
      oscillator: { type: "sawtooth" },
      filter: { Q: 1.1, type: "lowpass", rolloff: -12 },
      envelope: { attack: 0.004, decay: 0.18, sustain: 0.12, release: 0.12 },
      filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.3, release: 0.14, baseFrequency: 400, octaves: 3 }
    }).connect(filters.synth);

    this.nodes = { kick, snare, hat, bass, synth, filters, channel, delay, reverb };
    this.appliedSoundIds = {};
    // 開発時の出力確認用にToneモジュールを公開する
    (globalThis as { __toneDebug?: ToneModule }).__toneDebug = this.Tone;
    this.Tone.Transport.bpm.value = this.bpm;
    this.applyTrackSettings();
    this.sequence = new this.Tone.Sequence((time, step) => this.tick(time, step), Array.from({ length: 16 }, (_, i) => i), "16n");
    this.sequence.loop = true;
    this.sequence.start(0);
  }

  update(tracks: TrackState[], bpm: number) {
    this.tracks = tracks;
    if (this.Tone && this.bpm !== bpm) {
      this.Tone.Transport.bpm.rampTo(bpm, 0.08);
    }
    this.bpm = bpm;
    this.applyTrackSettings();
  }

  async play() {
    await this.init();
    this.Tone?.Transport.start();
  }

  stop() {
    if (this.Tone) {
      this.Tone.Transport.stop();
      this.Tone.Transport.position = 0;
    }
    this.step = 0;
    this.bar = 0;
    this.options.onStep(-1);
  }

  dispose() {
    if (this.Tone) {
      this.Tone.Transport.stop();
      this.Tone.Transport.cancel();
    }
    this.sequence?.dispose();
    this.sequence = null;
    if (this.nodes) {
      const { filters, ...rest } = this.nodes;
      Object.values(rest).forEach((node) => node.dispose());
      Object.values(filters).forEach((node) => node.dispose());
      this.nodes = null;
    }
  }

  // soundId・filterの変更をシンセパラメータへ反映する
  private applyTrackSettings() {
    const nodes = this.nodes;
    if (!nodes) {
      return;
    }

    this.tracks.forEach((track) => {
      if (track.id === "kick") {
        nodes.filters.kick.frequency.rampTo(filterFrequency(track.filter, 320, 9000), 0.06);
        const preset = kickPresets[track.soundId];
        if (preset && this.appliedSoundIds.kick !== track.soundId) {
          nodes.kick.set({ pitchDecay: preset.pitchDecay, octaves: preset.octaves, envelope: { decay: preset.decay } });
          this.appliedSoundIds.kick = track.soundId;
        }
      }

      if (track.id === "snare") {
        nodes.filters.snare.frequency.rampTo(filterFrequency(track.filter, 700, 11000), 0.06);
        const preset = snarePresets[track.soundId];
        if (preset && this.appliedSoundIds.snare !== track.soundId) {
          nodes.snare.set({ noise: { type: preset.noiseType }, envelope: { decay: preset.decay } });
          nodes.snare.volume.value = preset.volume;
          this.appliedSoundIds.snare = track.soundId;
        }
      }

      if (track.id === "hat") {
        nodes.filters.hat.frequency.rampTo(filterFrequency(track.filter, 1500, 14000), 0.06);
        const preset = hatPresets[track.soundId];
        if (preset && this.appliedSoundIds.hat !== track.soundId) {
          nodes.hat.set({ envelope: { decay: preset.decay } });
          nodes.hat.frequency.value = preset.frequency;
          this.appliedSoundIds.hat = track.soundId;
        }
      }

      if (track.id === "bass") {
        nodes.filters.bass.frequency.rampTo(filterFrequency(track.filter, 90, 3200), 0.06);
        const preset = bassPresets[track.soundId];
        if (preset && this.appliedSoundIds.bass !== track.soundId) {
          nodes.bass.set({ oscillator: { type: preset.oscillator } });
          nodes.filters.bass.Q.value = preset.q;
          this.appliedSoundIds.bass = track.soundId;
        }
      }

      if (track.id === "synth") {
        nodes.filters.synth.frequency.rampTo(filterFrequency(track.filter, 400, 9000), 0.06);
        const preset = leadPresets[track.soundId];
        if (preset && this.appliedSoundIds.synth !== track.soundId) {
          nodes.synth.set({
            oscillator: { type: preset.oscillator },
            envelope: { decay: preset.decay, sustain: preset.sustain }
          });
          this.appliedSoundIds.synth = track.soundId;
        }
      }
    });
  }

  private shouldTrigger(track: TrackState, step: number) {
    return !track.muted && !!track.steps[step]?.enabled;
  }

  private tick(time: number, step: number) {
    if (!this.Tone || !this.nodes) {
      return;
    }

    const nodes = this.nodes;
    this.step = step;

    if (step === 0) {
      this.bar += 1;
      this.options.onBar(this.bar);
    }

    // シーケンサーのコールバックは先読みで早めに呼ばれるため、
    // 表示更新は実際の発音時刻に合わせて行う
    this.Tone.Draw.schedule(() => this.options.onStep(step), time);

    this.tracks.forEach((track) => {
      if (!this.shouldTrigger(track, step)) {
        return;
      }

      const velocity = (track.steps[step]?.velocity ?? 0.55) * track.volume;

      if (track.id === "kick") {
        const note = kickPresets[track.soundId]?.note ?? "C2";
        nodes.kick.triggerAttackRelease(note, "16n", time, velocity);
      }

      if (track.id === "snare") {
        nodes.snare.triggerAttackRelease("16n", time, velocity * 0.9);
      }

      if (track.id === "hat") {
        const frequency = hatPresets[track.soundId]?.frequency ?? 240;
        nodes.hat.triggerAttackRelease(frequency, "32n", time, velocity * 0.54);
      }

      if (track.id === "bass") {
        const chord = chordForBar(Math.max(this.bar, 1));
        nodes.bass.triggerAttackRelease(bassNoteForStep(chord, step), "16n", time, velocity * 0.9);
      }

      if (track.id === "synth") {
        const note = track.steps[step]?.note ?? "A3";
        nodes.synth.triggerAttackRelease(note, "16n", time, velocity * 0.85);
      }
    });
  }
}
