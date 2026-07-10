import {
  bassPresets,
  filterFrequency,
  hatPresets,
  kickPresets,
  leadPresets,
  snarePresets
} from "@/audio/engine";
import { createInsertEffect, INSERT_EFFECT_ORDER } from "@/audio/effects";
import { bassNoteForStep, chordForBar, KEY_LABEL, progressionFor } from "@/theory/harmony";
import { STEPS } from "@/patterns/defaults";
import type { AppSnapshot, TrackId } from "@/types";

// 「My groove」の書き出し。16小節分(コード進行込み)を
// スクリプト(JSON)とMP3の両方で保存できるようにする。

export const GROOVE_BARS = 16;

export type GrooveScript = {
  app: "techno-daemon";
  version: 1;
  title: string;
  memo: string;
  createdAt: string;
  bars: number;
  loopBars: number;
  key: string;
  bpm: number;
  intent: AppSnapshot["intent"];
  progressionIndex: number;
  progression: { label: string; chords: string[] };
  tracks: AppSnapshot["tracks"];
};

export const buildGrooveScript = (snapshot: AppSnapshot, title: string, memo: string): GrooveScript => {
  const progression = progressionFor(snapshot.intent, snapshot.progressionIndex);
  return {
    app: "techno-daemon",
    version: 1,
    title,
    memo,
    createdAt: new Date().toISOString(),
    bars: GROOVE_BARS,
    loopBars: snapshot.loopBars ?? 1,
    key: KEY_LABEL,
    bpm: snapshot.bpm,
    intent: snapshot.intent,
    progressionIndex: snapshot.progressionIndex,
    progression: { label: progression.label, chords: progression.chords.map((chord) => chord.name) },
    tracks: snapshot.tracks
  };
};

const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_").trim() || "my-groove";

// タイトル既定値「My groove NN」の連番管理
const GROOVE_SEQ_KEY = "techno-daemon-groove-seq";

export const peekGrooveNumber = () => Number(window.localStorage.getItem(GROOVE_SEQ_KEY) ?? "0") + 1;

export const bumpGrooveNumber = () => {
  const next = peekGrooveNumber();
  window.localStorage.setItem(GROOVE_SEQ_KEY, String(next));
  return next;
};

export const defaultGrooveTitle = (n: number) => `My groove ${String(n).padStart(2, "0")}`;

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const downloadGrooveScript = (snapshot: AppSnapshot, title: string, memo: string) => {
  const script = buildGrooveScript(snapshot, title, memo);
  const blob = new Blob([JSON.stringify(script, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${sanitizeFileName(title)}.groove.json`);
};

// 16小節分をオフラインレンダリングする(再生エンジンと同じ構成)
const renderGrooveBuffer = async (snapshot: AppSnapshot): Promise<AudioBuffer> => {
  const Tone = await import("tone");
  const stepDuration = 60 / snapshot.bpm / 4;
  const lead = 0.05;
  const duration = GROOVE_BARS * STEPS * stepDuration + lead + 1.5;

  const rendered = await Tone.Offline(async () => {
    const channel = new Tone.Channel({ volume: -8 }).toDestination();

    const trackIds: TrackId[] = ["kick", "snare", "hat", "bass", "synth"];
    const filterFreqs: Record<TrackId, number> = { kick: 4000, snare: 4000, hat: 8000, bass: 1200, synth: 2600 };

    // 再生エンジンと同じく 音源→エフェクト鎖→フィルター→channel を組む
    type ToneNode = InstanceType<typeof Tone.Filter>;
    const filters = {} as Record<TrackId, ToneNode>;
    const chainHeads = {} as Record<TrackId, ToneNode>;
    const byId = Object.fromEntries(snapshot.tracks.map((track) => [track.id, track]));

    for (const id of trackIds) {
      const filter = new Tone.Filter({ type: "lowpass", frequency: filterFreqs[id], rolloff: -12 }).connect(channel);
      filters[id] = filter;
      let downstream: ToneNode = filter;
      const track = byId[id];
      for (let i = INSERT_EFFECT_ORDER.length - 1; i >= 0; i -= 1) {
        const effectId = INSERT_EFFECT_ORDER[i];
        const node = createInsertEffect(Tone, effectId) as unknown as ToneNode;
        (node as unknown as { wet: { value: number } }).wet.value = Math.max(0, Math.min(1, track?.effects?.[effectId] ?? 0));
        node.connect(downstream);
        downstream = node;
      }
      chainHeads[id] = downstream;
    }
    // Reverbのインパルス生成完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 60));

    const kickTrack = byId.kick;
    const snareTrack = byId.snare;
    const hatTrack = byId.hat;
    const bassTrack = byId.bass;
    const synthTrack = byId.synth;

    const kickPreset = kickPresets[kickTrack?.soundId ?? ""] ?? kickPresets["909 solid"];
    const snarePreset = snarePresets[snareTrack?.soundId ?? ""] ?? snarePresets["dry plate"];
    const hatPreset = hatPresets[hatTrack?.soundId ?? ""] ?? hatPresets["metal ticks"];
    const bassPreset = bassPresets[bassTrack?.soundId ?? ""] ?? bassPresets["sine pulse"];
    const leadPreset = leadPresets[synthTrack?.soundId ?? ""] ?? leadPresets["saw stab"];

    if (kickTrack) {
      filters.kick.frequency.value = filterFrequency(kickTrack.filter, 320, 9000);
    }
    if (snareTrack) {
      filters.snare.frequency.value = filterFrequency(snareTrack.filter, 700, 11000);
    }
    if (hatTrack) {
      filters.hat.frequency.value = filterFrequency(hatTrack.filter, 1500, 14000);
    }
    if (bassTrack) {
      filters.bass.frequency.value = filterFrequency(bassTrack.filter, 90, 3200);
      filters.bass.Q.value = bassPreset.q;
    }
    if (synthTrack) {
      filters.synth.frequency.value = filterFrequency(synthTrack.filter, 400, 9000);
    }

    const kick = new Tone.MembraneSynth({
      volume: 4,
      pitchDecay: kickPreset.pitchDecay,
      octaves: kickPreset.octaves,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: kickPreset.decay, sustain: 0.01, release: 0.15 }
    }).connect(chainHeads.kick);

    const snare = new Tone.NoiseSynth({
      volume: snarePreset.volume,
      noise: { type: snarePreset.noiseType },
      envelope: { attack: 0.001, decay: snarePreset.decay, sustain: 0.01, release: 0.08 }
    }).connect(chainHeads.snare);

    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: hatPreset.decay, release: 0.015 },
      harmonicity: 4.8,
      modulationIndex: 18,
      resonance: 2800,
      octaves: 1.2
    }).connect(chainHeads.hat);
    hat.frequency.value = hatPreset.frequency;

    const bass = new Tone.MonoSynth({
      volume: 8,
      oscillator: { type: bassPreset.oscillator },
      filter: { Q: 1.4, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.002, decay: 0.11, sustain: 0.18, release: 0.06 },
      filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.18, release: 0.08, baseFrequency: 80, octaves: 2.4 }
    }).connect(chainHeads.bass);

    const synth = new Tone.MonoSynth({
      volume: leadPreset.gain,
      oscillator: { type: leadPreset.oscillator },
      filter: { Q: 1.1, type: "lowpass", rolloff: -12 },
      envelope: { attack: 0.004, decay: leadPreset.decay, sustain: leadPreset.sustain, release: 0.12 },
      filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.3, release: 0.14, baseFrequency: 400, octaves: 3 }
    }).connect(chainHeads.synth);

    const loopBars = Math.max(1, snapshot.loopBars ?? 1);

    for (let bar = 1; bar <= GROOVE_BARS; bar += 1) {
      const chord = chordForBar(bar, snapshot.intent, snapshot.progressionIndex);
      for (let step = 0; step < STEPS; step += 1) {
        const time = lead + ((bar - 1) * STEPS + step) * stepDuration;
        // パターン配列上の絶対ステップ番号(ループ長で折り返す)
        const abs = ((bar - 1) % loopBars) * STEPS + step;

        snapshot.tracks.forEach((track) => {
          if (track.muted || !track.steps[abs]?.enabled) {
            return;
          }
          const velocity = (track.steps[abs]?.velocity ?? 0.55) * track.volume;

          if (track.id === "kick") {
            kick.triggerAttackRelease(kickPreset.note, "16n", time, velocity);
          }
          if (track.id === "snare") {
            snare.triggerAttackRelease("16n", time, velocity * 0.9);
          }
          if (track.id === "hat") {
            hat.triggerAttackRelease(hatPreset.frequency, "32n", time, velocity * 0.54);
          }
          if (track.id === "bass") {
            bass.triggerAttackRelease(bassNoteForStep(chord, step), "16n", time, velocity * 0.9);
          }
          if (track.id === "synth") {
            const note = track.steps[abs]?.note ?? "A3";
            if (snapshot.tieSynth) {
              const prev = abs > 0 ? track.steps[abs - 1] : undefined;
              if (prev?.enabled && (prev.note ?? "A3") === note) {
                return;
              }
              let count = 1;
              while (abs + count < track.steps.length) {
                const nextStep = track.steps[abs + count];
                if (!nextStep?.enabled || (nextStep.note ?? "A3") !== note) {
                  break;
                }
                count += 1;
              }
              synth.triggerAttackRelease(note, count * stepDuration, time, velocity * 0.85);
            } else {
              synth.triggerAttackRelease(note, "16n", time, velocity * 0.85);
            }
          }
        });
      }
    }
  }, duration);

  return rendered.get() as AudioBuffer;
};

// AudioBufferをMP3(192kbps)へエンコードする
const encodeMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, 192);

  const toInt16 = (data: Float32Array) => {
    const out = new Int16Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.max(-1, Math.min(1, data[i]));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
  };

  const left = toInt16(buffer.getChannelData(0));
  const right = channels === 2 ? toInt16(buffer.getChannelData(1)) : left;

  const chunks: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < left.length; i += blockSize) {
    const chunk =
      channels === 2
        ? encoder.encodeBuffer(left.subarray(i, i + blockSize), right.subarray(i, i + blockSize))
        : encoder.encodeBuffer(left.subarray(i, i + blockSize));
    if (chunk.length > 0) {
      chunks.push(new Uint8Array(chunk));
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) {
    chunks.push(new Uint8Array(tail));
  }

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
};

export const downloadGrooveMp3 = async (snapshot: AppSnapshot, title: string) => {
  const buffer = await renderGrooveBuffer(snapshot);
  const blob = await encodeMp3(buffer);
  downloadBlob(blob, `${sanitizeFileName(title)}.mp3`);
};
