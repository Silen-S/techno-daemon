import { STEPS } from "@/patterns/defaults";
import type { AppSnapshot, MutationTarget, PresetIntent, TrackState } from "@/types";

const soundPools: Record<TrackState["id"], string[]> = {
  kick: ["909 solid", "808 hollow", "short thud", "rubber low"],
  snare: ["dry plate", "clipped clap", "short noise", "tin hit"],
  hat: ["metal ticks", "thin closed", "white needle", "dust hats"],
  bass: ["sine pulse", "fm knock", "square sub", "cold acid"],
  synth: ["saw stab", "square lead", "soft pluck", "hoover"]
};

const intentAdjustments: Record<PresetIntent, Partial<Record<MutationTarget, number>>> = {
  coding: { density: -0.08, filter: 0.08 },
  relax: { density: -0.18, filter: -0.05 },
  dark: { filter: -0.22, sound: 0.2 },
  cyber: { density: 0.08, velocity: 0.12 }
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const cloneTracks = (tracks: TrackState[]): TrackState[] =>
  tracks.map((track) => ({
    ...track,
    steps: track.steps.map((step) => ({ ...step, lastMutated: false })),
    lastMutatedTarget: undefined
  }));

const euclidean = (hits: number, steps = STEPS) => {
  const pattern = Array.from({ length: steps }, () => false);
  for (let i = 0; i < hits; i += 1) {
    pattern[Math.floor((i * steps) / hits)] = true;
  }
  return pattern;
};

const mutatePattern = (track: TrackState) => {
  const next = track.steps.map((step) => step.enabled);
  if (track.id === "kick") {
    const candidates = [3, 7, 10, 14, 15];
    const index = pick(candidates);
    next[index] = !next[index];
    next[0] = true;
    return next;
  }

  if (track.id === "hat" && Math.random() > 0.5) {
    return euclidean(pick([5, 6, 7, 9])).map((step, index) => step || (track.steps[index]?.enabled && Math.random() > 0.22));
  }

  const index = Math.floor(Math.random() * STEPS);
  next[index] = !next[index];
  return next;
};

const mutateVelocity = (track: TrackState) =>
  track.steps.map((step) => {
    if (!step.enabled || Math.random() > 0.35) {
      return step;
    }
    return {
      ...step,
      velocity: clamp(step.velocity + (Math.random() - 0.5) * 0.26, 0.18, 0.95),
      lastMutated: true
    };
  });

const applyPattern = (track: TrackState, pattern: boolean[]) => ({
  ...track,
  steps: track.steps.map((step, index) => ({
    ...step,
    enabled: pattern[index] ?? false,
    lastMutated: step.enabled !== (pattern[index] ?? false)
  }))
});

export const mutateSnapshot = (snapshot: AppSnapshot): AppSnapshot | null => {
  const tracks = cloneTracks(snapshot.tracks);
  const enabledTracks = tracks.filter((track) => track.mutationEnabled);
  if (enabledTracks.length === 0 || snapshot.mutationTargets.length === 0) {
    return null;
  }

  const target = pick(snapshot.mutationTargets);
  const track = pick(enabledTracks);
  const adjustment = intentAdjustments[snapshot.intent][target] ?? 0;

  if (target === "pattern") {
    Object.assign(track, applyPattern(track, mutatePattern(track)));
  }

  if (target === "sound") {
    const pool = soundPools[track.id].filter((sound) => sound !== track.soundId);
    track.soundId = pick(pool);
    track.filter = clamp(track.filter + adjustment * 0.4);
  }

  if (target === "filter") {
    track.filter = clamp(track.filter + (Math.random() - 0.5) * 0.22 + adjustment);
  }

  if (target === "density") {
    track.density = clamp(track.density + (Math.random() - 0.5) * 0.2 + adjustment, 0.18, 0.96);
    const pattern = track.steps.map((step, index) => {
      if (index % 4 === 0 && track.id === "kick") {
        return true;
      }
      if (Math.random() < 0.08) {
        return Math.random() < track.density;
      }
      return step.enabled;
    });
    Object.assign(track, applyPattern(track, pattern));
  }

  if (target === "velocity") {
    track.steps = mutateVelocity(track);
  }

  track.lastMutatedTarget = target;

  return {
    ...snapshot,
    tracks
  };
};
