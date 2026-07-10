export type TrackId = "kick" | "snare" | "hat" | "bass" | "synth";

export type MutationTarget = "pattern" | "sound" | "effect" | "density" | "velocity";

// 変化対象になるエフェクト。filterは従来のローパス、
// delay/reverbは共有センド、残りはトラック毎のインサート
export type EffectId =
  | "filter"
  | "delay"
  | "reverb"
  | "distortion"
  | "bitcrusher"
  | "chorus"
  | "phaser"
  | "tremolo"
  | "autofilter"
  | "autopanner";

// filter以外のエフェクトはすべてトラック毎のインサートとして扱う
export type InsertEffectId = Exclude<EffectId, "filter">;
// filter以外のエフェクトのかかり具合(0..1)
export type TrackEffects = Partial<Record<InsertEffectId, number>>;
export type MutationInterval = "manual" | "4" | "8" | "16";
// Mutation後に自動でAcceptするまでのループ(小節)数
export type AutoAcceptSetting = "off" | "2" | "4" | "8";

export type StepState = {
  enabled: boolean;
  velocity: number;
  accent?: boolean;
  note?: string;
  length?: string;
  lastMutated?: boolean;
  locked?: boolean;
};

export type TrackState = {
  id: TrackId;
  name: string;
  soundId: string;
  filter: number;
  effects: TrackEffects;
  density: number;
  volume: number;
  muted: boolean;
  mutationEnabled: boolean;
  lastMutatedTarget?: MutationTarget;
  steps: StepState[];
};

// Accept/Revertのフィードバックから学習する、Mutation対象ごとの選択重み
export type FeedbackWeights = Partial<Record<MutationTarget, number>>;

export type LastMutation = {
  target: MutationTarget;
  trackId: TrackId;
};

export type PresetIntent =
  | "coding"
  | "relax"
  | "dark"
  | "cyber"
  | "hypnotic"
  | "acid"
  | "dub"
  | "euphoric"
  | "industrial"
  | "dreamy";
export type ImageTone = "none" | "blue" | "red" | "dark" | "bright";

export type AppSnapshot = {
  bpm: number;
  tracks: TrackState[];
  mutationTargets: MutationTarget[];
  mutationInterval: MutationInterval;
  intent: PresetIntent;
  moodText: string;
  imageTone: ImageTone;
  // 現在の雰囲気の中で選択中のコード進行の番号
  progressionIndex: number;
  // リードシンセで連続する同音を1つの長い音として発音する
  tieSynth: boolean;
  // パターンのループ長(小節数)。ステップ配列は loopBars * 16 個になる
  loopBars: number;
};
