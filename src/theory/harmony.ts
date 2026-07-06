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
  D: { name: "D", degree: "IV", bassRoot: "D2", bassFifth: "A2", tones: ["D", "F#", "A"] },
  F: { name: "F", degree: "VI", bassRoot: "F1", bassFifth: "C2", tones: ["F", "A", "C"] },
  C: { name: "C", degree: "III", bassRoot: "C2", bassFifth: "G2", tones: ["C", "E", "G"] },
  G: { name: "G", degree: "VII", bassRoot: "G1", bassFifth: "D2", tones: ["G", "B", "D"] },
  E: { name: "E", degree: "V", bassRoot: "E1", bassFifth: "B1", tones: ["E", "G#", "B"] },
  Bb: { name: "Bb", degree: "bII", bassRoot: "Bb1", bassFifth: "F2", tones: ["Bb", "D", "F"] }
} satisfies Record<string, Chord>;

export type Progression = {
  label: string;
  chords: Chord[];
};

const c = chords;

// Intentごとに複数のコード進行を用意し、Transformや雰囲気切替で選び替える。
// 4小節と8小節を混在させて展開の幅を広げている。
const progressions: Record<PresetIntent, Progression[]> = {
  coding: [
    { label: "i-VI-III-VII", chords: [c.Am, c.F, c.C, c.G] },
    { label: "i-III-VII-v", chords: [c.Am, c.C, c.G, c.Em] },
    { label: "i-iv-VII-III", chords: [c.Am, c.Dm, c.G, c.C] },
    { label: "8bar drive", chords: [c.Am, c.F, c.G, c.Am, c.F, c.C, c.G, c.Em] }
  ],
  relax: [
    { label: "i-v-VI-VII", chords: [c.Am, c.Em, c.F, c.G] },
    { label: "i-III-VI-III", chords: [c.Am, c.C, c.F, c.C] },
    { label: "i-VI-iv-v", chords: [c.Am, c.F, c.Dm, c.Em] },
    { label: "8bar float", chords: [c.Am, c.Em, c.F, c.C, c.Dm, c.Em, c.F, c.G] }
  ],
  dark: [
    // フリジアンのbIIとハーモニックマイナーのVで陰影を付ける
    { label: "i-bII-i-V", chords: [c.Am, c.Bb, c.Am, c.E] },
    { label: "i-VI-V", chords: [c.Am, c.F, c.E, c.E] },
    { label: "Andalusian", chords: [c.Am, c.G, c.F, c.E] },
    { label: "8bar phrygian", chords: [c.Am, c.Bb, c.F, c.E, c.Am, c.Dm, c.Bb, c.E] }
  ],
  cyber: [
    { label: "i-III-iv-V", chords: [c.Am, c.C, c.Dm, c.E] },
    { label: "i-VI-III-V", chords: [c.Am, c.F, c.C, c.E] },
    // D majorはドリアンのリフトでトランス的な高揚感を出す
    { label: "i-IV-VI-VII", chords: [c.Am, c.D, c.F, c.G] },
    { label: "8bar rave", chords: [c.Am, c.C, c.G, c.D, c.Dm, c.F, c.G, c.E] }
  ],
  hypnotic: [
    // 動きを最小限にして反復による催眠感を出す
    { label: "i-i-i-v", chords: [c.Am, c.Am, c.Am, c.Em] },
    { label: "i-i-VI-VI", chords: [c.Am, c.Am, c.F, c.F] },
    { label: "i-v-i-v", chords: [c.Am, c.Em, c.Am, c.Em] }
  ],
  acid: [
    { label: "i-i-III-VII", chords: [c.Am, c.Am, c.C, c.G] },
    { label: "i-VII-i-VI", chords: [c.Am, c.G, c.Am, c.F] },
    { label: "i-III-iv-VII", chords: [c.Am, c.C, c.Dm, c.G] }
  ],
  dub: [
    { label: "i-iv-i-v", chords: [c.Am, c.Dm, c.Am, c.Em] },
    { label: "i-VI-iv-i", chords: [c.Am, c.F, c.Dm, c.Am] },
    { label: "i-v-iv-v", chords: [c.Am, c.Em, c.Dm, c.Em] }
  ],
  euphoric: [
    // 平行長調のC durを基準にした高揚感のある進行
    { label: "III-VII-i-VI", chords: [c.C, c.G, c.Am, c.F] },
    { label: "VI-III-VII-i", chords: [c.F, c.C, c.G, c.Am] },
    { label: "8bar lift", chords: [c.Am, c.F, c.C, c.G, c.F, c.C, c.G, c.G] }
  ],
  industrial: [
    // bIIを多用して不穏で機械的な質感を出す
    { label: "i-bII-i-bII", chords: [c.Am, c.Bb, c.Am, c.Bb] },
    { label: "i-VI-bII-V", chords: [c.Am, c.F, c.Bb, c.E] },
    { label: "i-i-bII-V", chords: [c.Am, c.Am, c.Bb, c.E] }
  ],
  dreamy: [
    { label: "i-III-VII-v", chords: [c.Am, c.C, c.G, c.Em] },
    { label: "i-v-III-VII", chords: [c.Am, c.Em, c.C, c.G] },
    { label: "VI-III-i-v", chords: [c.F, c.C, c.Am, c.Em] }
  ]
};

// Intentごとのメロディー音の母集合。darkは低音域+F(短6度)で暗さを出す
const melodyPools: Record<PresetIntent, string[]> = {
  coding: ["A3", "C4", "D4", "E4", "G4", "A4", "C5"],
  relax: ["E3", "G3", "A3", "C4", "D4", "E4"],
  dark: ["A2", "C3", "D3", "E3", "F3", "G3", "A3"],
  cyber: ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"],
  // 反復重視で音数を絞る
  hypnotic: ["A3", "C4", "E4", "A4"],
  acid: ["A3", "C4", "D4", "E4", "G4", "A4"],
  // 低め・広がりのあるダブ
  dub: ["E3", "A3", "C4", "D4", "E4"],
  // 高域中心で多幸感
  euphoric: ["C4", "E4", "G4", "A4", "C5", "E5"],
  // 低域+短2度で不穏
  industrial: ["A2", "C3", "E3", "F3", "A3", "Bb3"],
  // 高域の浮遊感
  dreamy: ["E4", "G4", "A4", "C5", "D5", "E5"]
};

export const melodyPoolFor = (intent: PresetIntent) => melodyPools[intent];

// 雰囲気ごとの進行の本数
export const progressionCountFor = (intent: PresetIntent) => progressions[intent].length;

const clampIndex = (intent: PresetIntent, index: number) => {
  const list = progressions[intent];
  return ((index % list.length) + list.length) % list.length;
};

export const progressionFor = (intent: PresetIntent, index: number): Progression =>
  progressions[intent][clampIndex(intent, index)];

// 現在の雰囲気からランダムに別の進行を選ぶ(同じ番号は避ける)
export const randomProgressionIndex = (intent: PresetIntent, exclude?: number): number => {
  const count = progressions[intent].length;
  if (count <= 1) {
    return 0;
  }
  let next = Math.floor(Math.random() * count);
  while (next === exclude) {
    next = Math.floor(Math.random() * count);
  }
  return next;
};

export const chordForBar = (bar: number, intent: PresetIntent, progressionIndex: number): Chord => {
  const progression = progressions[intent][clampIndex(intent, progressionIndex)].chords;
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
