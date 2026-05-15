export type TrackId = "kick" | "snare" | "hat" | "bass";

export type MutationTarget = "pattern" | "sound" | "filter" | "density" | "velocity";
export type MutationInterval = "manual" | "4" | "8" | "16";

export type TrackState = {
  id: TrackId;
  name: string;
  pattern: boolean[];
  soundId: string;
  filter: number;
  density: number;
  velocity: number[];
  muted: boolean;
  mutationEnabled: boolean;
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
