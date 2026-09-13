/**
 * ISL Bone Mapping & Skeleton Compatibility Layer
 *
 * Maps standard Sign-Kit Mixamo bone names (e.g. "mixamorigNeck", "mixamorigLeftHandIndex1")
 * to the actual scene bone nodes across varying Mixamo naming formats:
 *   1. Standard format: "mixamorigNeck" (YBot)
 *   2. Namespaced format: "mixamorig:Neck_05" (HumanBot)
 *   3. Colon-only format: "mixamorig:Neck"
 *
 * Keeps animation data completely decoupled from GLTF naming idiosyncrasies.
 */

// Canonical 37 bones used across all 26 alphabets and word animations in Sign-Kit
export const EXPECTED_SIGNKIT_BONES = [
  // Head & Neck
  "mixamorigNeck",
  "mixamorigHead",
  // Spine & Torso
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  // Left Arm & Hand
  "mixamorigLeftArm",
  "mixamorigLeftForeArm",
  "mixamorigLeftHand",
  "mixamorigLeftHandThumb1",
  "mixamorigLeftHandThumb2",
  "mixamorigLeftHandThumb3",
  "mixamorigLeftHandIndex1",
  "mixamorigLeftHandIndex2",
  "mixamorigLeftHandIndex3",
  "mixamorigLeftHandMiddle1",
  "mixamorigLeftHandMiddle2",
  "mixamorigLeftHandMiddle3",
  "mixamorigLeftHandRing1",
  "mixamorigLeftHandRing2",
  "mixamorigLeftHandRing3",
  "mixamorigLeftHandPinky1",
  "mixamorigLeftHandPinky2",
  "mixamorigLeftHandPinky3",
  // Right Arm & Hand
  "mixamorigRightArm",
  "mixamorigRightForeArm",
  "mixamorigRightHand",
  "mixamorigRightHandThumb1",
  "mixamorigRightHandThumb2",
  "mixamorigRightHandThumb3",
  "mixamorigRightHandIndex1",
  "mixamorigRightHandIndex2",
  "mixamorigRightHandIndex3",
  "mixamorigRightHandMiddle1",
  "mixamorigRightHandMiddle2",
  "mixamorigRightHandMiddle3",
  "mixamorigRightHandRing1",
  "mixamorigRightHandRing2",
  "mixamorigRightHandRing3",
  "mixamorigRightHandPinky1",
  "mixamorigRightHandPinky2",
  "mixamorigRightHandPinky3",
];

/**
 * Normalizes any Mixamo bone name into the canonical Sign-Kit format: "mixamorig<BaseName>"
 * Examples:
 *   "mixamorig:Neck_05"        -> "mixamorigNeck"
 *   "mixamorig:LeftHandIndex1_016" -> "mixamorigLeftHandIndex1"
 *   "mixamorigNeck"            -> "mixamorigNeck"
 */
export function normalizeBoneName(rawName) {
  if (!rawName || typeof rawName !== "string") return "";

  // If already standard format: e.g. "mixamorigNeck"
  if (/^mixamorig[A-Za-z0-9]+$/.test(rawName)) {
    return rawName;
  }

  // Handle namespaced format with colon and optional numeric suffix:
  // e.g. "mixamorig:LeftHandIndex1_016" -> base = "LeftHandIndex1"
  const match = rawName.match(/mixamorig:([A-Za-z0-9]+?)(?:_\d+)?$/);
  if (match) {
    return "mixamorig" + match[1];
  }

  // Generic fallback: strip any namespace before colon and trailing _digits
  const stripped = rawName.replace(/^.*:/, "").replace(/_\d+$/, "");
  return "mixamorig" + stripped.replace(/^mixamorig/i, "");
}

/**
 * Inspects a GLTF scene and builds a Map from canonical bone names to Three.js Object3D/Bone instances.
 * Also generates a diagnostic compatibility report.
 */
export function buildBoneMap(scene) {
  const boneMap = new Map();
  const rawBoneNames = [];
  const mappedBoneNames = [];

  if (!scene) {
    return { boneMap, report: { error: "No scene provided" } };
  }

  scene.traverse((child) => {
    if (child.isBone || child.type === "Bone") {
      rawBoneNames.push(child.name);

      // 1. Direct name lookup
      boneMap.set(child.name, child);

      // 2. Canonical normalized name lookup
      const canonical = normalizeBoneName(child.name);
      if (canonical && !boneMap.has(canonical)) {
        boneMap.set(canonical, child);
        mappedBoneNames.push({ raw: child.name, canonical });
      }
    }
  });

  // Verify coverage against expected Sign-Kit bones
  const missingBones = EXPECTED_SIGNKIT_BONES.filter((name) => !boneMap.has(name));
  const detectedExpectedCount = EXPECTED_SIGNKIT_BONES.length - missingBones.length;

  const report = {
    totalRawBones: rawBoneNames.length,
    canonicalMappedCount: mappedBoneNames.length,
    expectedBonesDetected: detectedExpectedCount,
    expectedBonesTotal: EXPECTED_SIGNKIT_BONES.length,
    coveragePercent: Math.round((detectedExpectedCount / EXPECTED_SIGNKIT_BONES.length) * 100),
    isFullyCompatible: missingBones.length === 0,
    missingBones,
    fingerBonesDetected: {
      leftThumb: [1, 2, 3].every((i) => boneMap.has(`mixamorigLeftHandThumb${i}`)),
      leftIndex: [1, 2, 3].every((i) => boneMap.has(`mixamorigLeftHandIndex${i}`)),
      leftMiddle: [1, 2, 3].every((i) => boneMap.has(`mixamorigLeftHandMiddle${i}`)),
      leftRing: [1, 2, 3].every((i) => boneMap.has(`mixamorigLeftHandRing${i}`)),
      leftPinky: [1, 2, 3].every((i) => boneMap.has(`mixamorigLeftHandPinky${i}`)),
      rightThumb: [1, 2, 3].every((i) => boneMap.has(`mixamorigRightHandThumb${i}`)),
      rightIndex: [1, 2, 3].every((i) => boneMap.has(`mixamorigRightHandIndex${i}`)),
      rightMiddle: [1, 2, 3].every((i) => boneMap.has(`mixamorigRightHandMiddle${i}`)),
      rightRing: [1, 2, 3].every((i) => boneMap.has(`mixamorigRightHandRing${i}`)),
      rightPinky: [1, 2, 3].every((i) => boneMap.has(`mixamorigRightHandPinky${i}`)),
    },
    armBonesDetected: {
      leftArm: boneMap.has("mixamorigLeftArm"),
      leftForeArm: boneMap.has("mixamorigLeftForeArm"),
      leftHand: boneMap.has("mixamorigLeftHand"),
      rightArm: boneMap.has("mixamorigRightArm"),
      rightForeArm: boneMap.has("mixamorigRightForeArm"),
      rightHand: boneMap.has("mixamorigRightHand"),
    },
    headBonesDetected: {
      neck: boneMap.has("mixamorigNeck"),
      head: boneMap.has("mixamorigHead"),
    },
  };

  return { boneMap, report };
}
