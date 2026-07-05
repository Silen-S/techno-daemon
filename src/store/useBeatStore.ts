"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSteps, defaultSnapshot, defaultTracks, STEPS } from "@/patterns/defaults";
import { mutateSnapshot } from "@/mutation/mutate";
import type { AppSnapshot, FeedbackWeights, ImageTone, LastMutation, MutationInterval, MutationTarget, PresetIntent, StepState, TrackId, TrackState } from "@/types";

// Accept/Revertの回数に応じてMutation対象の選択確率を学習する係数
const FEEDBACK_UP = 1.25;
const FEEDBACK_DOWN = 0.75;
const FEEDBACK_MIN = 0.25;
const FEEDBACK_MAX = 4;

const adjustFeedback = (feedback: FeedbackWeights, lastMutation: LastMutation | null, factor: number): FeedbackWeights => {
  if (!lastMutation) {
    return feedback;
  }
  const current = feedback[lastMutation.target] ?? 1;
  return {
    ...feedback,
    [lastMutation.target]: Math.max(FEEDBACK_MIN, Math.min(FEEDBACK_MAX, current * factor))
  };
};

type BeatStore = AppSnapshot & {
  isPlaying: boolean;
  activeStep: number;
  pending: AppSnapshot | null;
  history: AppSnapshot[];
  feedback: FeedbackWeights;
  lastMutation: LastMutation | null;
  bar: number;
  setBar: (bar: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setActiveStep: (activeStep: number) => void;
  setBpm: (bpm: number) => void;
  setIntent: (intent: PresetIntent) => void;
  setMoodText: (text: string) => void;
  setImageTone: (tone: ImageTone) => void;
  setMutationInterval: (interval: MutationInterval) => void;
  toggleMutationTarget: (target: MutationTarget) => void;
  toggleStep: (trackId: TrackId, index: number) => void;
  setTrackVolume: (trackId: TrackId, volume: number) => void;
  toggleTrackMute: (trackId: TrackId) => void;
  toggleTrackMutation: (trackId: TrackId) => void;
  requestMutation: () => void;
  acceptMutation: () => void;
  revertMutation: () => void;
  reset: () => void;
};

const snapshotFromState = (state: BeatStore): AppSnapshot => ({
  bpm: state.bpm,
  tracks: state.tracks,
  mutationTargets: state.mutationTargets,
  mutationInterval: state.mutationInterval,
  intent: state.intent,
  moodText: state.moodText,
  imageTone: state.imageTone
});

type LegacyTrackState = Omit<TrackState, "steps" | "volume"> & {
  pattern?: boolean[];
  velocity?: number[];
  steps?: StepState[];
  volume?: number;
};

const normalizeTrack = (track: LegacyTrackState): TrackState => {
  const { pattern, velocity, steps, volume, ...rest } = track;
  return {
    ...rest,
    volume: volume ?? 0.8,
    steps: steps?.length === STEPS ? steps.map((step) => ({ ...step })) : createSteps(pattern ?? [], velocity ?? [])
  };
};

const normalizeSnapshot = (snapshot: AppSnapshot): AppSnapshot => {
  const tracks = snapshot.tracks.map((track) => normalizeTrack(track as LegacyTrackState));
  // 旧バージョンの保存データに存在しないトラック(synthなど)をデフォルトから補完する
  const missing = defaultTracks.filter((track) => !tracks.some((item) => item.id === track.id));
  return {
    ...snapshot,
    tracks: [...tracks, ...missing.map((track) => normalizeTrack(track as LegacyTrackState))]
  };
};

const intentFromText = (text: string): PresetIntent | null => {
  const value = text.toLowerCase();
  if (value.includes("relax") || value.includes("ambient")) {
    return "relax";
  }
  if (value.includes("dark") || value.includes("lowpass")) {
    return "dark";
  }
  if (value.includes("cyber") || value.includes("distortion")) {
    return "cyber";
  }
  if (value.includes("coding") || value.includes("mechanical") || value.includes("work")) {
    return "coding";
  }
  return null;
};

export const useBeatStore = create<BeatStore>()(
  persist(
    (set, get) => ({
      ...defaultSnapshot,
      isPlaying: false,
      activeStep: -1,
      pending: null,
      history: [],
      feedback: {},
      lastMutation: null,
      bar: 0,
      setBar: (bar) => set({ bar }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setActiveStep: (activeStep) => set({ activeStep }),
      setBpm: (bpm) => set({ bpm: Math.max(80, Math.min(150, Math.round(bpm))) }),
      setIntent: (intent) => set({ intent }),
      setMoodText: (moodText) =>
        set((state) => {
          const nextIntent = intentFromText(moodText);
          return {
            moodText,
            intent: nextIntent ?? state.intent
          };
        }),
      setImageTone: (imageTone) =>
        set((state) => ({
          imageTone,
          tracks: state.tracks.map((track) => {
            if (imageTone === "blue") {
              return { ...track, filter: Math.min(track.filter + 0.08, 1), soundId: track.id === "hat" ? "white needle" : track.soundId };
            }
            if (imageTone === "red") {
              return { ...track, density: Math.min(track.density + 0.06, 1), soundId: track.id === "bass" ? "fm knock" : track.soundId };
            }
            if (imageTone === "dark") {
              return { ...track, filter: Math.max(track.filter - 0.18, 0), density: Math.max(track.density - 0.05, 0.15) };
            }
            if (imageTone === "bright") {
              return { ...track, filter: Math.min(track.filter + 0.18, 1), density: Math.min(track.density + 0.04, 1) };
            }
            return track;
          })
        })),
      setMutationInterval: (mutationInterval) => set({ mutationInterval }),
      toggleMutationTarget: (target) =>
        set((state) => {
          const hasTarget = state.mutationTargets.includes(target);
          return {
            mutationTargets: hasTarget
              ? state.mutationTargets.filter((item) => item !== target)
              : [...state.mutationTargets, target]
          };
        }),
      toggleStep: (trackId, index) =>
        set((state) => ({
          tracks: state.tracks.map((track) =>
            track.id === trackId
              ? {
                  ...track,
                  steps: track.steps.map((step, stepIndex) =>
                    stepIndex === index ? { ...step, enabled: !step.enabled } : step
                  )
                }
              : track
          ),
          pending: null
        })),
      setTrackVolume: (trackId, volume) =>
        set((state) => ({
          tracks: state.tracks.map((track) =>
            track.id === trackId ? { ...track, volume: Math.max(0, Math.min(1, volume)) } : track
          )
        })),
      toggleTrackMute: (trackId) =>
        set((state) => ({
          tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, muted: !track.muted } : track))
        })),
      toggleTrackMutation: (trackId) =>
        set((state) => ({
          tracks: state.tracks.map((track) =>
            track.id === trackId ? { ...track, mutationEnabled: !track.mutationEnabled } : track
          )
        })),
      requestMutation: () =>
        set((state) => {
          if (state.pending) {
            return {};
          }

          const current = normalizeSnapshot(snapshotFromState(state));
          const result = mutateSnapshot(current, state.feedback);
          if (!result) {
            return {};
          }
          return {
            ...result.snapshot,
            pending: current,
            lastMutation: { target: result.target, trackId: result.trackId },
            history: [current, ...state.history].slice(0, 8)
          };
        }),
      acceptMutation: () =>
        set((state) => ({
          pending: null,
          feedback: adjustFeedback(state.feedback, state.lastMutation, FEEDBACK_UP)
        })),
      revertMutation: () =>
        set((state) => {
          if (!state.pending) {
            return {};
          }
          return {
            ...state.pending,
            pending: null,
            feedback: adjustFeedback(state.feedback, state.lastMutation, FEEDBACK_DOWN)
          };
        }),
      reset: () =>
        set({
          ...normalizeSnapshot(defaultSnapshot),
          pending: null,
          history: [],
          activeStep: -1,
          lastMutation: null
        })
    }),
    {
      name: "nullbeat-state",
      partialize: (state) => ({
        bpm: state.bpm,
        tracks: state.tracks,
        mutationTargets: state.mutationTargets,
        mutationInterval: state.mutationInterval,
        intent: state.intent,
        moodText: state.moodText,
        imageTone: state.imageTone,
        feedback: state.feedback
      }),
      merge: (persisted, current) => {
        const next = {
          ...current,
          ...(persisted as Partial<BeatStore>)
        };
        return normalizeSnapshot(next as BeatStore) as BeatStore;
      }
    }
  )
);
