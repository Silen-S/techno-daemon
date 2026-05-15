export type TrackId = "kick" | "snare" | "hat" | "bass";

export type MutationTarget = "pattern" | "sound" | "filter" | "density" | "velocity";
export type MutationInterval = "manual" | "4" | "8" | "16";

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
