export type TrackId = "kick" | "snare" | "hat" | "bass" | "synth";

export type MutationTarget = "pattern" | "sound" | "filter" | "density" | "velocity";
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

export type PresetIntent = "coding" | "relax" | "dark" | "cyber";
export type ImageTone = "none" | "blue" | "red" | "dark" | "bright";

export type AppSnapshot = {
  bpm: number;
  tracks: TrackState[];
  mutationTargets: MutationTarget[];
  mutationInterval: MutationInterval;
  intent: PresetIntent;
  moodText: string;
  imageTone: ImageTone;
};
