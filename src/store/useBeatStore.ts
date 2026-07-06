"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSteps, defaultSnapshot, defaultTracks, STEPS } from "@/patterns/defaults";
import { mutateSnapshot } from "@/mutation/mutate";
import { createMorph, morphTracks, type MorphState } from "@/mutation/transform";
import { melodyPoolFor, nearestInPool } from "@/theory/harmony";
import type { Lang } from "@/i18n/labels";
import type { AppSnapshot, AutoAcceptSetting, FeedbackWeights, ImageTone, LastMutation, MutationInterval, MutationTarget, PresetIntent, StepState, TrackId, TrackState } from "@/types";

// Accept/Revertの回数に応じてMutation対象の選択確率を学習する係数
const FEEDBACK_UP = 1.25;
// 自動Acceptは「聴き続けた=弱い好意」として控えめに扱う
const FEEDBACK_UP_AUTO = 1.08;
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
  autoAccept: AutoAcceptSetting;
  pendingSinceBar: number | null;
  lang: Lang;
  morph: MorphState | null;
  setBar: (bar: number) => void;
  setAutoAccept: (autoAccept: AutoAcceptSetting) => void;
  setLang: (lang: Lang) => void;
  requestTransform: () => void;
  morphTick: () => void;
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
  acceptMutation: (auto?: boolean) => void;
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

// Intent切替時にメロディーを新しい音域プールへ移調する
const retuneTracks = (tracks: TrackState[], intent: PresetIntent): TrackState[] => {
  const pool = melodyPoolFor(intent);
  return tracks.map((track) =>
    track.id === "synth"
      ? {
          ...track,
          steps: track.steps.map((step) => (step.note ? { ...step, note: nearestInPool(step.note, pool) } : step))
        }
      : track
  );
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
      autoAccept: "4",
      pendingSinceBar: null,
      lang: "ja",
      morph: null,
      setBar: (bar) => set({ bar }),
      setAutoAccept: (autoAccept) => set({ autoAccept }),
      setLang: (lang) => set({ lang }),
      requestTransform: () =>
        set((state) => {
          if (state.morph) {
            return {};
          }
          const current = normalizeSnapshot(snapshotFromState(state));
          return {
            morph: createMorph(current),
            // 未確定の変化はそのまま取り込んでモーフを開始する
            pending: null,
            pendingSinceBar: null,
            history: [current, ...state.history].slice(0, 8)
          };
        }),
      morphTick: () =>
        set((state) => {
          if (!state.morph) {
            return {};
          }
          const tracks = morphTracks(state.tracks, state.morph);
          const remainingBars = state.morph.remainingBars - 1;
          return {
            tracks,
            morph: remainingBars > 0 ? { ...state.morph, remainingBars } : null
          };
        }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setActiveStep: (activeStep) => set({ activeStep }),
      setBpm: (bpm) => set({ bpm: Math.max(80, Math.min(150, Math.round(bpm))) }),
      setIntent: (intent) =>
        set((state) => ({
          intent,
          tracks: retuneTracks(state.tracks, intent)
        })),
      setMoodText: (moodText) =>
        set((state) => {
          const nextIntent = intentFromText(moodText);
          if (!nextIntent || nextIntent === state.intent) {
            return { moodText };
          }
          return {
            moodText,
            intent: nextIntent,
            tracks: retuneTracks(state.tracks, nextIntent)
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
          // モーフ中は通常のMutationを止め、変化を1系統に保つ
          if (state.pending || state.morph) {
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
            pendingSinceBar: state.bar,
            lastMutation: { target: result.target, trackId: result.trackId },
            history: [current, ...state.history].slice(0, 8)
          };
        }),
      acceptMutation: (auto = false) =>
        set((state) => ({
          pending: null,
          pendingSinceBar: null,
          feedback: adjustFeedback(state.feedback, state.lastMutation, auto ? FEEDBACK_UP_AUTO : FEEDBACK_UP)
        })),
      revertMutation: () =>
        set((state) => {
          if (!state.pending) {
            return {};
          }
          return {
            ...state.pending,
            pending: null,
            pendingSinceBar: null,
            feedback: adjustFeedback(state.feedback, state.lastMutation, FEEDBACK_DOWN)
          };
        }),
      reset: () =>
        set({
          ...normalizeSnapshot(defaultSnapshot),
          pending: null,
          pendingSinceBar: null,
          history: [],
          activeStep: -1,
          lastMutation: null,
          morph: null
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
        feedback: state.feedback,
        autoAccept: state.autoAccept,
        lang: state.lang
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
