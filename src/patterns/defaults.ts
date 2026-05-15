import type { AppSnapshot, TrackState } from "@/types";

export const STEPS = 16;

export const createVelocity = (base: number, accents: number[] = []) =>
  Array.from({ length: STEPS }, (_, index) => (accents.includes(index) ? Math.min(base + 0.22, 1) : base));

export const defaultTracks: TrackState[] = [
  {
    id: "kick",
    name: "Kick",
    pattern: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    soundId: "909 solid",
    filter: 0.72,
    density: 0.86,
    velocity: createVelocity(0.78, [0, 8]),
    muted: false,
    mutationEnabled: true
  },
  {
    id: "snare",
    name: "Snare/Clap",
    pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
    soundId: "dry plate",
    filter: 0.58,
    density: 0.54,
    velocity: createVelocity(0.55, [4, 12]),
    muted: false,
    mutationEnabled: true
  },
  {
    id: "hat",
    name: "Hat",
    pattern: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
    soundId: "metal ticks",
    filter: 0.84,
    density: 0.68,
    velocity: createVelocity(0.42, [6, 14]),
    muted: false,
    mutationEnabled: true
  },
  {
    id: "bass",
    name: "Bass",
    pattern: [true, false, false, true, false, false, true, false, true, false, false, true, false, false, false, false],
    soundId: "sine pulse",
    filter: 0.48,
    density: 0.52,
    velocity: createVelocity(0.58, [0, 8]),
    muted: false,
    mutationEnabled: true
  }
];

export const defaultSnapshot: AppSnapshot = {
  bpm: 128,
  tracks: defaultTracks,
  mutationTargets: ["pattern", "filter", "density"],
  mutationInterval: "8",
  intent: "coding",
  moodText: "",
  imageTone: "none"
};
