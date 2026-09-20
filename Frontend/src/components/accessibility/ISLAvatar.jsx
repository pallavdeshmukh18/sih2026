import { createHandClearance, applyHandClearance } from "./isl/handClearance.js";
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { planText, compileGestures, createTransition, sampleTransition } from "./isl/playback.js";
import * as alphabets from "./isl/alphabets.js";
import * as words from "./isl/words.js";
import { buildBoneMap } from "./isl/boneMapping.js";
import {
  initRetargeting,
  getCanonicalIdlePose,
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
 * @param {number} [props.speed=0.08] - Playback rate (0.04 - 0.20)
 * @param {number} [props.pause=180] - Hold duration in ms after each sign
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
  pause = 180,
  replayId = 0,
  modelUrl = "/models/humanbot-colored.glb",
  width = "100%",
  height = 380,
  className = "",
  onSignStart,
  onSignEnd,
}) {
  const mountRef = useRef(null);
  const callbacks = useRef({ onSignStart, onSignEnd });
  useEffect(() => { callbacks.current = { onSignStart, onSignEnd }; }, [onSignStart, onSignEnd]);
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

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sign = useCallback((inputText) => {
    const ref = runtimeRef.current;
    if (!ref.isLoaded) return;
    cancelAnimationFrame(ref.animFrameId);
    ref.transition = null;
    ref.holdUntil = 0;
    const plan = planText(inputText, words);
    setNotice(plan.unsupported.length
      ? `Cannot sign: ${plan.unsupported.join(" ")}. Please enter English text.`
      : plan.spelled ? "Unknown words are fingerspelled; this is not a full ISL translation." : "");
    ref.animations = compileGestures(plan.tokens, words, alphabets);
    ref.pending = ref.animations.length > 0;
    setIsSigning(ref.pending);
    setCurrentToken("");
    if (ref.pending) {
      callbacks.current.onSignStart?.(inputText);
      ref.animate(performance.now());
    } else {
      // Clear/cancel requests also lower the hands smoothly.
      ref.animations = [{ pose: getCanonicalIdlePose(), hold: false }];
      ref.animate(performance.now());
    }
  }, []);

  // Main Three.js setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const ref = runtimeRef.current;
    let disposed = false;
    ref.isLoaded = false;
    setIsLoading(true);
    setError("");
    ref.animations = [];
    ref.characters = [];
    ref.flag = false;
    ref.pending = false;

    // 1. Scene & Lighting
    const scene = new THREE.Scene();
    ref.scene = scene;

    // Ambient light for soft, clinical overall fill
    const ambientLight = new THREE.HemisphereLight(0xf4f7ff, 0x697584, 1.6);
    scene.add(ambientLight);

    // Key light from front-top-right for crisp facial, torso, and hand clarity
    const keyLight = new THREE.DirectionalLight(0xfff5eb, 2.4);
    keyLight.position.set(1.5, 3.5, 3.0);
    scene.add(keyLight);

    // Soft fill light from front-left with subtle MediKiosk brand tint
    const fillLight = new THREE.DirectionalLight(0xe9f2ff, 1.3);
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
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1.5), 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.45;
    studio.dispose();
    pmrem.dispose();
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "3D Indian Sign Language avatar");
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

      // Keep the face large with a small margin above the head.
      const targetTop = box.max.y + size.y * 0.045;
      // Frame the signing space from hips to head.
      const targetBottom = box.min.y + size.y * 0.43;
      const targetHeight = targetTop - targetBottom;
      // Visual center focused comfortably at mid-chest
      const targetCenterY = (targetTop + targetBottom) / 2;

      // Horizontal target: ensures wide signing arm gestures stay within canvas bounds
      const targetWidth = Math.max(size.x * 1.12, targetHeight * 0.94);

      const fovRad = (camera.fov * Math.PI) / 180;
      const halfFovTan = Math.tan(fovRad / 2);

      // Compute distances needed to fit vertical and horizontal dimensions
      const distV = (targetHeight / 2) / halfFovTan;
      const distH = (targetWidth / 2) / (halfFovTan * aspect);

      // Distance with 6% breathing margin
      const cameraDist = Math.max(distV, distH) * 1.04 + Math.max(0, box.max.z);

      // Front-on framing keeps two-handed signs readable.
      camera.position.set(0, targetCenterY, cameraDist);
      camera.lookAt(0, targetCenterY, 0);

      ref.framing = { targetCenterY, cameraDist };
    };

    // A single clock drives synchronized joints. Holds occur at signs, not every keyframe.
    ref.animate = (now) => {
      if (disposed) return;
      if (ref.holdUntil && now < ref.holdUntil) {
        ref.animFrameId = requestAnimationFrame(ref.animate);
        return;
      }
      if (!ref.transition) {
        const step = ref.animations.shift();
        if (!step) {
          ref.pending = false;
          ref.animFrameId = null;
          setCurrentToken("");
          setIsSigning(false);
          callbacks.current.onSignEnd?.();
          return;
        }
        if (step.token) setCurrentToken(step.token);
        ref.transition = createTransition(ref.canonicalPose, step.pose, now, ref.speed);
        ref.transition.hold = step.hold;
      }
      const done = sampleTransition(ref.transition, now, ref.canonicalPose);
      if (ref.isRetargeted) {
        applyRetargetedPose(ref.canonicalPose, ref.boneMap, ref.retargetData);
      } else {
        for (const [name, pose] of Object.entries(ref.canonicalPose)) {
          if (name !== "mixamorigHips") ref.boneMap.get(name)?.rotation.set(pose.x, pose.y, pose.z);
        }
      }
      applyHandClearance(ref.avatar, ref.handClearance);
      renderer.render(scene, camera);
      if (done) {
        ref.holdUntil = now + (ref.transition.hold ? ref.pause : 0);
        ref.transition = null;
      }
      ref.animFrameId = requestAnimationFrame(ref.animate);
    };

    // 5. Load GLTF Avatar Model with Model Bounding Box Calculation
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          disposeScene(gltf.scene);
          return;
        }
        gltf.scene.traverse((child) => {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (material?.name === "robe_m") {
              material.color.set(0x36576b);
              material.roughness = 0.85;
            }
            if (material?.name === "jewelry_m") child.visible = false;
            if (material?.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
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
          ref.canonicalPose = getCanonicalIdlePose();
          applyRetargetedPose(ref.canonicalPose, boneMap, ref.retargetData);
        } else {
          ref.retargetData = null;
          ref.canonicalPose = getCanonicalIdlePose();
          for (const [name, pose] of Object.entries(ref.canonicalPose)) {
            // Preserve the GLB root correction relative to its Armature.
            if (name !== "mixamorigHips") boneMap.get(name)?.rotation.set(pose.x, pose.y, pose.z);
          }
        }

        // Calculate accurate Box3 bounding box of model
        const box = new THREE.Box3().setFromObject(gltf.scene);


        // Horizontally center model at x = 0
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.x = -center.x;
        gltf.scene.position.z -= center.z;
        gltf.scene.updateMatrixWorld(true);
        ref.modelBox = new THREE.Box3().setFromObject(gltf.scene);

        scene.add(ref.avatar);
        ref.handClearance = createHandClearance(ref.avatar, boneMap);
        applyHandClearance(ref.avatar, ref.handClearance);

        // Apply dynamic bounding box camera framing
        const currentW = container.clientWidth || initialWidth;
        const currentH = typeof height === "number" ? height : (container.clientHeight || initialHeight);
        applyFraming(currentW, currentH);


        ref.isLoaded = true;
        setIsLoading(false);
        renderer.render(scene, camera);
      },
      undefined,
      (err) => {
        if (disposed) return;
        setError("Avatar could not load. Reload to try again.");
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
      disposed = true;
      ref.isLoaded = false;
      ref.avatar = null;
      ref.transition = null;
      resizeObserver.disconnect();
      if (ref.animFrameId) cancelAnimationFrame(ref.animFrameId);
      if (ref.pauseTimer) clearTimeout(ref.pauseTimer);

      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }

      environment.dispose();
      disposeScene(scene);
      if (window.__islRuntime === ref) delete window.__islRuntime;
    };
  }, [modelUrl, height, visible]);

  // Trigger signing when text prop changes
  useEffect(() => {
    if (!isLoading && runtimeRef.current.isLoaded) {
      sign(text);
    }
  }, [text, isLoading, sign, replayId]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.avatarCard} ${className}`}
      style={{ width, height }}
      data-testid="isl-avatar-card"
    >
      {/* Active State Badge */}
      <div className={styles.badgeOverlay}>
        <span
          className={`${styles.badgeDot} ${
            isSigning ? styles.badgeDotActive : ""
          }`}
        />
        <span>{error ? "Avatar unavailable" : isLoading ? "Loading..." : isSigning ? "Signing..." : "ISL Ready"}</span>
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

      {(error || notice) && <p role="status" className={styles.notice}>{error || notice}</p>}

      {/* Canvas Mount Container */}
      <div
        ref={mountRef}
        className={styles.canvasWrapper}

      />
    </div>
  );
}

function disposeScene(scene) {
  scene.traverse((obj) => {
    obj.geometry?.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}
