# ジェネレーティブ作業用テクノWebアプリ 要件定義書（MVP）

## 1. 概要

### プロジェクト名（仮）

* NULLBEAT
* LOOPSTATE
* MUT8

### 目的

作業・集中用途に特化した、無限生成型ミニマルテクノWebアプリを開発する。

一般的な「曲再生サービス」ではなく、

* 微細変化
* 永続ループ
* 集中阻害を避ける
* ユーザーによる局所進化

を重視した、ジェネレーティブ音楽システムを目指す。

---

# 2. MVPスコープ

## 開発期間

3日

## 目的

最低限「触って面白い」状態まで到達すること。

MVPでは、
高度なAI生成ではなく、

* ルールベース
* 確率ベース
* シーケンサー型

で構築する。

---

# 3. システム構成

## フロントエンド

### 技術

* Next.js (App Router)
* TypeScript
* React

## 音響エンジン

### 技術

* Web Audio API
* Tone.js

[Tone.js公式サイト](https://tonejs.github.io/?utm_source=chatgpt.com)

理由:

* ブラウザネイティブ
* リアルタイム生成向き
* シーケンサー実装が容易
* 軽量
* LFO/Transport/effectが充実

([tonejs.github.io][1])

---

# 4. コンセプト

## 基本思想

### 「1変更ずつ進化する無限ループ」

特徴:

* 一度に大きく変化しない
* 変更を1つずつ適用
* 気に入らなければ戻せる
* ユーザーが徐々に育てる

---

# 5. 機能要件

# 5.1 再生機能

## 必須

### Play / Stop

* 再生開始
* 停止

### BPM変更

範囲:

* 80〜150

デフォルト:

* 128

---

# 5.2 トラック構成

## MVPトラック

| Track      | 内容    |
| ---------- | ----- |
| Kick       | キック   |
| Snare/Clap | スネア   |
| Hat        | ハイハット |
| Bass       | ベース   |

---

# 5.3 音源方式

## Hybrid構成

### Drum

サンプルベース

* 808/909系

### Bass/Synth

シンセ生成

* Oscillator
* Filter
* Envelope

---

# 5.4 シーケンサー

## ステップ数

* 16step固定

## 拍子

* 4/4固定

## 小節ループ

* 無限ループ

---

# 5.5 Mutation機能（最重要）

## 概要

一定小節ごとに、
指定対象を1箇所だけ変化させる。

---

## WHAT（何を変えるか）

ユーザー選択可能。

### 対象候補

| 項目       | 内容      |
| -------- | ------- |
| Pattern  | リズム変更   |
| Sound    | 音色変更    |
| Filter   | フィルター変更 |
| Density  | 発音密度変更  |
| Velocity | ベロシティ変更 |

---

## WHEN（いつ変えるか）

ユーザー選択可能。

### 候補

* Manual
* 4 bars
* 8 bars
* 16 bars

---

## Mutationルール

### 原則

1回につき1変更のみ。

例:

* Hat pattern変更
* Kick音色変更

など。

---

## 変更制約

完全ランダムは禁止。

事前定義された
「安全な候補群」
から選択する。

---

# 5.6 Accept / Revert

## Accept

変更内容を確定。

## Revert

直前状態へ戻す。

---

# 5.7 History

最低1段階Undo対応。

理想:

* 複数履歴

---

# 5.8 パターン生成

## 基本方式

ルールベース生成。

---

## 候補

### Euclidean Rhythm

例:

* 16step中5発

### Probability

例:

* ghost note率
* fill率

---

# 5.9 Text連動（簡易版）

## 入力

テキスト入力欄。

---

## 反映内容（MVP）

### キーワードベース

例:

| 入力     | 変化         |
| ------ | ---------- |
| coding | mechanical |
| relax  | ambient    |
| dark   | lowpass    |
| cyber  | distortion |

---

# 5.10 Image連動（簡易版）

## 入力

画像アップロード。

---

## 解析内容

平均色のみ。

---

## 音反映例

| 色傾向 | 音変化            |
| --- | -------------- |
| 青   | cold texture   |
| 赤   | distortion     |
| 暗い  | lowpass        |
| 明るい | high frequency |

---

# 5.11 時間連動

## 再生時間

### 長時間再生時

徐々に:

* 高域減少
* BPM微低下
* Reverb増加

---

## 時間帯

| 時間 | 傾向          |
| -- | ----------- |
| 朝  | dry         |
| 夜  | dub/ambient |

---

# 6. 非機能要件

# 6.1 パフォーマンス

## 必須条件

低負荷。

---

## 制約

### 同時発音数

最小限。

### エフェクト

最低限。

### AI推論

MVPでは禁止。

---

# 6.2 ブラウザ対応

## 対応対象

* Chrome（最優先）
* Edge

Safari最適化は後回し。

---

# 6.3 保存

## localStorage

以下を保存:

* BPM
* pattern
* sound
* mutation設定

---

# 7. UI要件

# 7.1 デザイン方針

## キーワード

* 無機質
* 工業的
* DAW風
* Minimal

---

# 7.2 MVP UI

## 必須UI

### Transport

* Play
* Stop
* BPM

### Track

各トラックごと:

* Mute
* Mutation対象

### Mutation

* timing selector
* mutate button
* accept
* revert

---

# 8. 状態管理

## 推奨

* Zustand

---

# 9. データ構造案

```ts
type TrackState = {
  pattern: boolean[]
  soundId: string
  filter: number
  density: number
  velocity: number[]
}

type AppState = {
  bpm: number
  tracks: TrackState[]
  history: AppState[]
}
```

---

# 10. ディレクトリ構成案

```text
src/
  app/
  components/
  audio/
  mutation/
  patterns/
  hooks/
  store/
  utils/
```

---

# 11. 実装優先順位

# Day1

## 必須

* Tone.js導入
* 4track再生
* 16step sequencer
* BPM変更

---

# Day2

## 必須

* Mutation
* Accept/Revert
* 状態管理
* UI

---

# Day3

## 必須

* localStorage
* text/image連動
* 微調整
* デザイン整理

---

# 12. 将来拡張

## 候補

### AI連動

* LLM mood解析
* 画像embedding

### MIDI

* 外部コントローラ

### Ableton Link

同期機能。

### マルチユーザー

同じセッション共有。

### 自動学習

集中時間から最適化。

---

# 13. MVPでやらないこと

## 非対象

* DAW化
* 曲構成生成
* 歌メロ生成
* 高度AI作曲
* WAV export
* 本格ミキサー
* VST対応

---

# 14. 成功条件

MVP成功条件:

* ブラウザで安定再生できる
* Mutationが気持ち良い
* 「ずっと流せる」
* CPU負荷が低い
* 作業中に邪魔にならない

---

# 15. 開発メモ

## Tone.js注意点

ブラウザはユーザー操作なしで音を再生できないため、
初回Play時に `Tone.start()` が必要。

([GitHub][2])

## Next.js注意点

音響処理は完全client-sideで行う。

SSR対象外。

[1]: https://tonejs.github.io/?utm_source=chatgpt.com "Tone.js"
[2]: https://github.com/Tonejs/Tone.js?utm_source=chatgpt.com "GitHub - Tonejs/Tone.js: A Web Audio framework for making interactive music in the browser."
