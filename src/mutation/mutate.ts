import { STEPS } from "@/patterns/defaults";
import type { AppSnapshot, MutationTarget, PresetIntent, TrackState } from "@/types";

const soundPools: Record<TrackState["id"], string[]> = {
  kick: ["909 solid", "808 hollow", "short thud", "rubber low"],
  snare: ["dry plate", "clipped clap", "short noise", "tin hit"],
  hat: ["metal ticks", "thin closed", "white needle", "dust hats"],
  bass: ["sine pulse", "fm knock", "square sub", "cold acid"]
};

const intentAdjustments: Record<PresetIntent, Partial<Record<MutationTarget, number>>> = {
  coding: { density: -0.08, filter: 0.08 },
  relax: { density: -0.18, filter: -0.05 },
  dark: { filter: -0.22, sound: 0.2 },
  cyber: { density: 0.08, velocity: 0.12 }
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const cloneTracks = (tracks: TrackState[]) =>
  tracks.map((track) => ({
    ...track,
    pattern: [...track.pattern],
    velocity: [...track.velocity]
  }));

const euclidean = (hits: number, steps = STEPS) => {
  const pattern = Array.from({ length: steps }, () => false);
  for (let i = 0; i < hits; i += 1) {
    pattern[Math.floor((i * steps) / hits)] = true;
  }
  return pattern;
};

const mutatePattern = (track: TrackState) => {
  const next = [...track.pattern];
  if (track.id === "kick") {
    const candidates = [3, 7, 10, 14, 15];
    const index = pick(candidates);
    next[index] = !next[index];
    next[0] = true;
    return next;
  }

  if (track.id === "hat" && Math.random() > 0.5) {
    return euclidean(pick([5, 6, 7, 9])).map((step, index) => step || (track.pattern[index] && Math.random() > 0.22));
  }

  const index = Math.floor(Math.random() * STEPS);
  next[index] = !next[index];
  return next;
};

const mutateVelocity = (track: TrackState) =>
  track.velocity.map((velocity, index) => {
    if (!track.pattern[index] || Math.random() > 0.35) {
      return velocity;
    }
    return clamp(velocity + (Math.random() - 0.5) * 0.26, 0.18, 0.95);
  });

export const mutateSnapshot = (snapshot: AppSnapshot): AppSnapshot => {
  const tracks = cloneTracks(snapshot.tracks);
  const enabledTracks = tracks.filter((track) => track.mutationEnabled);
  if (enabledTracks.length === 0 || snapshot.mutationTargets.length === 0) {
    return snapshot;
  }

  const target = pick(snapshot.mutationTargets);
  const track = pick(enabledTracks);
  const adjustment = intentAdjustments[snapshot.intent][target] ?? 0;

  if (target === "pattern") {
    track.pattern = mutatePattern(track);
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
    track.pattern = track.pattern.map((step, index) => {
      if (index % 4 === 0 && track.id === "kick") {
        return true;
      }
      if (Math.random() < 0.08) {
        return Math.random() < track.density;
      }
      return step;
    });
  }

  if (target === "velocity") {
    track.velocity = mutateVelocity(track);
  }

  return {
    ...snapshot,
    tracks
  };
};
