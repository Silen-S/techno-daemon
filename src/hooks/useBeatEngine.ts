"use client";

import { useEffect, useRef } from "react";
import { BeatEngine } from "@/audio/engine";
import { useBeatStore } from "@/store/useBeatStore";

export const useBeatEngine = () => {
  const engineRef = useRef<BeatEngine | null>(null);
  const tracks = useBeatStore((state) => state.tracks);
  const bpm = useBeatStore((state) => state.bpm);
  const interval = useBeatStore((state) => state.mutationInterval);
  const setActiveStep = useBeatStore((state) => state.setActiveStep);
  const requestMutation = useBeatStore((state) => state.requestMutation);

  useEffect(() => {
    engineRef.current = new BeatEngine({
      onStep: setActiveStep,
      onBar: (bar) => {
        if (interval !== "manual" && bar > 0 && bar % Number(interval) === 0) {
          requestMutation();
        }
      }
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [interval, requestMutation, setActiveStep]);

  useEffect(() => {
    engineRef.current?.update(tracks, bpm);
  }, [tracks, bpm]);

  return engineRef;
};
