"use client";

import { useEffect, useRef, useState } from "react";
import {
  AcceptIcon,
  DaemonAiIcon,
  GlobeIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  RevertIcon,
  StopIcon,
  TargetIcon,
  TransformIcon
} from "@/components/icons";
import { hasGeminiKey, MAX_REQUEST_LENGTH } from "@/ai/gemini";
import {
  bumpGrooveNumber,
  defaultGrooveTitle,
  downloadGrooveMp3,
  downloadGrooveScript,
  peekGrooveNumber
} from "@/groove/export";
import { useBeatEngine } from "@/hooks/useBeatEngine";
import { labels, type Lang } from "@/i18n/labels";
import { STEPS } from "@/patterns/defaults";
import { useBeatStore } from "@/store/useBeatStore";
import {
  ALL_INTENTS,
  bassNoteForStep,
  chordForBar,
  KEY_LABEL,
  progressionCountFor,
  progressionFor,
  type Chord
} from "@/theory/harmony";
import type { AppSnapshot, AutoAcceptSetting, MutationInterval, MutationTarget, PresetIntent, TrackState } from "@/types";

const mutationTargets: MutationTarget[] = ["pattern", "sound", "effect", "density", "velocity"];
const intervals: MutationInterval[] = ["manual", "4", "8", "16"];
const autoAccepts: AutoAcceptSetting[] = ["off", "2", "4", "8"];
const intents = ALL_INTENTS;

// 雰囲気提案ダイアログが自動で閉じるまでの秒数
const INTENT_PROMPT_TIMEOUT_SEC = 10;

// OSのメディアキーを受け取るには再生中の<audio>要素が必要なため、
// 無音のWAVをループ再生する(音はWeb Audio側から出る)
const makeSilentWavUrl = () => {
  const sampleRate = 8000;
  const seconds = 1;
  const dataLength = sampleRate * seconds * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

export function NullbeatApp() {
  const engineRef = useBeatEngine();
  const state = useBeatStore();
  const t = labels[state.lang];
  const [aiRequest, setAiRequest] = useState("");
  const aiReady = hasGeminiKey();

  const handleAiTransform = () => {
    void state.requestAiTransform(aiRequest);
  };

  // My groove保存(タイトル既定は連番、メモ既定は時刻+雰囲気)
  const [grooveTitle, setGrooveTitle] = useState("");
  const [grooveMemo, setGrooveMemo] = useState("");
  const [grooveDefaultTitle, setGrooveDefaultTitle] = useState(() =>
    typeof window === "undefined" ? "My groove 01" : defaultGrooveTitle(peekGrooveNumber())
  );
  const [mp3Busy, setMp3Busy] = useState(false);

  const grooveSnapshot = (): AppSnapshot => ({
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

  const resolveGrooveMeta = () => {
    const usedDefault = grooveTitle.trim().length === 0;
    const title = usedDefault ? grooveDefaultTitle : grooveTitle.trim();
    const memo = grooveMemo.trim() || `${new Date().toLocaleString()} · ${state.moodText || t.intents[state.intent]}`;
    if (usedDefault) {
      bumpGrooveNumber();
      setGrooveDefaultTitle(defaultGrooveTitle(peekGrooveNumber()));
    }
    return { title, memo };
  };

  const handleSaveScript = () => {
    const { title, memo } = resolveGrooveMeta();
    downloadGrooveScript(grooveSnapshot(), title, memo);
  };

  const handleSaveMp3 = async () => {
    const { title } = resolveGrooveMeta();
    setMp3Busy(true);
    try {
      await downloadGrooveMp3(grooveSnapshot(), title);
    } finally {
      setMp3Busy(false);
    }
  };

  // メディアキー連携用の無音<audio>
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ensureSilentAudio = () => {
    if (!silentAudioRef.current) {
      const audio = new Audio(makeSilentWavUrl());
      audio.loop = true;
      audio.volume = 0.0001;
      silentAudioRef.current = audio;
    }
    return silentAudioRef.current;
  };

  const handleStart = async () => {
    // 開始(再開ではない)はキックだけのイントロから立ち上げる
    state.beginIntro();
    await engineRef.current?.play();
    state.setPlaybackState("playing");
    void ensureSilentAudio().play().catch(() => {});
  };

  const handleEnd = () => {
    engineRef.current?.stop();
    state.setPlaybackState("stopped");
    state.clearIntro();
    state.setBar(0);
    silentAudioRef.current?.pause();
  };

  const handlePause = () => {
    engineRef.current?.pause();
    state.setPlaybackState("paused");
    silentAudioRef.current?.pause();
  };

  const handleResume = async () => {
    await engineRef.current?.play();
    state.setPlaybackState("playing");
    void ensureSilentAudio().play().catch(() => {});
  };

  // OSのメディアキー(ヘッドホンのボタン等)から一時停止/再開できるようにする
  const mediaHandlersRef = useRef({ handleStart, handleEnd, handlePause, handleResume, playbackState: state.playbackState });
  useEffect(() => {
    mediaHandlersRef.current = { handleStart, handleEnd, handlePause, handleResume, playbackState: state.playbackState };
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({ title: "Techno Daemon", artist: "self-evolving generative rave" });
    session.setActionHandler("play", () => {
      const current = mediaHandlersRef.current;
      void (current.playbackState === "paused" ? current.handleResume() : current.handleStart());
    });
    session.setActionHandler("pause", () => {
      if (mediaHandlersRef.current.playbackState === "playing") {
        mediaHandlersRef.current.handlePause();
      }
    });
    session.setActionHandler("stop", () => mediaHandlersRef.current.handleEnd());
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("stop", null);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = state.playbackState === "stopped" ? "none" : state.playbackState;
    }
  }, [state.playbackState]);

  const chord = chordForBar(Math.max(state.bar, 1), state.intent, state.progressionIndex);
  const progression = progressionFor(state.intent, state.progressionIndex);
  const progressionCount = progressionCountFor(state.intent);
  const progressionNumber = ((state.progressionIndex % progressionCount) + progressionCount) % progressionCount;

  // 自動採用までの残り小節数(再生中に減っていく)
  const autoAcceptBars = state.autoAccept === "off" ? null : Number(state.autoAccept);
  const autoAcceptRemaining =
    state.pending && autoAcceptBars !== null && state.pendingSinceBar !== null
      ? Math.max(0, autoAcceptBars - (state.bar - state.pendingSinceBar))
      : null;

  const handleImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const size = 24;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(bitmap, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let index = 0; index < data.length; index += 4) {
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
    }

    const pixels = data.length / 4;
    red /= pixels;
    green /= pixels;
    blue /= pixels;
    const brightness = (red + green + blue) / 3;
    if (brightness < 72) {
      state.setImageTone("dark");
    } else if (brightness > 184) {
      state.setImageTone("bright");
    } else if (blue > red + 18 && blue > green) {
      state.setImageTone("blue");
    } else if (red > blue + 18 && red > green) {
      state.setImageTone("red");
    } else {
      state.setImageTone("none");
    }
  };

  return (
    <main className="shell">
      <section className="transport" aria-label="Transport">
        <div className="identity">
          <DaemonIcon />
          <div>
            <h1>TECHNO DAEMON</h1>
            <p>{t.tagline}</p>
          </div>
        </div>

        <div className="transportControls">
          <button
            aria-label={state.playbackState === "stopped" ? t.play : t.stop}
            className="primaryButton iconButton"
            onClick={state.playbackState === "stopped" ? handleStart : handleEnd}
            title={state.playbackState === "stopped" ? t.play : t.stop}
            type="button"
          >
            {state.playbackState === "stopped" ? <PlayIcon /> : <StopIcon />}
          </button>
          <button
            aria-label={state.playbackState === "paused" ? t.resume : t.pause}
            className="iconButton pauseButton"
            disabled={state.playbackState === "stopped"}
            onClick={state.playbackState === "paused" ? handleResume : handlePause}
            title={state.playbackState === "paused" ? t.resume : t.pause}
            type="button"
          >
            {state.playbackState === "paused" ? <PlayIcon /> : <PauseIcon />}
          </button>
          <label className="bpmControl">
            <span>BPM</span>
            <input
              aria-label="BPM"
              max={150}
              min={80}
              onChange={(event) => state.setBpm(Number(event.target.value))}
              type="range"
              value={state.bpm}
            />
            <strong>{state.bpm}</strong>
          </label>
          <button
            aria-label={state.lang === "ja" ? "Switch to English" : "日本語に切り替え"}
            className="iconButton langButton"
            onClick={() => state.setLang(state.lang === "ja" ? "en" : "ja")}
            title={state.lang === "ja" ? "English" : "日本語"}
            type="button"
          >
            <GlobeIcon />
            <span>{state.lang.toUpperCase()}</span>
          </button>
        </div>
      </section>

      <section className="console">
        <div className="sequencer">
          <StepHeader activeStep={state.activeStep} />
          {state.tracks.map((track) => (
            <TrackRow
              activeStep={state.activeStep}
              chord={chord}
              key={track.id}
              lang={state.lang}
              locked={!!state.morph}
              onMute={() => state.toggleTrackMute(track.id)}
              onMutation={() => state.toggleTrackMutation(track.id)}
              onToggleStep={(index) => state.toggleStep(track.id, index)}
              onVolume={(volume) => state.setTrackVolume(track.id, volume)}
              track={track}
            />
          ))}
        </div>

        <aside className="sidePanel">
          <div className="panelBlock">
            <h2>{t.intentHeading}</h2>
            <div className="segments">
              {intents.map((intent) => (
                <button
                  className={state.intent === intent ? "segment active" : "segment"}
                  key={intent}
                  onClick={() => state.setIntent(intent)}
                  type="button"
                >
                  {t.intents[intent]}
                </button>
              ))}
            </div>
          </div>

          <div className="actionStack">
            <button
              aria-label={t.transform}
              className="iconButton actionButton transformButton"
              disabled={!!state.morph}
              onClick={state.requestTransform}
              title={t.transform}
              type="button"
            >
              <TransformIcon size={22} />
              <span>
                {state.morph
                  ? `${state.morph.totalBars - state.morph.remainingBars + 1}/${state.morph.totalBars}`
                  : t.transform}
              </span>
            </button>
            <button
              aria-label={t.accept}
              className="iconButton actionButton acceptButton"
              disabled={!state.pending}
              onClick={() => state.acceptMutation()}
              title={t.accept}
              type="button"
            >
              <AcceptIcon size={22} />
              <span>
                {t.accept}
                {autoAcceptRemaining !== null ? <em className="countdown"> {autoAcceptRemaining}</em> : null}
              </span>
            </button>
            <button
              aria-label={t.revert}
              className="iconButton actionButton revertButton"
              disabled={!state.pending && state.history.length === 0}
              onClick={state.revertMutation}
              title={t.revert}
              type="button"
            >
              <RevertIcon size={22} />
              <span>
                {t.revert}
                {!state.pending && state.history.length > 0 ? (
                  <em className="countdown"> ({state.history.length})</em>
                ) : null}
              </span>
            </button>
          </div>

          <div className="panelBlock aiBlock">
            <input
              className="textInput"
              disabled={state.aiBusy}
              maxLength={MAX_REQUEST_LENGTH}
              onChange={(event) => setAiRequest(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && aiReady && !state.aiBusy && !state.morph) {
                  handleAiTransform();
                }
              }}
              placeholder={t.aiPlaceholder}
              type="text"
              value={aiRequest}
            />
            <button
              aria-label={t.aiTransform}
              className="iconButton actionButton aiButton"
              disabled={!aiReady || state.aiBusy || !!state.morph}
              onClick={handleAiTransform}
              title={aiReady ? t.aiTransform : t.aiNoKey}
              type="button"
            >
              <DaemonAiIcon size={22} />
              <span>{state.aiBusy ? t.aiBusy : aiReady ? t.aiTransform : t.aiNoKey}</span>
            </button>
            {state.aiError ? (
              <p className="aiError">
                {t.aiErrorLabel}: {state.aiError}
              </p>
            ) : null}
          </div>

          <div className="panelBlock grooveBlock">
            <h2>{t.grooveHeading}</h2>
            <input
              aria-label={t.grooveTitlePlaceholder}
              className="textInput"
              maxLength={80}
              onChange={(event) => setGrooveTitle(event.target.value)}
              placeholder={grooveDefaultTitle}
              suppressHydrationWarning
              type="text"
              value={grooveTitle}
            />
            <input
              aria-label={t.grooveMemoPlaceholder}
              className="textInput"
              maxLength={200}
              onChange={(event) => setGrooveMemo(event.target.value)}
              placeholder={t.grooveMemoPlaceholder}
              type="text"
              value={grooveMemo}
            />
            <div className="grooveButtons">
              <button onClick={handleSaveScript} type="button">
                {t.saveScript}
              </button>
              <button disabled={mp3Busy} onClick={() => void handleSaveMp3()} type="button">
                {mp3Busy ? t.rendering : t.saveMp3}
              </button>
            </div>
          </div>
        </aside>
      </section>

      <details className="advanced">
        <summary>{t.advancedHeading}</summary>
        <div className="advancedGrid">
          <div className="panelBlock">
            <h2>{t.mutationHeading}</h2>
            <div className="segmentGrid">
              {mutationTargets.map((target) => (
                <button
                  className={state.mutationTargets.includes(target) ? "segment active" : "segment"}
                  key={target}
                  onClick={() => state.toggleMutationTarget(target)}
                  type="button"
                >
                  {t.targets[target]}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.timingHeading}</h2>
            <div className="segments">
              {intervals.map((interval) => (
                <button
                  className={state.mutationInterval === interval ? "segment active" : "segment"}
                  key={interval}
                  onClick={() => state.setMutationInterval(interval)}
                  type="button"
                >
                  {t.interval(interval)}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.autoAcceptHeading}</h2>
            <div className="segments">
              {autoAccepts.map((setting) => (
                <button
                  className={state.autoAccept === setting ? "segment active" : "segment"}
                  key={setting}
                  onClick={() => state.setAutoAccept(setting)}
                  type="button"
                >
                  {t.autoAccept(setting)}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.intentPromptHeading}</h2>
            <div className="segments">
              <button
                className={state.intentPromptEnabled ? "segment active" : "segment"}
                onClick={() => state.setIntentPromptEnabled(true)}
                type="button"
              >
                {t.on}
              </button>
              <button
                className={!state.intentPromptEnabled ? "segment active" : "segment"}
                onClick={() => state.setIntentPromptEnabled(false)}
                type="button"
              >
                {t.off}
              </button>
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.tieHeading}</h2>
            <div className="segments">
              <button
                className={state.tieSynth ? "segment active" : "segment"}
                onClick={() => state.setTieSynth(true)}
                type="button"
              >
                {t.on}
              </button>
              <button
                className={!state.tieSynth ? "segment active" : "segment"}
                onClick={() => state.setTieSynth(false)}
                type="button"
              >
                {t.off}
              </button>
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.effectStackHeading}</h2>
            <div className="segments">
              <button
                className={state.allowEffectStacking ? "segment active" : "segment"}
                onClick={() => state.setAllowEffectStacking(true)}
                type="button"
              >
                {t.on}
              </button>
              <button
                className={!state.allowEffectStacking ? "segment active" : "segment"}
                onClick={() => state.setAllowEffectStacking(false)}
                type="button"
              >
                {t.off}
              </button>
            </div>
          </div>

          <div className="panelBlock">
            <h2>{t.inputHeading}</h2>
            <input
              className="textInput"
              onChange={(event) => state.setMoodText(event.target.value)}
              placeholder={t.moodPlaceholder}
              type="text"
              value={state.moodText}
            />
            <label className="fileInput">
              <span>
                {t.imageTone}: {t.tones[state.imageTone]}
              </span>
              <input accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} type="file" />
            </label>
          </div>

          <div className="monitor" aria-label="Current state">
            <span>{state.playbackState === "playing" ? t.running : state.playbackState === "paused" ? t.paused : t.idle}</span>
            <span>
              {t.stepLabel} {state.activeStep < 0 ? "--" : String(state.activeStep + 1).padStart(2, "0")}
            </span>
            <span>
              {t.keyLabel} {KEY_LABEL} · {chord.name} ({chord.degree})
            </span>
            <span>
              {t.progressionLabel} {progressionNumber + 1}/{progressionCount} · {progression.label}
            </span>
            <span>
              {t.barLabel} {state.bar > 0 ? state.bar : "--"}
            </span>
            {state.lastMutation ? (
              <span>
                {t.lastLabel} {t.tracks[state.lastMutation.trackId]} / {t.targets[state.lastMutation.target]}
              </span>
            ) : null}
            {state.morph ? (
              <span>
                {t.morphLabel} {state.morph.totalBars - state.morph.remainingBars + 1}/{state.morph.totalBars}
              </span>
            ) : null}
            <span>{state.pending ? t.uncommitted : t.locked}</span>
          </div>

          <div className="monitor" aria-label="Learned weights">
            <span>{t.learnedBias}</span>
            {mutationTargets.map((target) => (
              <span key={target}>
                {t.targets[target]} ×{(state.feedback[target] ?? 1).toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      </details>

      <footer className="footerLinks">
        <a href="/terms">利用規約 / Terms of Service</a>
      </footer>

      {state.intentPrompt ? (
        <IntentPromptDialog
          intents={state.intentPrompt}
          lang={state.lang}
          onClose={state.closeIntentPrompt}
          onSelect={state.setIntent}
        />
      ) : null}
    </main>
  );
}

// 雰囲気の提案ダイアログ。表示から一定秒数で「このまま」として自動クローズする
function IntentPromptDialog({
  intents: options,
  lang,
  onClose,
  onSelect
}: {
  intents: PresetIntent[];
  lang: Lang;
  onClose: () => void;
  onSelect: (intent: PresetIntent) => void;
}) {
  const t = labels[lang];
  const [secondsLeft, setSecondsLeft] = useState(INTENT_PROMPT_TIMEOUT_SEC);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          onClose();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="promptOverlay" role="dialog" aria-modal="true" aria-label={t.intentPromptTitle}>
      <div className="promptCard">
        <h2>{t.intentPromptTitle}</h2>
        <div className="promptOptions">
          {options.map((intent) => (
            <button className="promptOption" key={intent} onClick={() => onSelect(intent)} type="button">
              {t.intents[intent]}
            </button>
          ))}
        </div>
        <button className="promptKeep" onClick={onClose} type="button">
          {t.intentPromptKeep} <em className="countdown">({secondsLeft})</em>
        </button>
      </div>
    </div>
  );
}

function DaemonIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="Techno Daemon" className="daemonIcon" src="/icon.svg" />
  );
}

function StepHeader({ activeStep }: { activeStep: number }) {
  return (
    <div className="stepHeader" aria-hidden="true">
      <span />
      {Array.from({ length: STEPS }, (_, index) => (
        <span className={activeStep === index ? "active" : ""} key={index}>
          {index + 1}
        </span>
      ))}
    </div>
  );
}

// 直近の変化を項目ごとに色分けして示す
const mutationColors: Record<MutationTarget, string> = {
  pattern: "#91f0b2",
  sound: "#c9a0f0",
  effect: "#7ccce4",
  density: "#d9b56c",
  velocity: "#e07664"
};

// 音色・エフェクトはステップ単位ではなくトラック全体にかかる変化
const trackWideTargets: MutationTarget[] = ["sound", "effect"];

function TrackRow({
  activeStep,
  chord,
  lang,
  locked,
  onMute,
  onMutation,
  onToggleStep,
  onVolume,
  track
}: {
  activeStep: number;
  chord: Chord;
  lang: Lang;
  locked: boolean;
  onMute: () => void;
  onMutation: () => void;
  onToggleStep: (index: number) => void;
  onVolume: (volume: number) => void;
  track: TrackState;
}) {
  const t = labels[lang];
  const trackName = t.tracks[track.id];
  // ベースの音程はコード進行から導出されるため、現在小節のコードで表示する
  const noteAt = (index: number, note?: string) => (track.id === "bass" ? bassNoteForStep(chord, index) : note);
  const mutColor = track.lastMutatedTarget ? mutationColors[track.lastMutatedTarget] : "transparent";
  const trackWideMutated = !!track.lastMutatedTarget && trackWideTargets.includes(track.lastMutatedTarget);

  return (
    <div
      className={track.muted ? "trackRow muted" : "trackRow"}
      style={{ "--filter": track.filter, "--mutColor": mutColor } as React.CSSProperties}
    >
      <div className={trackWideMutated ? "trackMeta trackMutated" : "trackMeta"}>
        <strong>{trackName}</strong>
        <span>{track.soundId}</span>
        <div className="trackToggles">
          <button
            aria-label={t.muteTooltip}
            aria-pressed={track.muted}
            className={track.muted ? "mini active" : "mini"}
            onClick={onMute}
            title={t.muteTooltip}
            type="button"
          >
            <MuteIcon muted={track.muted} />
          </button>
          <button
            aria-label={t.mutationTooltip}
            aria-pressed={track.mutationEnabled}
            className={track.mutationEnabled ? "mini active" : "mini"}
            onClick={onMutation}
            title={t.mutationTooltip}
            type="button"
          >
            <TargetIcon />
          </button>
        </div>
      </div>

      <div className="steps">
        {track.steps.map((step, index) => (
          <button
            aria-label={`${trackName} step ${index + 1}`}
            className={[step.enabled ? "step on" : "step", activeStep === index ? "playing" : "", step.lastMutated ? "mutated" : ""].join(" ")}
            disabled={locked}
            key={`${track.id}-${index}`}
            onClick={() => onToggleStep(index)}
            style={{ "--velocity": step.velocity } as React.CSSProperties}
            type="button"
          >
            {step.enabled && noteAt(index, step.note) ? <span className="noteLabel">{noteAt(index, step.note)}</span> : null}
          </button>
        ))}
      </div>

      <div className="trackStats">
        <span>F {Math.round(track.filter * 100)}</span>
        <span>D {Math.round(track.density * 100)}</span>
        <input
          aria-label={`${trackName} volume`}
          className="volumeSlider"
          max={2}
          min={0}
          onChange={(event) => onVolume(Number(event.target.value))}
          step={0.01}
          title={t.volumeTooltip}
          type="range"
          value={track.volume}
        />
      </div>
    </div>
  );
}
