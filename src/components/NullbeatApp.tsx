"use client";

import { useBeatEngine } from "@/hooks/useBeatEngine";
import { labels, type Lang } from "@/i18n/labels";
import { STEPS } from "@/patterns/defaults";
import { useBeatStore } from "@/store/useBeatStore";
import { chordForBar, KEY_LABEL } from "@/theory/harmony";
import type { AutoAcceptSetting, MutationInterval, MutationTarget, PresetIntent, TrackState } from "@/types";

const mutationTargets: MutationTarget[] = ["pattern", "sound", "filter", "density", "velocity"];
const intervals: MutationInterval[] = ["manual", "4", "8", "16"];
const autoAccepts: AutoAcceptSetting[] = ["off", "2", "4", "8"];
const intents: PresetIntent[] = ["coding", "relax", "dark", "cyber"];
const langs: Lang[] = ["ja", "en"];

export function NullbeatApp() {
  const engineRef = useBeatEngine();
  const state = useBeatStore();
  const t = labels[state.lang];

  const handlePlay = async () => {
    await engineRef.current?.play();
    state.setPlaying(true);
  };

  const handleStop = () => {
    engineRef.current?.stop();
    state.setPlaying(false);
    state.setBar(0);
  };

  const chord = chordForBar(Math.max(state.bar, 1), state.intent);

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
          <div className="langToggle" role="group" aria-label="Language">
            {langs.map((lang) => (
              <button
                className={state.lang === lang ? "segment active" : "segment"}
                key={lang}
                onClick={() => state.setLang(lang)}
                type="button"
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="primaryButton" onClick={state.isPlaying ? handleStop : handlePlay} type="button">
            {state.isPlaying ? t.stop : t.play}
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

          <div className="actionStack">
            <button className="transformButton" disabled={!!state.morph} onClick={state.requestTransform} type="button">
              {state.morph ? `${t.morphLabel} ${state.morph.totalBars - state.morph.remainingBars + 1}/${state.morph.totalBars}` : t.transform}
            </button>
            <button disabled={!!state.pending || !!state.morph} onClick={state.requestMutation} type="button">
              {t.mutate}
            </button>
            <button disabled={!state.pending} onClick={() => state.acceptMutation()} type="button">
              {t.accept}
            </button>
            <button disabled={!state.pending} onClick={state.revertMutation} type="button">
              {t.revert}
            </button>
            <button onClick={state.reset} type="button">
              {t.reset}
            </button>
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
        </aside>
      </section>
    </main>
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

function TrackRow({
  activeStep,
  lang,
  onMute,
  onMutation,
  onToggleStep,
  onVolume,
  track
}: {
  activeStep: number;
  lang: Lang;
  onMute: () => void;
  onMutation: () => void;
  onToggleStep: (index: number) => void;
  onVolume: (volume: number) => void;
  track: TrackState;
}) {
  const t = labels[lang];
  const trackName = t.tracks[track.id];

  return (
    <div className={track.muted ? "trackRow muted" : "trackRow"}>
      <div className="trackMeta">
        <strong>{trackName}</strong>
        <span>{track.soundId}</span>
        <div className="trackToggles">
          <button
            className={track.muted ? "mini active" : "mini"}
            onClick={onMute}
            title={t.muteTooltip}
            type="button"
          >
            M
          </button>
          <button
            className={track.mutationEnabled ? "mini active" : "mini"}
            onClick={onMutation}
            title={t.mutationTooltip}
            type="button"
          >
            μ
          </button>
        </div>
      </div>

      <div className="steps">
        {track.steps.map((step, index) => (
          <button
            aria-label={`${trackName} step ${index + 1}`}
            className={[step.enabled ? "step on" : "step", activeStep === index ? "playing" : "", step.lastMutated ? "mutated" : ""].join(" ")}
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
          max={1}
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
