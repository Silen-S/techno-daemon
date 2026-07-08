"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSteps, defaultSnapshot, defaultTracks, STEPS } from "@/patterns/defaults";
import { mutateSnapshot } from "@/mutation/mutate";
import { createMorph, createMorphWithTarget, morphTracks, type MorphState } from "@/mutation/transform";
import { generateArrangementWithAI } from "@/ai/gemini";
import { ALL_INTENTS, melodyPoolFor, nearestInPool, randomProgressionIndex } from "@/theory/harmony";
import type { Lang } from "@/i18n/labels";
import type { AppSnapshot, AutoAcceptSetting, FeedbackWeights, ImageTone, LastMutation, MutationInterval, MutationTarget, PresetIntent, StepState, TrackId, TrackState } from "@/types";

// Accept/Revertの回数に応じてMutation対象の選択確率を学習する係数
const FEEDBACK_UP = 1.25;
// 自動Acceptは「聴き続けた=弱い好意」として控えめに扱う
const FEEDBACK_UP_AUTO = 1.08;
const FEEDBACK_DOWN = 0.75;
const FEEDBACK_MIN = 0.25;
const FEEDBACK_MAX = 4;

// 「戻す」で遡れる履歴の数
const HISTORY_LIMIT = 10;

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

export type PlaybackState = "stopped" | "playing" | "paused";

// 開始時のイントロでミュート解除していく順番
const INTRO_ORDER: TrackId[] = ["snare", "hat", "bass", "synth"];

type BeatStore = AppSnapshot & {
  isPlaying: boolean;
  playbackState: PlaybackState;
  // イントロ進行中なら次にミュート解除するINTRO_ORDERの添字
  intro: number | null;
  setPlaybackState: (playbackState: PlaybackState) => void;
  setTieSynth: (tieSynth: boolean) => void;
  beginIntro: () => void;
  introTick: () => void;
  clearIntro: () => void;
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
  intentPrompt: PresetIntent[] | null;
  intentPromptEnabled: boolean;
  allowEffectStacking: boolean;
  setAllowEffectStacking: (allow: boolean) => void;
  setBar: (bar: number) => void;
  setAutoAccept: (autoAccept: AutoAcceptSetting) => void;
  setLang: (lang: Lang) => void;
  setIntentPromptEnabled: (enabled: boolean) => void;
  openIntentPrompt: () => void;
  closeIntentPrompt: () => void;
  requestTransform: () => void;
  aiBusy: boolean;
  aiError: string | null;
  requestAiTransform: (request: string) => Promise<void>;
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
  imageTone: state.imageTone,
  progressionIndex: state.progressionIndex,
  tieSynth: state.tieSynth
});

type LegacyTrackState = Omit<TrackState, "steps" | "volume" | "effects"> & {
  pattern?: boolean[];
  velocity?: number[];
  steps?: StepState[];
  volume?: number;
  effects?: TrackState["effects"];
};

const normalizeTrack = (track: LegacyTrackState): TrackState => {
  const { pattern, velocity, steps, volume, effects, ...rest } = track;
  return {
    ...rest,
    volume: volume ?? 0.8,
    // 旧保存データにはeffectsが無いので空で補完する
    effects: effects ?? {},
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

// テキスト入力のキーワードから雰囲気を推定する。上から順に評価する
const intentKeywords: [PresetIntent, string[]][] = [
  ["hypnotic", ["hypno", "minimal", "trance out", "催眠"]],
  ["acid", ["acid", "303", "アシッド"]],
  ["dub", ["dub", "deep", "echo", "ダブ"]],
  ["euphoric", ["euphor", "uplift", "happy", "多幸", "多幸感"]],
  ["industrial", ["indust", "harsh", "noise", "インダスト"]],
  ["dreamy", ["dream", "airy", "ambient dream", "ドリー"]],
  ["relax", ["relax", "ambient", "chill", "リラック"]],
  ["dark", ["dark", "lowpass", "ダーク"]],
  ["cyber", ["cyber", "distortion", "サイバー"]],
  ["coding", ["coding", "mechanical", "work", "コーディング", "作業"]]
];

const intentFromText = (text: string): PresetIntent | null => {
  const value = text.toLowerCase();
  for (const [intent, keywords] of intentKeywords) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return intent;
    }
  }
  return null;
};

// persistは状態変更のたびに全設定をシリアライズして書き込むため、
// そのままだと再生中のステップ更新(毎秒約8回)ごとにlocalStorageへ
// 書き込みが走り、GC負荷とディスクI/Oが積み上がる。
// 書き込みをデバウンスし、タブが隠れる/閉じる時に確実にフラッシュする。
const PERSIST_DEBOUNCE_MS = 1000;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersist: { name: string; value: string } | null = null;

const flushPersist = () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingPersist) {
    window.localStorage.setItem(pendingPersist.name, pendingPersist.value);
    pendingPersist = null;
  }
};

const debouncedLocalStorage = {
  getItem: (name: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(name)),
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") {
      return;
    }
    pendingPersist = { name, value };
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
  },
  removeItem: (name: string) => {
    pendingPersist = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(name);
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushPersist();
    }
  });
}

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
      intentPrompt: null,
      intentPromptEnabled: true,
      allowEffectStacking: true,
      setAllowEffectStacking: (allowEffectStacking) => set({ allowEffectStacking }),
      setBar: (bar) =>
        set((state) => ({
          bar,
          // 停止で小節カウンタが0に戻るとき、未確定変化の起点小節も
          // リセットする。放置すると再開後のカウントダウンが
          // 「経過小節ぶん」の巨大な値になってしまう
          pendingSinceBar: bar === 0 && state.pendingSinceBar !== null ? 0 : state.pendingSinceBar
        })),
      setAutoAccept: (autoAccept) => set({ autoAccept }),
      setLang: (lang) => set({ lang }),
      setIntentPromptEnabled: (intentPromptEnabled) =>
        set((state) => ({ intentPromptEnabled, intentPrompt: intentPromptEnabled ? state.intentPrompt : null })),
      openIntentPrompt: () =>
        set((state) => {
          if (state.intentPrompt) {
            return {};
          }
          // 現在の雰囲気を除いて3つ提案する
          const pool = ALL_INTENTS.filter((intent) => intent !== state.intent);
          for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          return { intentPrompt: pool.slice(0, 3) };
        }),
      closeIntentPrompt: () => set({ intentPrompt: null }),
      requestTransform: () =>
        set((state) => {
          if (state.morph) {
            return {};
          }
          const current = normalizeSnapshot(snapshotFromState(state));
          return {
            morph: createMorph(current),
            // 曲調を変えるので、コード進行も別のものへ切り替える
            progressionIndex: randomProgressionIndex(state.intent, state.progressionIndex),
            // 未確定の変化はそのまま取り込んでモーフを開始する
            pending: null,
            pendingSinceBar: null,
            aiError: null,
            history: [current, ...state.history].slice(0, HISTORY_LIMIT)
          };
        }),
      aiBusy: false,
      aiError: null,
      requestAiTransform: async (request) => {
        const state = get();
        if (state.morph || state.aiBusy) {
          return;
        }
        set({ aiBusy: true, aiError: null });

        const current = normalizeSnapshot(snapshotFromState(state));
        try {
          const result = await generateArrangementWithAI(current, request);
          set((prev) => {
            // 待機中に別のモーフが始まっていたら破棄する
            if (prev.morph) {
              return { aiBusy: false };
            }
            return {
              aiBusy: false,
              morph: createMorphWithTarget(result.target),
              // AIが選んだ雰囲気とBPMは即時反映し、進行も切り替える
              intent: result.intent,
              bpm: result.bpm,
              progressionIndex:
                result.intent === prev.intent
                  ? randomProgressionIndex(prev.intent, prev.progressionIndex)
                  : randomProgressionIndex(result.intent),
              pending: null,
              pendingSinceBar: null,
              intentPrompt: null,
              history: [current, ...prev.history].slice(0, HISTORY_LIMIT)
            };
          });
        } catch (error) {
          set({
            aiBusy: false,
            aiError: error instanceof Error ? error.message : String(error)
          });
        }
      },
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
      playbackState: "stopped",
      intro: null,
      setPlaybackState: (playbackState) => set({ playbackState, isPlaying: playbackState === "playing" }),
      setTieSynth: (tieSynth) => set({ tieSynth }),
      // 開始時はキックだけ残して全トラックをミュートする
      beginIntro: () =>
        set((state) => ({
          intro: 0,
          tracks: state.tracks.map((track) => ({ ...track, muted: track.id !== "kick" }))
        })),
      // 4小節ごとに1トラックずつミュート解除する
      introTick: () =>
        set((state) => {
          if (state.intro === null) {
            return {};
          }
          const trackId = INTRO_ORDER[state.intro];
          const next = state.intro + 1;
          return {
            intro: next >= INTRO_ORDER.length ? null : next,
            tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, muted: false } : track))
          };
        }),
      clearIntro: () => set({ intro: null }),
      setActiveStep: (activeStep) => set({ activeStep }),
      setBpm: (bpm) => set({ bpm: Math.max(80, Math.min(150, Math.round(bpm))) }),
      setIntent: (intent) =>
        set((state) => ({
          intent,
          // 雰囲気を変えたら、その雰囲気の進行の中から新しいものを選ぶ
          progressionIndex: randomProgressionIndex(intent),
          tracks: retuneTracks(state.tracks, intent),
          // 提案ダイアログが開いていれば閉じる
          intentPrompt: null
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
            progressionIndex: randomProgressionIndex(nextIntent),
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
            track.id === trackId ? { ...track, volume: Math.max(0, Math.min(2, volume)) } : track
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
          const result = mutateSnapshot(current, state.feedback, state.allowEffectStacking);
          if (!result) {
            return {};
          }
          return {
            ...result.snapshot,
            pending: current,
            pendingSinceBar: state.bar,
            lastMutation: { target: result.target, trackId: result.trackId },
            history: [current, ...state.history].slice(0, HISTORY_LIMIT)
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
          // 未確定の変化があればそれを取り消す(学習にも反映)
          if (state.pending) {
            return {
              ...state.pending,
              pending: null,
              pendingSinceBar: null,
              feedback: adjustFeedback(state.feedback, state.lastMutation, FEEDBACK_DOWN)
            };
          }
          // 未確定がなければ履歴を1段戻す(最大HISTORY_LIMIT個まで)
          const [head, ...rest] = state.history;
          if (!head) {
            return {};
          }
          return {
            ...head,
            history: rest,
            pending: null,
            pendingSinceBar: null
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
      storage: createJSONStorage(() => debouncedLocalStorage),
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
        lang: state.lang,
        progressionIndex: state.progressionIndex,
        intentPromptEnabled: state.intentPromptEnabled,
        tieSynth: state.tieSynth,
        allowEffectStacking: state.allowEffectStacking
      }),
      merge: (persisted, current) => {
        // 破損した保存データでアプリが起動不能にならないようにする
        try {
          const next = {
            ...current,
            ...(persisted as Partial<BeatStore>)
          };
          return normalizeSnapshot(next as BeatStore) as BeatStore;
        } catch {
          return current;
        }
      }
    }
  )
);

// 開発時のデバッグ用にストアを公開する(本番では公開しない)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as { __beatStore?: typeof useBeatStore }).__beatStore = useBeatStore;
}
