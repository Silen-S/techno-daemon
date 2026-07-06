import { densityRange, euclidean, soundPools, withAnchors } from "@/mutation/mutate";
import { STEPS } from "@/patterns/defaults";
import { melodyPoolFor } from "@/theory/harmony";
import type { AppSnapshot, TrackId, TrackState } from "@/types";

// 曲調を大きく変えるための「目標アレンジ」と、
// 再生を止めずに1小節ずつ目標へ近づけるモーフ処理。

export const MORPH_BARS = 16;

export type MorphState = {
  target: AppSnapshot;
  totalBars: number;
  remainingBars: number;
  // トラックごとに音色を切り替える小節(進行中の何小節目か)
  soundSwitchBars: Record<TrackId, number>;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

// スケールプール内のランダムウォークでフレーズを作る
const generateMelody = (pool: string[]): string[] => {
  let index = Math.floor(Math.random() * pool.length);
  return Array.from({ length: STEPS }, () => {
    index = clamp(index + pick([-2, -1, -1, 0, 1, 1, 2]), 0, pool.length - 1);
    return pool[index];
  });
};

const generateTrack = (track: TrackState, pool: string[]): TrackState => {
  const density = clamp(randomBetween(0.3, 0.8), 0.18, 0.96);
  const [min, max] = densityRange[track.id];
  const hits = Math.round(min + (max - min) * density);
  const rotate = track.id === "hat" ? pick([1, 2]) : 0;
  const pattern = withAnchors(euclidean(hits, rotate), track.id);
  const notes = track.id === "synth" ? generateMelody(pool) : null;
  const baseVelocity = randomBetween(0.42, 0.68);

  return {
    ...track,
    soundId: pick(soundPools[track.id].filter((sound) => sound !== track.soundId)),
    filter: clamp(randomBetween(0.3, 0.85)),
    density,
    steps: track.steps.map((step, index) => ({
      ...step,
      enabled: pattern[index],
      velocity: clamp(index % 4 === 0 ? baseVelocity + 0.18 : baseVelocity + randomBetween(-0.08, 0.08), 0.18, 0.95),
      ...(notes ? { note: notes[index] } : {}),
      lastMutated: false
    }))
  };
};

export const generateArrangement = (snapshot: AppSnapshot): AppSnapshot => {
  const pool = melodyPoolFor(snapshot.intent);
  return {
    ...snapshot,
    tracks: snapshot.tracks.map((track) => generateTrack(track, pool))
  };
};

export const createMorph = (snapshot: AppSnapshot): MorphState => ({
  target: generateArrangement(snapshot),
  totalBars: MORPH_BARS,
  remainingBars: MORPH_BARS,
  soundSwitchBars: Object.fromEntries(
    snapshot.tracks.map((track) => [track.id, 1 + Math.floor(Math.random() * MORPH_BARS)])
  ) as Record<TrackId, number>
});

// 1小節ぶんモーフを進める。数値は残り小節数で線形補間し、
// ステップの差分は残り小節数で割った数だけランダムに反映する
export const morphTracks = (tracks: TrackState[], morph: MorphState): TrackState[] => {
  const remaining = morph.remainingBars;
  const currentBarIndex = morph.totalBars - remaining + 1;

  return tracks.map((track) => {
    const target = morph.target.tracks.find((item) => item.id === track.id);
    if (!target) {
      return track;
    }

    const steps = track.steps.map((step) => ({ ...step, lastMutated: false }));

    // ON/OFFが目標と異なるステップからランダムに数個を反映
    const diffIndexes = steps
      .map((step, index) => (step.enabled !== (target.steps[index]?.enabled ?? false) ? index : -1))
      .filter((index) => index >= 0)
      .sort(() => Math.random() - 0.5);
    const flips = Math.ceil(diffIndexes.length / remaining);
    diffIndexes.slice(0, flips).forEach((index) => {
      const targetStep = target.steps[index];
      steps[index] = {
        ...steps[index],
        enabled: targetStep?.enabled ?? false,
        ...(targetStep?.note ? { note: targetStep.note } : {}),
        lastMutated: true
      };
    });

    // ノートだけ異なるステップも徐々に置き換える
    if (track.id === "synth") {
      const noteDiffs = steps
        .map((step, index) => (step.note !== target.steps[index]?.note ? index : -1))
        .filter((index) => index >= 0)
        .sort(() => Math.random() - 0.5);
      const noteChanges = Math.ceil(noteDiffs.length / remaining);
      noteDiffs.slice(0, noteChanges).forEach((index) => {
        const note = target.steps[index]?.note;
        if (note) {
          steps[index] = { ...steps[index], note, lastMutated: steps[index].lastMutated || steps[index].enabled };
        }
      });
    }

    // ベロシティと連続値は線形に寄せる
    const lerp = (from: number, to: number) => from + (to - from) / remaining;
    steps.forEach((step, index) => {
      const targetVelocity = target.steps[index]?.velocity ?? step.velocity;
      steps[index] = { ...step, velocity: lerp(step.velocity, targetVelocity) };
    });

    return {
      ...track,
      soundId: currentBarIndex === morph.soundSwitchBars[track.id] ? target.soundId : track.soundId,
      filter: lerp(track.filter, target.filter),
      density: lerp(track.density, target.density),
      steps
    };
  });
};
