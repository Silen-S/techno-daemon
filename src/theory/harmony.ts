import type { PresetIntent } from "@/types";

// Aマイナーを基調に、雰囲気(Intent)ごとにコード進行とメロディー音域を変える。
// 1小節=1コードで4小節ループする。

export type Chord = {
  name: string;
  degree: string;
  bassRoot: string;
  bassFifth: string;
  tones: string[];
};

export const KEY_LABEL = "A minor";

const chords = {
  Am: { name: "Am", degree: "i", bassRoot: "A1", bassFifth: "E2", tones: ["A", "C", "E"] },
  Em: { name: "Em", degree: "v", bassRoot: "E1", bassFifth: "B1", tones: ["E", "G", "B"] },
  Dm: { name: "Dm", degree: "iv", bassRoot: "D2", bassFifth: "A2", tones: ["D", "F", "A"] },
  F: { name: "F", degree: "VI", bassRoot: "F1", bassFifth: "C2", tones: ["F", "A", "C"] },
  C: { name: "C", degree: "III", bassRoot: "C2", bassFifth: "G2", tones: ["C", "E", "G"] },
  G: { name: "G", degree: "VII", bassRoot: "G1", bassFifth: "D2", tones: ["G", "B", "D"] },
  E: { name: "E", degree: "V", bassRoot: "E1", bassFifth: "B1", tones: ["E", "G#", "B"] },
  Bb: { name: "Bb", degree: "bII", bassRoot: "Bb1", bassFifth: "F2", tones: ["Bb", "D", "F"] }
} satisfies Record<string, Chord>;

// Intentごとの進行。darkはフリジアンのbIIとハーモニックマイナーのVで陰影を付ける
const progressions: Record<PresetIntent, Chord[]> = {
  coding: [chords.Am, chords.F, chords.C, chords.G],
  relax: [chords.Am, chords.Em, chords.F, chords.G],
  dark: [chords.Am, chords.Bb, chords.Am, chords.E],
  cyber: [chords.Am, chords.C, chords.Dm, chords.E]
};

// Intentごとのメロディー音の母集合。darkは低音域+F(短6度)で暗さを出す
const melodyPools: Record<PresetIntent, string[]> = {
  coding: ["A3", "C4", "D4", "E4", "G4", "A4", "C5"],
  relax: ["E3", "G3", "A3", "C4", "D4", "E4"],
  dark: ["A2", "C3", "D3", "E3", "F3", "G3", "A3"],
  cyber: ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"]
};

export const progressionFor = (intent: PresetIntent) => progressions[intent];
export const melodyPoolFor = (intent: PresetIntent) => melodyPools[intent];

export const chordForBar = (bar: number, intent: PresetIntent): Chord => {
  const progression = progressions[intent];
  const index = ((bar - 1) % progression.length + progression.length) % progression.length;
  return progression[index];
};

// ベースはコードのルートを主体に、8分裏で5thを差し込む
export const bassNoteForStep = (chord: Chord, step: number) =>
  step % 4 === 2 ? chord.bassFifth : chord.bassRoot;

const pitchClasses: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

export const noteToMidi = (note: string): number => {
  const match = /^([A-G][#b]?)(-?\d+)$/.exec(note);
  if (!match) {
    return 57; // A3
  }
  return (pitchClasses[match[1]] ?? 9) + (Number(match[2]) + 1) * 12;
};

// プール内で最も近い音へ寄せる(Intent切替時の移調に使う)。
// まずオクターブ単位でプールの音域内へ折り返し、旋律の輪郭を保つ
export const nearestInPool = (note: string, pool: string[]): string => {
  let midi = noteToMidi(note);
  const midis = pool.map(noteToMidi);
  const low = Math.min(...midis);
  const high = Math.max(...midis);
  while (midi > high) {
    midi -= 12;
  }
  while (midi < low) {
    midi += 12;
  }
  let best = pool[0];
  let bestDistance = Infinity;
  for (let i = 0; i < pool.length; i += 1) {
    const distance = Math.abs(midis[i] - midi);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = pool[i];
    }
  }
  return best;
};
