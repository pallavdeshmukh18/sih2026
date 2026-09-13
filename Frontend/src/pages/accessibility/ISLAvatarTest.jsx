import React, { useState } from "react";
import ISLAvatar from "../../components/accessibility/ISLAvatar";
import styles from "./ISLAvatarTest.module.css";

export default function ISLAvatarTest() {
  const [inputText, setInputText] = useState("");
  const [activeText, setActiveText] = useState("");
  const [signedHistory, setSignedHistory] = useState([]);
  const [selectedModel, setSelectedModel] = useState("humanbot");

  const handleSign = (textToSign) => {
    const val = (textToSign || inputText).trim();
    if (!val) return;
    setActiveText("");
    setTimeout(() => {
      setActiveText(val);
      setSignedHistory((prev) => [val, ...prev.slice(0, 4)]);
    }, 20);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSign();
    }
  };

  const presets = ["HELLO", "TIME", "HOME", "PERSON", "YOU", "CARE", "NAMASTE"];

  return (
    <div className={styles.pageContainer}>
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
            speed={0.09}
            pause={600}
            height={360}
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
