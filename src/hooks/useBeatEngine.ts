"use client";

import { useEffect, useRef } from "react";
import { BeatEngine } from "@/audio/engine";
import { useBeatStore } from "@/store/useBeatStore";

// 雰囲気の提案ダイアログを出す間隔(小節)
const INTENT_PROMPT_BARS = 32;

export const useBeatEngine = () => {
  const engineRef = useRef<BeatEngine | null>(null);
  const intervalRef = useRef(useBeatStore.getState().mutationInterval);
  const requestMutationRef = useRef(useBeatStore.getState().requestMutation);
  const tracks = useBeatStore((state) => state.tracks);
  const bpm = useBeatStore((state) => state.bpm);
  const intent = useBeatStore((state) => state.intent);
  const progressionIndex = useBeatStore((state) => state.progressionIndex);
  const tieSynth = useBeatStore((state) => state.tieSynth);
  const loopBars = useBeatStore((state) => state.loopBars);
  const interval = useBeatStore((state) => state.mutationInterval);
  const setActiveStep = useBeatStore((state) => state.setActiveStep);
  const setBar = useBeatStore((state) => state.setBar);
  const requestMutation = useBeatStore((state) => state.requestMutation);

  useEffect(() => {
    intervalRef.current = interval;
    requestMutationRef.current = requestMutation;
  }, [interval, requestMutation]);

  useEffect(() => {
    engineRef.current = new BeatEngine({
      onStep: setActiveStep,
      onBar: (bar) => {
        setBar(bar);

        const store = useBeatStore.getState();

        // 開始イントロ: 4小節ごとに1トラックずつミュート解除する
        if (store.intro !== null && bar > 1 && bar % 4 === 1) {
          store.introTick();
        }

        // モーフ中は1小節ごとに目標アレンジへ近づけ、通常のMutationは行わない
        if (store.morph) {
          store.morphTick();
          return;
        }

        // 未確定の変化が指定ループ数を超えたら自動でAcceptする
        if (
          store.pending &&
          store.autoAccept !== "off" &&
          store.pendingSinceBar !== null &&
          bar - store.pendingSinceBar >= Number(store.autoAccept)
        ) {
          store.acceptMutation(true);
        }

        const currentInterval = intervalRef.current;
        if (currentInterval !== "manual" && bar > 0 && bar % Number(currentInterval) === 0) {
          requestMutationRef.current();
        }

        // 一定小節ごとに次の雰囲気をダイアログで提案する
        if (store.intentPromptEnabled && !store.intentPrompt && bar > 0 && bar % INTENT_PROMPT_BARS === 0) {
          store.openIntentPrompt();
        }
      }
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [setActiveStep, setBar]);

  useEffect(() => {
    engineRef.current?.update(tracks, bpm, intent, progressionIndex, tieSynth, loopBars);
  }, [tracks, bpm, intent, progressionIndex, tieSynth, loopBars]);

  return engineRef;
};
