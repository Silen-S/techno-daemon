import type { InsertEffectId } from "@/types";

type ToneModule = typeof import("tone");
type ToneEffect = { wet: { value: number }; connect: (node: unknown) => unknown; dispose: () => void };

// テクノでよく使うインサートエフェクト。かかり具合(0..1)は各エフェクトのwetに写像する。
// トラックの音源→(この順で直列)→ローパスフィルター→センド の順に繋ぐ。
export const INSERT_EFFECT_ORDER: InsertEffectId[] = [
  "distortion",
  "bitcrusher",
  "chorus",
  "phaser",
  "tremolo",
  "autofilter",
  "autopanner",
  "delay",
  "reverb"
];

// UIやMutationで扱う全エフェクト(filterはトラックのfilter値で別管理)
export const ALL_EFFECT_IDS = ["filter", ...INSERT_EFFECT_ORDER] as const;

const build = (Tone: ToneModule, id: InsertEffectId): ToneEffect => {
  switch (id) {
    case "distortion":
      return new Tone.Distortion(0.45) as unknown as ToneEffect;
    case "bitcrusher":
      return new Tone.BitCrusher(4) as unknown as ToneEffect;
    case "chorus":
      return new Tone.Chorus(3.5, 3, 0.6).start() as unknown as ToneEffect;
    case "phaser":
      return new Tone.Phaser({ frequency: 0.6, octaves: 3, baseFrequency: 350 }) as unknown as ToneEffect;
    case "tremolo":
      return new Tone.Tremolo(9, 0.75).start() as unknown as ToneEffect;
    case "autofilter":
      return new Tone.AutoFilter("8n").start() as unknown as ToneEffect;
    case "autopanner":
      return new Tone.AutoPanner("4n").start() as unknown as ToneEffect;
    case "delay":
      return new Tone.FeedbackDelay("8n.", 0.3) as unknown as ToneEffect;
    case "reverb":
      return new Tone.Reverb(2.6) as unknown as ToneEffect;
    default:
      return new Tone.Distortion(0.45) as unknown as ToneEffect;
  }
};

export const createInsertEffect = (Tone: ToneModule, id: InsertEffectId): ToneEffect => {
  const node = build(Tone, id);
  // 既定はバイパス(wet=0)。かかり具合はengine側でwetに反映する
  node.wet.value = 0;
  return node;
};
