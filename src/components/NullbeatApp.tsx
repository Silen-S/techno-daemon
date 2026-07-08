"use client";

import { useEffect, useState } from "react";
import {
  AcceptIcon,
  DaemonAiIcon,
  GlobeIcon,
  MuteIcon,
  PlayIcon,
  RevertIcon,
  StopIcon,
  TargetIcon,
  TransformIcon
} from "@/components/icons";
import { hasGeminiKey, MAX_REQUEST_LENGTH } from "@/ai/gemini";
import { useBeatEngine } from "@/hooks/useBeatEngine";
import { labels, type Lang } from "@/i18n/labels";
import { STEPS } from "@/patterns/defaults";
import { useBeatStore } from "@/store/useBeatStore";
import { ALL_INTENTS, chordForBar, KEY_LABEL, progressionCountFor, progressionFor } from "@/theory/harmony";
import type { AutoAcceptSetting, MutationInterval, MutationTarget, PresetIntent, TrackState } from "@/types";

const mutationTargets: MutationTarget[] = ["pattern", "sound", "filter", "density", "velocity"];
const intervals: MutationInterval[] = ["manual", "4", "8", "16"];
const autoAccepts: AutoAcceptSetting[] = ["off", "2", "4", "8"];
const intents = ALL_INTENTS;

// 雰囲気提案ダイアログが自動で閉じるまでの秒数
const INTENT_PROMPT_TIMEOUT_SEC = 10;

export function NullbeatApp() {
  const engineRef = useBeatEngine();
  const state = useBeatStore();
  const t = labels[state.lang];
  const [aiRequest, setAiRequest] = useState("");
  const aiReady = hasGeminiKey();

  const handleAiTransform = () => {
    void state.requestAiTransform(aiRequest);
  };

  const handlePlay = async () => {
    await engineRef.current?.play();
    state.setPlaying(true);
  };

  const handleStop = () => {
    engineRef.current?.stop();
    state.setPlaying(false);
    state.setBar(0);
  };

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
            aria-label={state.isPlaying ? t.stop : t.play}
            className="primaryButton iconButton"
            onClick={state.isPlaying ? handleStop : handlePlay}
            title={state.isPlaying ? t.stop : t.play}
            type="button"
          >
            {state.isPlaying ? <StopIcon /> : <PlayIcon />}
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
            <span>{state.isPlaying ? t.running : t.idle}</span>
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
  filter: "#7ccce4",
  density: "#d9b56c",
  velocity: "#e07664"
};

// 音色・フィルターはステップ単位ではなくトラック全体にかかる変化
const trackWideTargets: MutationTarget[] = ["sound", "filter"];

function TrackRow({
  activeStep,
  lang,
  locked,
  onMute,
  onMutation,
  onToggleStep,
  onVolume,
  track
}: {
  activeStep: number;
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
            {step.note && step.enabled ? <span className="noteLabel">{step.note}</span> : null}
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
