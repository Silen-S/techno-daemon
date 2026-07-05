// Aナチュラルマイナーを基調とした、レイブ/テクノ定番の i–VI–III–VII 進行。
// 1小節=1コードで4小節ループする。

export type Chord = {
  name: string;
  degree: string;
  bassRoot: string;
  bassFifth: string;
  tones: string[];
};

export const KEY_LABEL = "A minor";

export const PROGRESSION: Chord[] = [
  { name: "Am", degree: "i", bassRoot: "A1", bassFifth: "E2", tones: ["A", "C", "E"] },
  { name: "F", degree: "VI", bassRoot: "F1", bassFifth: "C2", tones: ["F", "A", "C"] },
  { name: "C", degree: "III", bassRoot: "C2", bassFifth: "G2", tones: ["C", "E", "G"] },
  { name: "G", degree: "VII", bassRoot: "G1", bassFifth: "D2", tones: ["G", "B", "D"] }
];

export const chordForBar = (bar: number): Chord => {
  const index = ((bar - 1) % PROGRESSION.length + PROGRESSION.length) % PROGRESSION.length;
  return PROGRESSION[index];
};

// Aマイナーペンタトニック。進行中のどのコードにも大きく濁らないため、
// メロディーの音選びの母集合として使う。
export const MELODY_POOL = ["A3", "C4", "D4", "E4", "G4", "A4", "C5"];

export const pitchClass = (note: string) => note.replace(/-?\d+$/, "");

// コードトーンかどうか(テンションよりコードトーンを優先したい場面で使う)
export const isChordTone = (note: string, chord: Chord) => chord.tones.includes(pitchClass(note));

// ベースはコードのルートを主体に、8分裏で5thを差し込む
export const bassNoteForStep = (chord: Chord, step: number) =>
  step % 4 === 2 ? chord.bassFifth : chord.bassRoot;
