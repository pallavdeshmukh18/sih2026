import { useEffect, useRef } from "react";
import { createOrb, createOrbTheme } from "orbloom";
import "orbloom/styles.css";

const theme = createOrbTheme({
  preset: "core-orange-02",
  seed: 4.70,
  colors: {
    base: "#2E1408",
    interior: "#ffffff",
    accents: ["#FF8A4C", "#FFC24B", "#FF5E62"],
  },
  appearance: { intensity: 0.86, detail: 1, glass: 0.4, glow: 1 },
  motion: { speed: 1, drift: 1 },
  audioResponse: { brightness: 1, motion: 1, pulse: 1 },
});

export default function VoiceOrb({ state = "idle", mediaStream = null, audioSource = null, className = "" }) {
  const canvasRef = useRef(null);
  const orbRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const orb = createOrb(canvasRef.current, {
      theme,
      state: "idle",
      quality: "balanced",
      reducedMotion: "user",
    });
    orb.setAudioLevel(0);
    orbRef.current = orb;

    return () => {
      orb.destroy();
      orbRef.current = null;
    };
  }, []);

  useEffect(() => {
    orbRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb || !audioSource) return undefined;

    const detach = orb.attachAudioSource(audioSource);
    return () => {
      detach();
      orb.releaseAudioSource(audioSource);
    };
  }, [audioSource]);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb || !mediaStream) return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audioContext = new AudioContextClass();
    const streamSource = audioContext.createMediaStreamSource(mediaStream);
    const analyser = audioContext.createAnalyser();
    streamSource.connect(analyser);
    const detach = orb.attachAudioSource(analyser);
    audioContext.resume().catch(() => {});

    return () => {
      detach();
      streamSource.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [mediaStream]);

  return (
    <div className={`orb-motion ${className}`.trim()} aria-hidden="true">
      <div className="orb-shell">
        <div className="orb-clip">
          <canvas ref={canvasRef} className="orb-canvas" />
          <div className="orb-fallback" />
        </div>
        <div className="orb-chrome" />
      </div>
    </div>
  );
}
