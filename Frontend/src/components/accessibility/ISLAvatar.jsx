import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { defaultPose } from "./isl/defaultPose.js";
import * as alphabets from "./isl/alphabets.js";
import * as words from "./isl/words.js";
import { buildBoneMap } from "./isl/boneMapping.js";
import {
  initRetargeting,
  createCanonicalPose,
  getCanonicalRestPose,
  applyRetargetedPose,
} from "./isl/retargeting.js";
import styles from "./ISLAvatar.module.css";

/**
 * ISLAvatar - 3D Indian Sign Language Avatar Component
 *
 * Renders a Mixamo-rigged 3D avatar that performs Indian Sign Language
 * gestures based on input text, using bone rotation keyframe interpolation.
 *
 * @param {Object} props
 * @param {string} [props.text] - Text to sign (word or fingerspelled sequence)
 * @param {boolean} [props.visible=true] - Whether the avatar card is visible
 * @param {number} [props.speed=0.08] - Joint rotation speed per tick (0.04 - 0.20)
 * @param {number} [props.pause=600] - Pause duration in ms between letters/gestures
 * @param {string} [props.modelUrl="/models/humanbot-colored.glb"] - Path to the avatar GLTF model
 * @param {string|number} [props.width="100%"] - Card width
 * @param {string|number} [props.height=380] - Canvas container height
 * @param {string} [props.className] - Optional custom CSS class
 * @param {Function} [props.onSignStart] - Callback when signing begins
 * @param {Function} [props.onSignEnd] - Callback when signing finishes
 */
export default function ISLAvatar({
  text = "",
  visible = true,
  speed = 0.08,
  pause = 600,
  modelUrl = "/models/humanbot-colored.glb",
  width = "100%",
  height = 380,
  className = "",
  onSignStart,
  onSignEnd,
}) {
  const mountRef = useRef(null);
  const runtimeRef = useRef({
    animations: [],
    characters: [],
    flag: false,
    pending: false,
    speed: speed,
    pause: pause,
    avatar: null,
    boneMap: null,
    skeletonReport: null,
    scene: null,
    camera: null,
    renderer: null,
    animFrameId: null,
    pauseTimer: null,
    isLoaded: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [currentToken, setCurrentToken] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  // Keep ref speeds updated without rebuilding scene
  useEffect(() => {
    runtimeRef.current.speed = speed;
    runtimeRef.current.pause = pause;
  }, [speed, pause]);

const INDIC_TO_LATIN = {
  'अ': 'A', 'आ': 'A', 'इ': 'I', 'ई': 'I', 'उ': 'U', 'ऊ': 'U', 'ऋ': 'R', 'ए': 'E', 'ऐ': 'AI', 'ओ': 'O', 'औ': 'AU',
  'ा': 'A', 'ि': 'I', 'ी': 'I', 'ु': 'U', 'ू': 'U', 'ृ': 'R', 'े': 'E', 'ै': 'AI', 'ो': 'O', 'ौ': 'AU',
  'ं': 'N', 'ः': 'H', 'ँ': 'N',
  'क': 'K', 'ख': 'KH', 'ग': 'G', 'घ': 'GH', 'ङ': 'N',
  'च': 'CH', 'छ': 'CH', 'ज': 'J', 'झ': 'JH', 'ञ': 'N',
  'ट': 'T', 'ठ': 'TH', 'ड': 'D', 'ढ': 'DH', 'ण': 'N',
  'त': 'T', 'थ': 'TH', 'द': 'D', 'ध': 'DH', 'न': 'N',
  'प': 'P', 'फ': 'PH', 'ब': 'B', 'भ': 'BH', 'म': 'M',
  'य': 'Y', 'र': 'R', 'ल': 'L', 'व': 'V',
  'श': 'SH', 'ष': 'SH', 'स': 'S', 'ह': 'H',
  'क्ष': 'KSH', 'त्र': 'TR', 'ज्ञ': 'GY',
  '्': ''
};

function transliterateIndicPhonetic(text) {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    out += INDIC_TO_LATIN[ch] !== undefined ? INDIC_TO_LATIN[ch] : ch;
  }
  return out;
}

// Semantic mapping of common MediKiosk UI & clinical actions to validated ISL signs
const KIOSK_CONCEPT_SIGNS = {
  "WELCOME TO MEDIKIOSK": ["NAMASTE"],
  "WELCOME": ["NAMASTE"],
  "GREETING": ["NAMASTE"],
  "HELLO": ["HELLO"],
  "NAMASTE": ["NAMASTE"],
  "APPOINTMENTS": ["TIME"],
  "APPOINTMENT": ["TIME"],
  "SCHEDULE": ["TIME"],
  "TIME": ["TIME"],
  "DOCTOR DIRECTORY": ["PERSON"],
  "FIND YOUR DOCTOR": ["PERSON"],
  "DOCTOR": ["PERSON"],
  "DOCTORS": ["PERSON"],
  "SPECIALIST": ["PERSON"],
  "PERSON": ["PERSON"],
  "CLINICAL ASSESSMENT": ["CARE"],
  "AI HEALTH INTAKE ASSESSMENT": ["CARE"],
  "ASSESSMENT": ["CARE"],
  "CARE": ["CARE"],
  "MEDICAL DOCUMENTS": ["HOME"],
  "DIGITAL MEDICAL VAULT": ["HOME"],
  "DOCUMENTS": ["HOME"],
  "MEDICAL HISTORY": ["HOME"],
  "HISTORY": ["HOME"],
  "HOME": ["HOME"],
  "MEDICAL ID": ["YOU"],
  "ACCOUNT": ["YOU"],
  "PROFILE": ["YOU"],
  "YOU": ["YOU"],
};

  // Sign text function
  const sign = useCallback((inputText) => {
    const ref = runtimeRef.current;
    if (!ref.avatar || !inputText) return;

    // Transliterate any Indic (Devanagari) characters phonetically for ISL fingerspelling
    const phonetic = transliterateIndicPhonetic(inputText);
    const normalized = phonetic.trim().toUpperCase().replace(/[^\w\s]/g, " ");
    if (!normalized) return;

    // Reset any previous in-flight animation queue
    if (ref.animFrameId) {
      cancelAnimationFrame(ref.animFrameId);
      ref.animFrameId = null;
    }
    if (ref.pauseTimer) {
      clearTimeout(ref.pauseTimer);
      ref.pauseTimer = null;
    }
    ref.flag = false;
    ref.animations = [];
    ref.pending = true;

    // Cleanly restore skeleton to natural resting pose
    if (ref.isRetargeted && ref.retargetData) {
      ref.canonicalPose = getCanonicalRestPose();
      applyRetargetedPose(ref.canonicalPose, ref.boneMap, ref.retargetData);
    }

    setIsSigning(true);
    if (onSignStart) onSignStart(inputText);

    // Resolve semantic concepts to validated ISL gesture sequences
    let tokenList = [];
    const directConcept = KIOSK_CONCEPT_SIGNS[normalized];
    if (directConcept) {
      tokenList = [...directConcept];
    } else if (normalized.includes("WELCOME") || normalized.includes("NAMASTE") || normalized.includes("GOOD AFTERNOON") || normalized.includes("GOOD MORNING")) {
      tokenList = ["NAMASTE"];
    } else if (normalized.includes("APPOINTMENT") || normalized.includes("SCHEDULE")) {
      tokenList = ["TIME"];
    } else if (normalized.includes("DOCTOR")) {
      tokenList = ["PERSON"];
    } else if (normalized.includes("ASSESSMENT") || normalized.includes("SYMPTOM") || normalized.includes("TRIAGE")) {
      tokenList = ["CARE"];
    } else if (normalized.includes("DOCUMENT") || normalized.includes("VAULT") || normalized.includes("HISTORY")) {
      tokenList = ["HOME"];
    } else {
      tokenList = normalized.split(/\s+/).filter(Boolean);
    }

    for (const word of tokenList) {
      if (typeof words[word] === "function") {
        // Predefined word animation (e.g. TIME, HOME, PERSON, YOU)
        ref.animations.push(["token", word]);
        words[word](ref);
      } else {
        // Fallback to letter-by-letter ISL fingerspelling
        const letters = word.split("");
        for (let i = 0; i < letters.length; i++) {
          const letter = letters[i];
          if (typeof alphabets[letter] === "function") {
            ref.animations.push(["token", letter]);
            alphabets[letter](ref);
          }
        }
      }
    }

    // Gracefully return avatar arms to natural resting pose (lowered by sides)
    ref.animations.push([
      ["mixamorigLeftArm", "rotation", "z", -Math.PI / 3, "-"],
      ["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.5, "-"],
      ["mixamorigRightArm", "rotation", "z", Math.PI / 3, "+"],
      ["mixamorigRightForeArm", "rotation", "y", Math.PI / 1.5, "+"],
    ]);

    if (ref.animations.length > 0) {
      ref.pending = true;
      ref.animate();
    } else {
      ref.pending = false;
    }
  }, [onSignStart]);

  // Main Three.js setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const ref = runtimeRef.current;
    ref.animations = [];
    ref.characters = [];
    ref.flag = false;
    ref.pending = false;

    // 1. Scene & Lighting
    const scene = new THREE.Scene();
    ref.scene = scene;

    // Ambient light for soft, clinical overall fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    // Key light from front-top-right for crisp facial, torso, and hand clarity
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(1.5, 3.5, 3.0);
    scene.add(keyLight);

    // Soft fill light from front-left with subtle MediKiosk brand tint
    const fillLight = new THREE.DirectionalLight(0xccfbf1, 0.9);
    fillLight.position.set(-2.0, 2.0, 2.0);
    scene.add(fillLight);

    // Subtle backlight/rim light to separate the avatar silhouette from the background
    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.65);
    rimLight.position.set(0, 3.0, -2.5);
    scene.add(rimLight);

    // 2. Camera Setup (sensible FOV 32 deg)
    const initialWidth = container.clientWidth || 300;
    const initialHeight = typeof height === "number" ? height : (container.clientHeight || 250);
    const camera = new THREE.PerspectiveCamera(
      32,
      initialWidth / initialHeight,
      0.1,
      1000
    );
    // Temporary placeholder position before GLB bounds calculation
    camera.position.set(0, 1.25, 2.75);
    camera.lookAt(0, 1.25, 0);
    ref.camera = camera;

    // 3. Renderer with transparent background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = styles.canvas;
    ref.renderer = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Dynamic Framing Function based on actual model Box3 bounds
    const applyFraming = (w, h) => {
      if (!ref.modelBox || !camera || !renderer || !w || !h) return;

      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      const box = ref.modelBox;
      const size = box.getSize(new THREE.Vector3());

      // Head margin: 10% of avatar height above head top for generous headroom
      const targetTop = box.max.y + size.y * 0.10;
      // Lower body boundary: upper legs / mid-thigh (approx 28% from feet)
      const targetBottom = box.min.y + size.y * 0.28;
      const targetHeight = targetTop - targetBottom;
      // Visual center focused comfortably at mid-chest
      const targetCenterY = (targetTop + targetBottom) / 2;

      // Horizontal target: ensures wide signing arm gestures stay within canvas bounds
      const targetWidth = Math.max(size.x * 0.74, targetHeight * 0.88);

      const fovRad = (camera.fov * Math.PI) / 180;
      const halfFovTan = Math.tan(fovRad / 2);

      // Compute distances needed to fit vertical and horizontal dimensions
      const distV = (targetHeight / 2) / halfFovTan;
      const distH = (targetWidth / 2) / (halfFovTan * aspect);

      // Distance with 6% breathing margin
      const cameraDist = Math.max(distV, distH) * 1.06;

      // Position camera centered horizontally with slight 4cm elevation for friendly perspective
      camera.position.set(0, targetCenterY + 0.04, cameraDist);
      camera.lookAt(0, targetCenterY, 0);

      ref.framing = { targetCenterY, cameraDist };
    };

    // 4. Animation Frame Driver
    ref.animate = () => {
      if (ref.animations.length === 0) {
        if (ref.animFrameId) {
          cancelAnimationFrame(ref.animFrameId);
          ref.animFrameId = null;
        }
        ref.pending = false;
        setCurrentToken("");
        setIsSigning(false);
        if (ref.isRetargeted && ref.retargetData) {
          ref.canonicalPose = getCanonicalRestPose();
          applyRetargetedPose(ref.canonicalPose, ref.boneMap, ref.retargetData);
          renderer.render(scene, camera);
        }
        if (onSignEnd) onSignEnd();
        return;
      }

      ref.animFrameId = requestAnimationFrame(ref.animate);

      if (ref.animations[0].length) {
        if (!ref.flag) {
          // Token update event for UI display
          if (ref.animations[0][0] === "token" || ref.animations[0][0] === "add-text") {
            const token = ref.animations[0][1];
            setCurrentToken(token);
            ref.animations.shift();
          } else {
            // Step bone rotations
            if (ref.isRetargeted && ref.retargetData) {
              // Retargeted branch for non-canonical humanoid rigs (e.g. HumanBot)
              let anyChanged = false;
              for (let i = 0; i < ref.animations[0].length; ) {
                const [boneName, action, axis, limit, signDirection] = ref.animations[0][i];
                if (!ref.canonicalPose[boneName]) {
                  ref.canonicalPose[boneName] = { x: 0, y: 0, z: 0 };
                }
                const p = ref.canonicalPose[boneName];

                if (signDirection === "+" && p[axis] < limit) {
                  p[axis] += ref.speed;
                  p[axis] = Math.min(p[axis], limit);
                  anyChanged = true;
                  i++;
                } else if (signDirection === "-" && p[axis] > limit) {
                  p[axis] -= ref.speed;
                  p[axis] = Math.max(p[axis], limit);
                  anyChanged = true;
                  i++;
                } else {
                  ref.animations[0].splice(i, 1);
                }
              }
              if (anyChanged) {
                applyRetargetedPose(ref.canonicalPose, ref.boneMap, ref.retargetData);
              }
            } else {
              // Canonical baseline branch for YBot (untouched direct Euler driver)
              for (let i = 0; i < ref.animations[0].length; ) {
                const [boneName, action, axis, limit, signDirection] = ref.animations[0][i];
                const bone = ref.boneMap?.get(boneName) || ref.avatar?.getObjectByName(boneName);

                if (!bone) {
                  ref.animations[0].splice(i, 1);
                  continue;
                }

                if (signDirection === "+" && bone[action][axis] < limit) {
                  bone[action][axis] += ref.speed;
                  bone[action][axis] = Math.min(bone[action][axis], limit);
                  i++;
                } else if (signDirection === "-" && bone[action][axis] > limit) {
                  bone[action][axis] -= ref.speed;
                  bone[action][axis] = Math.max(bone[action][axis], limit);
                  i++;
                } else {
                  ref.animations[0].splice(i, 1);
                }
              }
            }
          }
        }
      } else {
        // Frame finished; pause before moving to the next keyframe step
        ref.flag = true;
        ref.pauseTimer = setTimeout(() => {
          ref.flag = false;
        }, ref.pause);
        ref.animations.shift();
      }

      renderer.render(scene, camera);
    };

    // 5. Load GLTF Avatar Model with Model Bounding Box Calculation
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        gltf.scene.traverse((child) => {
          if (child.type === "SkinnedMesh") {
            child.frustumCulled = false;
          }
        });
        ref.avatar = gltf.scene;
        if (import.meta.env.DEV) {
          window.__islRuntime = ref;
          window.__THREE = THREE;
        }

        // Build bone mapping & diagnostic report for standard or namespaced skeletons
        const { boneMap, report } = buildBoneMap(gltf.scene);
        ref.boneMap = boneMap;
        ref.skeletonReport = report;
        if (import.meta.env.DEV) {
          console.log(`[ISLAvatar] Skeleton Compatibility Report for "${modelUrl}":`, report);
        }

        // Determine if model requires pose retargeting (YBot is the canonical baseline)
        const isRetargeted = !modelUrl.toLowerCase().includes("ybot");
        ref.isRetargeted = isRetargeted;
        if (isRetargeted) {
          ref.retargetData = initRetargeting(gltf.scene, boneMap);
          ref.canonicalPose = getCanonicalRestPose();
          applyRetargetedPose(ref.canonicalPose, boneMap, ref.retargetData);
        } else {
          ref.retargetData = null;
          ref.canonicalPose = null;
        }

        // Calculate accurate Box3 bounding box of model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        ref.modelBox = box;

        // Horizontally center model at x = 0
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.x = -center.x;
        gltf.scene.position.z = 0;

        scene.add(ref.avatar);

        // Apply dynamic bounding box camera framing
        const currentW = container.clientWidth || initialWidth;
        const currentH = typeof height === "number" ? height : (container.clientHeight || initialHeight);
        applyFraming(currentW, currentH);

        defaultPose(ref);
        ref.isLoaded = true;
        setIsLoading(false);
        renderer.render(scene, camera);
      },
      undefined,
      (err) => {
        console.error("Failed to load ISL Avatar model:", err);
        setIsLoading(false);
      }
    );

    // 6. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && camera && renderer) {
          applyFraming(newW, newH);
          renderer.setSize(newW, newH, false);
          renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    // 7. Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      if (ref.animFrameId) cancelAnimationFrame(ref.animFrameId);
      if (ref.pauseTimer) clearTimeout(ref.pauseTimer);

      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [modelUrl, height, onSignEnd]);

  // Trigger signing when text prop changes
  useEffect(() => {
    if (text && !isLoading && runtimeRef.current.isLoaded) {
      sign(text);
    }
  }, [text, isLoading, sign]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.avatarCard} ${className}`}
      style={{ width }}
      data-testid="isl-avatar-card"
    >
      {/* Active State Badge */}
      <div className={styles.badgeOverlay}>
        <span
          className={`${styles.badgeDot} ${
            isSigning ? styles.badgeDotActive : ""
          }`}
        />
        <span>{isSigning ? "Signing..." : "ISL Ready"}</span>
      </div>

      {/* Current Sign Token Display */}
      {currentToken && (
        <div className={styles.tokenBadge} data-testid="isl-token-badge">
          {currentToken}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Loading 3D ISL Avatar...</span>
        </div>
      )}

      {/* Canvas Mount Container */}
      <div
        ref={mountRef}
        className={styles.canvasWrapper}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      />
    </div>
  );
}
