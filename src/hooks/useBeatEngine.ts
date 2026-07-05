"use client";

import { useEffect, useRef } from "react";
import { BeatEngine } from "@/audio/engine";
import { useBeatStore } from "@/store/useBeatStore";

export const useBeatEngine = () => {
  const engineRef = useRef<BeatEngine | null>(null);
  const intervalRef = useRef(useBeatStore.getState().mutationInterval);
  const requestMutationRef = useRef(useBeatStore.getState().requestMutation);
  const tracks = useBeatStore((state) => state.tracks);
  const bpm = useBeatStore((state) => state.bpm);
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
        const currentInterval = intervalRef.current;
        if (currentInterval !== "manual" && bar > 0 && bar % Number(currentInterval) === 0) {
          requestMutationRef.current();
        }
      }
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [setActiveStep, setBar]);

  useEffect(() => {
    engineRef.current?.update(tracks, bpm);
  }, [tracks, bpm]);

  return engineRef;
};
