import { STEPS } from "@/patterns/defaults";
import type { StepState, TrackState } from "@/types";

// パターンのループ長(小節)。1小節=16ステップ。
export const LOOP_BAR_OPTIONS = [1, 2, 4] as const;
export const DEFAULT_LOOP_BARS = 1;

export const stepsForBars = (bars: number) => bars * STEPS;

// ループ長として妥当な値に丸める
export const normalizeLoopBars = (bars: number | undefined) =>
  LOOP_BAR_OPTIONS.includes(bars as (typeof LOOP_BAR_OPTIONS)[number]) ? (bars as number) : DEFAULT_LOOP_BARS;

// ステップ配列を指定小節数に合わせる。
// 伸ばすときは既存のループを繰り返して複製し、縮めるときは先頭の小節だけ残す。
export const resizeSteps = (steps: StepState[], targetBars: number): StepState[] => {
  const target = stepsForBars(targetBars);
  if (steps.length === 0) {
    return Array.from({ length: target }, () => ({ enabled: false, velocity: 0.5 }));
  }
  if (steps.length === target) {
    return steps.map((step) => ({ ...step }));
  }
  if (steps.length > target) {
    return steps.slice(0, target).map((step) => ({ ...step }));
  }
  return Array.from({ length: target }, (_, index) => ({ ...steps[index % steps.length] }));
};

export const resizeTrackSteps = (track: TrackState, targetBars: number): TrackState => ({
  ...track,
  steps: resizeSteps(track.steps, targetBars)
});

// 絶対ステップ番号が属する小節(0始まり)
export const barOfIndex = (index: number) => Math.floor(index / STEPS);
