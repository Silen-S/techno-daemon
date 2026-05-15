import type { TrackState } from "@/types";

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
  channel: import("tone").Channel;
  delay: import("tone").FeedbackDelay;
  reverb: import("tone").Reverb;
};

export class BeatEngine {
  private Tone: ToneModule | null = null;
  private nodes: SynthNodes | null = null;
  private sequence: import("tone").Sequence<number> | null = null;
  private tracks: TrackState[] = [];
  private step = 0;
  private bar = 0;
  private options: EngineOptions;

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
    const delay = new this.Tone.FeedbackDelay("8n.", 0.22).connect(channel);
    const reverb = new this.Tone.Reverb({ decay: 2.8, wet: 0.14 }).connect(channel);

    const kick = new this.Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.34, sustain: 0.01, release: 0.15 }
    }).connect(channel);

    const snare = new this.Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0.01, release: 0.08 }
    }).connect(reverb);

    const hat = new this.Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.055, release: 0.015 },
      harmonicity: 4.8,
      modulationIndex: 18,
      resonance: 2800,
      octaves: 1.2
    }).connect(channel);
    hat.frequency.value = 240;

    const bass = new this.Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: { Q: 1.4, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.002, decay: 0.11, sustain: 0.18, release: 0.06 },
      filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.18, release: 0.08, baseFrequency: 80, octaves: 2.4 }
    }).connect(delay);

    this.nodes = { kick, snare, hat, bass, channel, delay, reverb };
    this.sequence = new this.Tone.Sequence((time, step) => this.tick(time, step), Array.from({ length: 16 }, (_, i) => i), "16n");
    this.sequence.loop = true;
    this.sequence.start(0);
  }

  update(tracks: TrackState[], bpm: number) {
    this.tracks = tracks;
    if (this.Tone) {
      this.Tone.Transport.bpm.rampTo(bpm, 0.08);
    }
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
    this.sequence?.dispose();
    if (this.nodes) {
      Object.values(this.nodes).forEach((node) => node.dispose());
    }
  }

  private shouldTrigger(track: TrackState, step: number) {
    return !track.muted && !!track.steps[step]?.enabled;
  }

  private tick(time: number, step: number) {
    if (!this.Tone || !this.nodes) {
      return;
    }

    const nodes = this.nodes;
    this.options.onStep(step);
    this.step = step;

    if (step === 0) {
      this.bar += 1;
      this.options.onBar(this.bar);
    }

    this.tracks.forEach((track) => {
      if (!this.shouldTrigger(track, step)) {
        return;
      }

      const velocity = (track.steps[step]?.velocity ?? 0.55) * track.volume;
      const filterTone = Math.round(220 + track.filter * 5200);

      if (track.id === "kick") {
        const note = track.soundId.includes("808") ? "C1" : "C2";
        nodes.kick.triggerAttackRelease(note, "16n", time, velocity);
      }

      if (track.id === "snare") {
        nodes.snare.volume.value = track.soundId.includes("clipped") ? -10 : -13;
        nodes.snare.triggerAttackRelease("16n", time, velocity * 0.72);
      }

      if (track.id === "hat") {
        const frequency = track.soundId.includes("white") ? 360 : 240;
        nodes.hat.frequency.setValueAtTime(frequency, time);
        nodes.hat.triggerAttackRelease(frequency, "32n", time, velocity * 0.54);
      }

      if (track.id === "bass") {
        const notes = ["C2", "C2", "D#2", "C2", "G1", "C2", "A#1", "C2"];
        nodes.bass.filter.frequency.setValueAtTime(filterTone, time);
        nodes.bass.triggerAttackRelease(notes[Math.floor(step / 2) % notes.length], "16n", time, velocity * 0.65);
      }
    });
  }
}
