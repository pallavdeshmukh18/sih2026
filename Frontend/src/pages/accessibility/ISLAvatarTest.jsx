import React, { useState } from "react";
import ISLAvatar from "../../components/accessibility/ISLAvatar";
import styles from "./ISLAvatarTest.module.css";

export default function ISLAvatarTest() {
  const [inputText, setInputText] = useState("");
  const [activeText, setActiveText] = useState("");
  const [replayId, setReplayId] = useState(0);
  const [speed, setSpeed] = useState(0.08);
  const [selectedModel, setSelectedModel] = useState("humanbot");

  const handleSign = (textToSign) => {
    const val = (textToSign || inputText).trim();
    if (!val) return;
    setActiveText(val);
    setReplayId((id) => id + 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSign();
    }
  };

  const presets = ["HELLO", "TIME", "HOME", "PERSON", "YOU", "CARE", "NAMASTE"];

  return (
    <div className={styles.pageContainer} data-isl-ignore="true">
      <div className={styles.contentCard}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>ISL Avatar Test</h1>
          <p className={styles.subtitle}>
            3D Indian Sign Language Avatar test harness (Mixamo rig evaluation)
          </p>

          {/* Model Switcher */}
          <div className={styles.modelSwitcher} data-testid="isl-model-switcher">
            <button
              type="button"
              className={`${styles.modelButton} ${selectedModel === "humanbot" ? styles.modelButtonActive : ""}`}
              onClick={() => { setSelectedModel("humanbot"); setActiveText(""); }}
              data-testid="isl-switch-humanbot"
            >
              HumanBot (Female Human)
            </button>
            <button
              type="button"
              className={`${styles.modelButton} ${selectedModel === "ybot" ? styles.modelButtonActive : ""}`}
              onClick={() => { setSelectedModel("ybot"); setActiveText(""); }}
              data-testid="isl-switch-ybot"
            >
              YBot (Original Robot)
            </button>
          </div>
        </div>

        {/* 3D Avatar Display */}
        <div className={styles.avatarSection}>
          <ISLAvatar
            key={selectedModel}
            modelUrl={selectedModel === "humanbot" ? "/models/humanbot-colored.glb" : "/models/ybot.glb"}
            text={activeText}
            visible={true}
            replayId={replayId}
            speed={speed}
            pause={180}
            height={460}
          />
        </div>

        {/* Input Controls */}
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Type a word or sentence (e.g. HELLO)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="isl-test-input"
          />
          <button
            className={styles.signButton}
            onClick={() => handleSign()}
            data-testid="isl-test-sign-btn"
          >
            Sign
          </button>
        </div>

        <label>Signing speed
          <input aria-label="Signing speed" type="range" min="0.04" max="0.12" step="0.01"
            value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
        <p>Word signs: TIME, HOME, PERSON, YOU. Other English words and numbers are fingerspelled.</p>
        {/* Presets */}
        <div className={styles.presetSection}>
          <span className={styles.presetLabel}>Quick Test Words</span>
          <div className={styles.presetButtons}>
            {presets.map((preset) => (
              <button
                key={preset}
                className={styles.presetButton}
                onClick={() => {
                  setInputText(preset);
                  handleSign(preset);
                }}
                data-testid={`isl-preset-${preset.toLowerCase()}`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Info & Status Bar */}
        <div className={styles.statsBar}>
          <span>Engine: Three.js 3D WebGL</span>
          <span>Rig: Mixamo ({selectedModel === "humanbot" ? "HumanBot" : "YBot"})</span>
          <span>Status: {activeText ? `Signing "${activeText}"` : "Ready"}</span>
        </div>
      </div>
    </div>
  );
}
