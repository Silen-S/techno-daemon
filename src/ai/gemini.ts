import { soundPools } from "@/mutation/mutate";
import { buildTrackFromDirective, generateMelody, type TrackDirective } from "@/mutation/transform";
import { STEPS } from "@/patterns/defaults";
import { ALL_INTENTS, melodyPoolFor, nearestInPool } from "@/theory/harmony";
import type { AppSnapshot, PresetIntent, TrackId } from "@/types";

// Gemini APIで「目標アレンジ」を生成する。
// 別アプリ(sapporo-sakura-quest)と同じクラウド側(AI Studioキー)を
// フロントから直接叩く方式。キーはビルド時に埋め込まれる。

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20000;

export const hasGeminiKey = () => API_KEY.length > 0;

export type AiArrangement = {
  target: AppSnapshot;
  intent: PresetIntent;
  bpm: number;
};

// Geminiに返させるJSONの形
type AiResponse = {
  intent?: string;
  bpm?: number;
  tracks?: Partial<
    Record<
      TrackId,
      {
        density?: number;
        filter?: number;
        soundId?: string;
        velocity?: number;
        notes?: string[];
      }
    >
  >;
};

const TRACK_IDS: TrackId[] = ["kick", "snare", "hat", "bass", "synth"];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildPrompt = (snapshot: AppSnapshot, request: string) => {
  const current = snapshot.tracks
    .map((track) => `${track.id}: sound="${track.soundId}" density=${track.density.toFixed(2)} filter=${track.filter.toFixed(2)}`)
    .join("\n");
  const pools = ALL_INTENTS.map((intent) => `${intent}: [${melodyPoolFor(intent).join(", ")}]`).join("\n");

  return `You are a techno/rave arrangement director for a 16-step, 5-track sequencer in A minor.
Design the NEXT arrangement based on the user's request. Respond with JSON only.

## User request
${request || "(none — surprise me, keep it rave)"}

## Current state
bpm=${snapshot.bpm}, intent=${snapshot.intent}
${current}

## Rules
- "intent": choose one of: ${ALL_INTENTS.join(", ")}. Pick what best matches the request.
- "bpm": integer 80-150.
- "tracks": object with keys kick, snare, hat, bass, synth. Each has:
  - "density": 0.0-1.0 (how busy the pattern is)
  - "filter": 0.0-1.0 (lowpass cutoff, 0=dark 1=bright)
  - "velocity": 0.3-0.8 (base loudness)
  - "soundId": choose from the allowed list below
  - synth only: "notes": exactly ${STEPS} note names, ALL chosen from the melody pool of YOUR chosen intent (see below). Make it a musical phrase (steps, neighbor motion, some repetition).
- Allowed soundIds:
${TRACK_IDS.map((id) => `  ${id}: [${soundPools[id].join(", ")}]`).join("\n")}
- Melody pools per intent:
${pools}

## Output JSON shape
{"intent":"...","bpm":128,"tracks":{"kick":{"density":0.7,"filter":0.6,"velocity":0.6,"soundId":"909 solid"},"snare":{...},"hat":{...},"bass":{...},"synth":{...,"notes":["A3",...]}}}`;
};

// AIの出力を安全な指示に変換する(壊れた値はすべて補正)
const sanitize = (snapshot: AppSnapshot, raw: AiResponse): AiArrangement => {
  const intent = ALL_INTENTS.includes(raw.intent as PresetIntent) ? (raw.intent as PresetIntent) : snapshot.intent;
  const pool = melodyPoolFor(intent);
  const bpm = Number.isFinite(raw.bpm) ? clamp(Math.round(raw.bpm as number), 80, 150) : snapshot.bpm;

  const tracks = snapshot.tracks.map((track) => {
    const d = raw.tracks?.[track.id] ?? {};
    const rawNotes = Array.isArray(d.notes) ? d.notes : null;
    const notes =
      track.id === "synth"
        ? rawNotes && rawNotes.length > 0
          ? Array.from({ length: STEPS }, (_, i) => nearestInPool(String(rawNotes[i % rawNotes.length]), pool))
          : generateMelody(pool)
        : undefined;

    const directive: TrackDirective = {
      density: Number.isFinite(d.density) ? (d.density as number) : track.density,
      filter: Number.isFinite(d.filter) ? (d.filter as number) : track.filter,
      soundId: typeof d.soundId === "string" ? d.soundId : track.soundId,
      baseVelocity: Number.isFinite(d.velocity) ? (d.velocity as number) : 0.55,
      notes
    };
    return buildTrackFromDirective(track, directive);
  });

  return {
    intent,
    bpm,
    target: { ...snapshot, intent, bpm, tracks }
  };
};

const callGemini = async (prompt: string): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.9
        }
      })
    });
  } finally {
    clearTimeout(timer);
  }
};

export const generateArrangementWithAI = async (snapshot: AppSnapshot, request: string): Promise<AiArrangement> => {
  if (!hasGeminiKey()) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
  }

  const prompt = buildPrompt(snapshot, request);
  let response = await callGemini(prompt);

  // 一時的な過負荷(503)やレート制限(429)は1回だけリトライする
  if (response.status === 503 || response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await callGemini(prompt);
  }

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API returned no content");
  }

  return sanitize(snapshot, JSON.parse(text) as AiResponse);
};
