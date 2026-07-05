import type { AppSnapshot, StepState, TrackState } from "@/types";

export const STEPS = 16;

export const createVelocity = (base: number, accents: number[] = []) =>
  Array.from({ length: STEPS }, (_, index) => (accents.includes(index) ? Math.min(base + 0.22, 1) : base));

export const createSteps = (pattern: boolean[], velocity: number[], notes?: (string | undefined)[]): StepState[] =>
  Array.from({ length: STEPS }, (_, index) => ({
    enabled: pattern[index] ?? false,
    velocity: velocity[index] ?? 0.5,
    ...(notes?.[index] ? { note: notes[index] } : {})
  }));

export const defaultTracks: TrackState[] = [
  {
    id: "kick",
    name: "Kick",
    soundId: "909 solid",
    filter: 0.72,
    density: 0.86,
    volume: 0.9,
    muted: false,
    mutationEnabled: true,
    steps: createSteps(
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      createVelocity(0.78, [0, 8])
    )
  },
  {
    id: "snare",
    name: "Snare/Clap",
    soundId: "dry plate",
    filter: 0.58,
    density: 0.54,
    volume: 0.76,
    muted: false,
    mutationEnabled: true,
    steps: createSteps(
      [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
      createVelocity(0.55, [4, 12])
    )
  },
  {
    id: "hat",
    name: "Hat",
    soundId: "metal ticks",
    filter: 0.84,
    density: 0.68,
    volume: 0.7,
    muted: false,
    mutationEnabled: true,
    steps: createSteps(
      [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
      createVelocity(0.42, [6, 14])
    )
  },
  {
    id: "bass",
    name: "Bass",
    soundId: "sine pulse",
    filter: 0.48,
    density: 0.52,
    volume: 0.82,
    muted: false,
    mutationEnabled: true,
    steps: createSteps(
      [true, false, false, true, false, false, true, false, true, false, false, true, false, false, false, false],
      createVelocity(0.58, [0, 8])
    )
  },
  {
    id: "synth",
    name: "Synth",
    soundId: "saw stab",
    filter: 0.62,
    density: 0.38,
    volume: 0.68,
    muted: false,
    mutationEnabled: true,
    steps: createSteps(
      [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false],
      createVelocity(0.5, [0, 6]),
      // Aマイナーペンタトニック内のフレーズ。OFFのステップにも音を持たせ、ONにした時に破綻しないようにする
      ["E4", "D4", "C4", "G4", "E4", "D4", "A4", "G4", "E4", "D4", "C4", "D4", "E4", "G4", "C4", "D4"]
    )
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
