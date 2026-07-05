"use client";

import { useBeatEngine } from "@/hooks/useBeatEngine";
import { STEPS } from "@/patterns/defaults";
import { useBeatStore } from "@/store/useBeatStore";
import type { MutationInterval, MutationTarget, PresetIntent, TrackState } from "@/types";

const mutationTargets: MutationTarget[] = ["pattern", "sound", "filter", "density", "velocity"];
const intervals: MutationInterval[] = ["manual", "4", "8", "16"];
const intents: PresetIntent[] = ["coding", "relax", "dark", "cyber"];

export function NullbeatApp() {
  const engineRef = useBeatEngine();
  const state = useBeatStore();

  const handlePlay = async () => {
    await engineRef.current?.play();
    state.setPlaying(true);
  };

  const handleStop = () => {
    engineRef.current?.stop();
    state.setPlaying(false);
  };

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
          <span className="signal" aria-hidden="true" />
          <div>
            <h1>NULLBEAT</h1>
            <p>minimal generative techno for deep work</p>
          </div>
        </div>

        <div className="transportControls">
          <button className="primaryButton" onClick={state.isPlaying ? handleStop : handlePlay} type="button">
            {state.isPlaying ? "Stop" : "Play"}
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
              onMute={() => state.toggleTrackMute(track.id)}
              onMutation={() => state.toggleTrackMutation(track.id)}
              onToggleStep={(index) => state.toggleStep(track.id, index)}
              track={track}
            />
          ))}
        </div>

        <aside className="sidePanel">
          <div className="panelBlock">
            <h2>Mutation</h2>
            <div className="segmentGrid">
              {mutationTargets.map((target) => (
                <button
                  className={state.mutationTargets.includes(target) ? "segment active" : "segment"}
                  key={target}
                  onClick={() => state.toggleMutationTarget(target)}
                  type="button"
                >
                  {target}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>Timing</h2>
            <div className="segments">
              {intervals.map((interval) => (
                <button
                  className={state.mutationInterval === interval ? "segment active" : "segment"}
                  key={interval}
                  onClick={() => state.setMutationInterval(interval)}
                  type="button"
                >
                  {interval === "manual" ? "Manual" : `${interval} bars`}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>Intent</h2>
            <div className="segments">
              {intents.map((intent) => (
                <button
                  className={state.intent === intent ? "segment active" : "segment"}
                  key={intent}
                  onClick={() => state.setIntent(intent)}
                  type="button"
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>Input</h2>
            <input
              className="textInput"
              onChange={(event) => state.setMoodText(event.target.value)}
              placeholder="coding / relax / dark / cyber"
              type="text"
              value={state.moodText}
            />
            <label className="fileInput">
              <span>Image tone: {state.imageTone}</span>
              <input accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} type="file" />
            </label>
          </div>

          <div className="actionStack">
            <button disabled={!!state.pending} onClick={state.requestMutation} type="button">
              Mutate
            </button>
            <button disabled={!state.pending} onClick={state.acceptMutation} type="button">
              Accept
            </button>
            <button disabled={!state.pending} onClick={state.revertMutation} type="button">
              Revert
            </button>
            <button onClick={state.reset} type="button">
              Reset
            </button>
          </div>

          <div className="monitor" aria-label="Current state">
            <span>{state.isPlaying ? "RUNNING" : "IDLE"}</span>
            <span>STEP {state.activeStep < 0 ? "--" : String(state.activeStep + 1).padStart(2, "0")}</span>
            <span>{state.pending ? "UNCOMMITTED" : "LOCKED"}</span>
          </div>
        </aside>
      </section>
    </main>
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
  onMute,
  onMutation,
  onToggleStep,
  track
}: {
  activeStep: number;
  onMute: () => void;
  onMutation: () => void;
  onToggleStep: (index: number) => void;
  track: TrackState;
}) {
  return (
    <div className={track.muted ? "trackRow muted" : "trackRow"}>
      <div className="trackMeta">
        <strong>{track.name}</strong>
        <span>{track.soundId}</span>
        <div className="trackToggles">
          <button className={track.muted ? "mini active" : "mini"} onClick={onMute} type="button">
            M
          </button>
          <button className={track.mutationEnabled ? "mini active" : "mini"} onClick={onMutation} type="button">
            μ
          </button>
        </div>
      </div>

      <div className="steps">
        {track.steps.map((step, index) => (
          <button
            aria-label={`${track.name} step ${index + 1}`}
            className={[step.enabled ? "step on" : "step", activeStep === index ? "playing" : "", step.lastMutated ? "mutated" : ""].join(" ")}
            key={`${track.id}-${index}`}
            onClick={() => onToggleStep(index)}
            style={{ "--velocity": step.velocity } as React.CSSProperties}
            type="button"
          />
        ))}
      </div>

      <div className="trackStats">
        <span>F {Math.round(track.filter * 100)}</span>
        <span>D {Math.round(track.density * 100)}</span>
      </div>
    </div>
  );
}
