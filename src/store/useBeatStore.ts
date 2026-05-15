"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultSnapshot } from "@/patterns/defaults";
import { mutateSnapshot } from "@/mutation/mutate";
import type { AppSnapshot, ImageTone, MutationInterval, MutationTarget, PresetIntent, TrackId } from "@/types";

type BeatStore = AppSnapshot & {
  isPlaying: boolean;
  activeStep: number;
  pending: AppSnapshot | null;
  history: AppSnapshot[];
  setPlaying: (isPlaying: boolean) => void;
  setActiveStep: (activeStep: number) => void;
  setBpm: (bpm: number) => void;
  setIntent: (intent: PresetIntent) => void;
  setMoodText: (text: string) => void;
  setImageTone: (tone: ImageTone) => void;
  setMutationInterval: (interval: MutationInterval) => void;
  toggleMutationTarget: (target: MutationTarget) => void;
  toggleStep: (trackId: TrackId, index: number) => void;
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
                  pattern: track.pattern.map((step, stepIndex) => (stepIndex === index ? !step : step))
                }
              : track
          ),
          pending: null
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
          const current = snapshotFromState(state);
          return {
            ...mutateSnapshot(current),
            pending: current,
            history: [current, ...state.history].slice(0, 8)
          };
        }),
      acceptMutation: () => set({ pending: null }),
      revertMutation: () =>
        set((state) => {
          if (!state.pending) {
            return {};
          }
          return {
            ...state.pending,
            pending: null
          };
        }),
      reset: () =>
        set({
          ...defaultSnapshot,
          pending: null,
          history: [],
          activeStep: -1
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
        imageTone: state.imageTone
      })
    }
  )
);
