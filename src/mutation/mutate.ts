import { STEPS } from "@/patterns/defaults";
import { MELODY_POOL } from "@/theory/harmony";
import type { AppSnapshot, FeedbackWeights, MutationTarget, PresetIntent, TrackState } from "@/types";

export type MutationResult = {
  snapshot: AppSnapshot;
  target: MutationTarget;
  trackId: TrackState["id"];
};

const soundPools: Record<TrackState["id"], string[]> = {
  kick: ["909 solid", "808 hollow", "short thud", "rubber low"],
  snare: ["dry plate", "clipped clap", "short noise", "tin hit"],
  hat: ["metal ticks", "thin closed", "white needle", "dust hats"],
  bass: ["sine pulse", "fm knock", "square sub", "cold acid"],
  synth: ["saw stab", "square lead", "soft pluck", "hoover"]
};

// 4つ打ちの土台を壊さないためのアンカー(常にONを維持するステップ)
const anchors: Record<TrackState["id"], number[]> = {
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hat: [],
  bass: [0],
  synth: []
};

// Mutationで足し引きしてよいステップの候補(裏拍・シンコペーション位置)
const variationSteps: Record<TrackState["id"], number[]> = {
  kick: [3, 7, 10, 11, 14, 15],
  snare: [2, 7, 10, 15],
  hat: [1, 3, 5, 7, 9, 11, 13, 15],
  bass: [2, 3, 6, 7, 10, 11, 14],
  synth: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]
};

const densityRange: Record<TrackState["id"], [number, number]> = {
  kick: [4, 8],
  snare: [2, 6],
  hat: [3, 10],
  bass: [3, 8],
  synth: [2, 7]
};

const intentAdjustments: Record<PresetIntent, Partial<Record<MutationTarget, number>>> = {
  coding: { density: -0.08, filter: 0.08 },
  relax: { density: -0.18, filter: -0.05 },
  dark: { filter: -0.22, sound: 0.2 },
  cyber: { density: 0.08, velocity: 0.12 }
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

// フィードバック重みに従ってMutation対象を抽選する
const weightedPickTarget = (targets: MutationTarget[], weights: FeedbackWeights) => {
  const entries = targets.map((target) => ({ target, weight: weights[target] ?? 1 }));
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.target;
    }
  }
  return entries[entries.length - 1].target;
};

const cloneTracks = (tracks: TrackState[]): TrackState[] =>
  tracks.map((track) => ({
    ...track,
    steps: track.steps.map((step) => ({ ...step, lastMutated: false })),
    lastMutatedTarget: undefined
  }));

// Bresenham法によるEuclideanリズム。rotateで頭拍からずらして裏拍感を出す
const euclidean = (hits: number, rotate = 0, steps = STEPS) =>
  Array.from({ length: steps }, (_, i) => {
    const index = (i - rotate + steps * 2) % steps;
    return Math.floor(((index + 1) * hits) / steps) - Math.floor((index * hits) / steps) === 1;
  });

const withAnchors = (pattern: boolean[], trackId: TrackState["id"]) =>
  pattern.map((enabled, index) => enabled || anchors[trackId].includes(index));

const enabledPattern = (track: TrackState) => track.steps.map((step) => step.enabled);

// 1ステップだけ足すか引く(アンカーは除外)
const toggleOneStep = (track: TrackState) => {
  const next = enabledPattern(track);
  const candidates = variationSteps[track.id].filter((index) => !anchors[track.id].includes(index));
  if (candidates.length === 0) {
    return next;
  }
  const index = pick(candidates);
  next[index] = !next[index];
  return withAnchors(next, track.id);
};

const mutatePattern = (track: TrackState) => {
  // ハットは時々オフビート主体のEuclideanパターンへ張り替える
  if (track.id === "hat" && Math.random() > 0.6) {
    return euclidean(pick([4, 5, 6, 7, 8]), pick([1, 2]));
  }
  return toggleOneStep(track);
};

// メロディーの1音をペンタトニック内の隣接音へ動かす
const mutateMelody = (track: TrackState) => {
  const enabledIndexes = track.steps.map((step, index) => (step.enabled ? index : -1)).filter((index) => index >= 0);
  if (enabledIndexes.length === 0) {
    return track.steps;
  }
  const target = pick(enabledIndexes);
  return track.steps.map((step, index) => {
    if (index !== target) {
      return step;
    }
    const poolIndex = MELODY_POOL.indexOf(step.note ?? "");
    const nextIndex =
      poolIndex < 0
        ? Math.floor(Math.random() * MELODY_POOL.length)
        : clamp(poolIndex + pick([-1, 1]), 0, MELODY_POOL.length - 1);
    return { ...step, note: MELODY_POOL[nextIndex], lastMutated: true };
  });
};

const mutateVelocity = (track: TrackState) =>
  track.steps.map((step, index) => {
    if (!step.enabled || Math.random() > 0.35) {
      return step;
    }
    // 表拍は強く・裏拍は弱くなる方向へ寄せて、グルーヴが崩れないようにする
    const bias = index % 4 === 0 ? 0.05 : -0.04;
    return {
      ...step,
      velocity: clamp(step.velocity + (Math.random() - 0.5) * 0.18 + bias, 0.18, 0.95),
      lastMutated: true
    };
  });

const applyPattern = (track: TrackState, pattern: boolean[]) => ({
  ...track,
  steps: track.steps.map((step, index) => {
    const enabled = pattern[index] ?? false;
    // ノートを持たないステップをONにする場合はペンタトニックから補う
    const note = track.id === "synth" && enabled && !step.note ? pick(MELODY_POOL) : step.note;
    return {
      ...step,
      enabled,
      ...(note ? { note } : {}),
      lastMutated: step.enabled !== enabled
    };
  })
});

// densityをEuclideanのヒット数へ写像してパターンを組み直す
const applyDensity = (track: TrackState) => {
  const [min, max] = densityRange[track.id];
  const hits = Math.round(min + (max - min) * track.density);
  const rotate = track.id === "hat" ? 2 : 0;
  return withAnchors(euclidean(hits, rotate), track.id);
};

export const mutateSnapshot = (snapshot: AppSnapshot, feedback: FeedbackWeights = {}): MutationResult | null => {
  const tracks = cloneTracks(snapshot.tracks);
  const enabledTracks = tracks.filter((track) => track.mutationEnabled);
  if (enabledTracks.length === 0 || snapshot.mutationTargets.length === 0) {
    return null;
  }

  const target = weightedPickTarget(snapshot.mutationTargets, feedback);
  const track = pick(enabledTracks);
  const adjustment = intentAdjustments[snapshot.intent][target] ?? 0;

  if (target === "pattern") {
    // シンセはリズム変更とメロディー変更を半々で行う
    if (track.id === "synth" && Math.random() > 0.5) {
      track.steps = mutateMelody(track);
    } else {
      Object.assign(track, applyPattern(track, mutatePattern(track)));
    }
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
    Object.assign(track, applyPattern(track, applyDensity(track)));
  }

  if (target === "velocity") {
    track.steps = mutateVelocity(track);
  }

  track.lastMutatedTarget = target;

  return {
    snapshot: {
      ...snapshot,
      tracks
    },
    target,
    trackId: track.id
  };
};
