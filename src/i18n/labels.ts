import type { AutoAcceptSetting, ImageTone, MutationInterval, MutationTarget, PresetIntent, TrackId } from "@/types";

export type Lang = "en" | "ja";

type Labels = {
  tagline: string;
  play: string;
  stop: string;
  mutationHeading: string;
  targets: Record<MutationTarget, string>;
  timingHeading: string;
  interval: (interval: MutationInterval) => string;
  autoAcceptHeading: string;
  autoAccept: (setting: AutoAcceptSetting) => string;
  intentHeading: string;
  intents: Record<PresetIntent, string>;
  inputHeading: string;
  moodPlaceholder: string;
  imageTone: string;
  tones: Record<ImageTone, string>;
  mutate: string;
  accept: string;
  revert: string;
  reset: string;
  transform: string;
  morphLabel: string;
  running: string;
  idle: string;
  stepLabel: string;
  keyLabel: string;
  progressionLabel: string;
  barLabel: string;
  lastLabel: string;
  uncommitted: string;
  locked: string;
  learnedBias: string;
  tracks: Record<TrackId, string>;
  muteTooltip: string;
  mutationTooltip: string;
  volumeTooltip: string;
};

export const labels: Record<Lang, Labels> = {
  en: {
    tagline: "self-evolving generative rave",
    play: "Play",
    stop: "Stop",
    mutationHeading: "Mutation",
    targets: {
      pattern: "pattern",
      sound: "sound",
      filter: "filter",
      density: "density",
      velocity: "velocity"
    },
    timingHeading: "Timing",
    interval: (interval) => (interval === "manual" ? "Manual" : `${interval} bars`),
    autoAcceptHeading: "Auto accept",
    autoAccept: (setting) => (setting === "off" ? "Off" : `${setting} loops`),
    intentHeading: "Intent",
    intents: {
      coding: "coding",
      relax: "relax",
      dark: "dark",
      cyber: "cyber",
      hypnotic: "hypnotic",
      acid: "acid",
      dub: "dub",
      euphoric: "euphoric",
      industrial: "industrial",
      dreamy: "dreamy"
    },
    inputHeading: "Input",
    moodPlaceholder: "coding / dark / acid / euphoric ...",
    imageTone: "Image tone",
    tones: { none: "none", blue: "blue", red: "red", dark: "dark", bright: "bright" },
    mutate: "Mutate",
    accept: "Accept",
    revert: "Revert",
    reset: "Reset",
    transform: "Transform",
    morphLabel: "MORPH",
    running: "RUNNING",
    idle: "IDLE",
    stepLabel: "STEP",
    keyLabel: "KEY",
    progressionLabel: "PROG",
    barLabel: "BAR",
    lastLabel: "LAST",
    uncommitted: "UNCOMMITTED",
    locked: "LOCKED",
    learnedBias: "LEARNED BIAS",
    tracks: { kick: "Kick", snare: "Snare/Clap", hat: "Hat", bass: "Bass", synth: "Synth" },
    muteTooltip: "Mute this track",
    mutationTooltip: "Allow mutation on this track (only lit tracks change)",
    volumeTooltip: "Track volume"
  },
  ja: {
    tagline: "自己進化するジェネレーティブ・レイヴ",
    play: "再生",
    stop: "停止",
    mutationHeading: "変化させる項目",
    targets: {
      pattern: "パターン",
      sound: "音色",
      filter: "フィルター",
      density: "密度",
      velocity: "強弱"
    },
    timingHeading: "変化の間隔",
    interval: (interval) => (interval === "manual" ? "手動" : `${interval}小節ごと`),
    autoAcceptHeading: "自動採用",
    autoAccept: (setting) => (setting === "off" ? "オフ" : `${setting}ループ後`),
    intentHeading: "雰囲気",
    intents: {
      coding: "コーディング",
      relax: "リラックス",
      dark: "ダーク",
      cyber: "サイバー",
      hypnotic: "ヒプノティック",
      acid: "アシッド",
      dub: "ダブ",
      euphoric: "多幸感",
      industrial: "インダストリアル",
      dreamy: "ドリーミー"
    },
    inputHeading: "入力",
    moodPlaceholder: "coding / dark / acid / euphoric ...",
    imageTone: "画像トーン",
    tones: { none: "なし", blue: "青", red: "赤", dark: "暗い", bright: "明るい" },
    mutate: "変化させる",
    accept: "採用",
    revert: "戻す",
    reset: "リセット",
    transform: "曲調を変える",
    morphLabel: "モーフ",
    running: "再生中",
    idle: "停止中",
    stepLabel: "ステップ",
    keyLabel: "キー",
    progressionLabel: "進行",
    barLabel: "小節",
    lastLabel: "直近の変化",
    uncommitted: "未確定",
    locked: "確定済み",
    learnedBias: "学習バイアス",
    tracks: { kick: "キック", snare: "スネア/クラップ", hat: "ハット", bass: "ベース", synth: "シンセ" },
    muteTooltip: "このトラックをミュートする",
    mutationTooltip: "このトラックを変化の対象にする(点灯中のトラックだけが変化する)",
    volumeTooltip: "トラック音量"
  }
};
