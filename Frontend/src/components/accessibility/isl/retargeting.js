import * as THREE from "three";

/**
 * Retargeting layer for humanoid ISL avatars (e.g. HumanBot).
 * 
 * Maps canonical Sign-Kit animation poses (authored for standard Mixamo/YBot rigs)
 * to arbitrary humanoid skeletons that have different local bind rotations and bone coordinate frames.
 */

export const CANONICAL_REST_TRANS = {
  "mixamorigLeftArm": [12.655, -0.266, -2.600],
  "mixamorigLeftForeArm": [27.404, 0, 0],
  "mixamorigLeftHand": [27.614, 0, 0],
  "mixamorigLeftHandMiddle1": [12.775, 0, 0],
  "mixamorigLeftHandMiddle2": [3.614, 0, 0],
  "mixamorigLeftHandMiddle3": [3.460, 0, 0],
  "mixamorigLeftHandMiddle4": [3.680, 0, 0],
  "mixamorigLeftHandThumb1": [3.789, -2.167, 3.003],
  "mixamorigLeftHandThumb2": [3.675, -2.122, 2.122],
  "mixamorigLeftHandThumb3": [3.394, -1.960, 1.960],
  "mixamorigLeftHandIndex1": [12.267, -0.232, 2.822],
  "mixamorigLeftHandIndex2": [3.892, 0, 0],
  "mixamorigLeftHandIndex3": [3.415, 0, 0],
  "mixamorigLeftHandRing1": [12.147, 0.010, -2.217],
  "mixamorigLeftHandRing2": [3.601, 0, 0],
  "mixamorigLeftHandRing3": [3.307, 0, 0],
  "mixamorigLeftHandPinky1": [10.908, -0.226, -4.726],
  "mixamorigLeftHandPinky2": [4.137, 0, 0],
  "mixamorigLeftHandPinky3": [2.595, 0, 0],
  "mixamorigRightArm": [-12.655, -0.266, -2.600],
  "mixamorigRightForeArm": [-27.404, 0, 0],
  "mixamorigRightHand": [-27.614, 0, 0],
  "mixamorigRightHandMiddle1": [-12.775, 0, 0],
  "mixamorigRightHandMiddle2": [-3.614, 0, 0],
  "mixamorigRightHandMiddle3": [-3.460, 0, 0],
  "mixamorigRightHandThumb1": [-3.789, -2.167, 3.003],
  "mixamorigRightHandThumb2": [-3.675, -2.122, 2.122],
  "mixamorigRightHandThumb3": [-3.394, -1.960, 1.960],
  "mixamorigRightHandIndex1": [-12.267, -0.232, 2.822],
  "mixamorigRightHandIndex2": [-3.892, 0, 0],
  "mixamorigRightHandIndex3": [-3.415, 0, 0],
  "mixamorigRightHandRing1": [-12.147, 0.010, -2.217],
  "mixamorigRightHandRing2": [-3.601, 0, 0],
  "mixamorigRightHandRing3": [-3.307, 0, 0],
  "mixamorigRightHandPinky1": [-10.908, -0.226, -4.726],
  "mixamorigRightHandPinky2": [-4.137, 0, 0],
  "mixamorigRightHandPinky3": [-2.595, 0, 0],
  "mixamorigNeck": [0, 13.996, -2.046],
  "mixamorigHead": [0, 8.878, 1.989],
  "mixamorigSpine": [0, 9.982, -0.505],
  "mixamorigSpine1": [0, 11.834, -0.598],
  "mixamorigSpine2": [0, 14.150, -0.715],
};

export const BONE_PARENTS = {
  "mixamorigSpine": "mixamorigHips",
  "mixamorigSpine1": "mixamorigSpine",
  "mixamorigSpine2": "mixamorigSpine1",
  "mixamorigNeck": "mixamorigSpine2",
  "mixamorigHead": "mixamorigNeck",
  "mixamorigLeftShoulder": "mixamorigSpine2",
  "mixamorigLeftArm": "mixamorigLeftShoulder",
  "mixamorigLeftForeArm": "mixamorigLeftArm",
  "mixamorigLeftHand": "mixamorigLeftForeArm",
  "mixamorigLeftHandThumb1": "mixamorigLeftHand",
  "mixamorigLeftHandThumb2": "mixamorigLeftHandThumb1",
  "mixamorigLeftHandThumb3": "mixamorigLeftHandThumb2",
  "mixamorigLeftHandIndex1": "mixamorigLeftHand",
  "mixamorigLeftHandIndex2": "mixamorigLeftHandIndex1",
  "mixamorigLeftHandIndex3": "mixamorigLeftHandIndex2",
  "mixamorigLeftHandMiddle1": "mixamorigLeftHand",
  "mixamorigLeftHandMiddle2": "mixamorigLeftHandMiddle1",
  "mixamorigLeftHandMiddle3": "mixamorigLeftHandMiddle2",
  "mixamorigLeftHandRing1": "mixamorigLeftHand",
  "mixamorigLeftHandRing2": "mixamorigLeftHandRing1",
  "mixamorigLeftHandRing3": "mixamorigLeftHandRing2",
  "mixamorigLeftHandPinky1": "mixamorigLeftHand",
  "mixamorigLeftHandPinky2": "mixamorigLeftHandPinky1",
  "mixamorigLeftHandPinky3": "mixamorigLeftHandPinky2",
  "mixamorigRightShoulder": "mixamorigSpine2",
  "mixamorigRightArm": "mixamorigRightShoulder",
  "mixamorigRightForeArm": "mixamorigRightArm",
  "mixamorigRightHand": "mixamorigRightForeArm",
  "mixamorigRightHandThumb1": "mixamorigRightHand",
  "mixamorigRightHandThumb2": "mixamorigRightHandThumb1",
  "mixamorigRightHandThumb3": "mixamorigRightHandThumb2",
  "mixamorigRightHandIndex1": "mixamorigRightHand",
  "mixamorigRightHandIndex2": "mixamorigRightHandIndex1",
  "mixamorigRightHandIndex3": "mixamorigRightHandIndex2",
  "mixamorigRightHandMiddle1": "mixamorigRightHand",
  "mixamorigRightHandMiddle2": "mixamorigRightHandMiddle1",
  "mixamorigRightHandMiddle3": "mixamorigRightHandMiddle2",
  "mixamorigRightHandRing1": "mixamorigRightHand",
  "mixamorigRightHandRing2": "mixamorigRightHandRing1",
  "mixamorigRightHandRing3": "mixamorigRightHandRing2",
  "mixamorigRightHandPinky1": "mixamorigRightHand",
  "mixamorigRightHandPinky2": "mixamorigRightHandPinky1",
  "mixamorigRightHandPinky3": "mixamorigRightHandPinky2",
};

export const BONE_ORDER = [
  "mixamorigHips", "mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2",
  "mixamorigNeck", "mixamorigHead",
  "mixamorigLeftShoulder", "mixamorigLeftArm", "mixamorigLeftForeArm", "mixamorigLeftHand",
  "mixamorigLeftHandThumb1", "mixamorigLeftHandThumb2", "mixamorigLeftHandThumb3",
  "mixamorigLeftHandIndex1", "mixamorigLeftHandIndex2", "mixamorigLeftHandIndex3",
  "mixamorigLeftHandMiddle1", "mixamorigLeftHandMiddle2", "mixamorigLeftHandMiddle3",
  "mixamorigLeftHandRing1", "mixamorigLeftHandRing2", "mixamorigLeftHandRing3",
  "mixamorigLeftHandPinky1", "mixamorigLeftHandPinky2", "mixamorigLeftHandPinky3",
  "mixamorigRightShoulder", "mixamorigRightArm", "mixamorigRightForeArm", "mixamorigRightHand",
  "mixamorigRightHandThumb1", "mixamorigRightHandThumb2", "mixamorigRightHandThumb3",
  "mixamorigRightHandIndex1", "mixamorigRightHandIndex2", "mixamorigRightHandIndex3",
  "mixamorigRightHandMiddle1", "mixamorigRightHandMiddle2", "mixamorigRightHandMiddle3",
  "mixamorigRightHandRing1", "mixamorigRightHandRing2", "mixamorigRightHandRing3",
  "mixamorigRightHandPinky1", "mixamorigRightHandPinky2", "mixamorigRightHandPinky3"
];

const BONE_CHILD = {};
for (const [child, parent] of Object.entries(BONE_PARENTS)) {
  if (!BONE_CHILD[parent]) BONE_CHILD[parent] = child;
}

function getOrthonormalBasis(vAlong, vAcross) {
  const v1 = vAlong.clone().normalize();
  let v2, v3;
  if (vAcross && vAcross.lengthSq() > 1e-6) {
    v3 = new THREE.Vector3().crossVectors(v1, vAcross).normalize();
    v2 = new THREE.Vector3().crossVectors(v3, v1).normalize();
  } else {
    const cand = Math.abs(v1.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    v3 = new THREE.Vector3().crossVectors(v1, cand).normalize();
    v2 = new THREE.Vector3().crossVectors(v3, v1).normalize();
  }
  const m = new THREE.Matrix4().makeBasis(v1, v2, v3);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Initializes retargeting basis alignment between canonical Mixamo/YBot skeleton and target avatar.
 */
export function initRetargeting(targetScene, targetBoneMap) {
  const M_map = new Map();

  for (const bname of BONE_ORDER) {
    const childName = BONE_CHILD[bname];
    if (!childName) continue;
    const targetBone = targetBoneMap.get(bname);
    const targetChildBone = targetBoneMap.get(childName);
    if (!targetBone || !targetChildBone) continue;

    // Canonical bone rest vectors
    const canTrans = CANONICAL_REST_TRANS[childName] || [1, 0, 0];
    const vY = new THREE.Vector3(canTrans[0], canTrans[1], canTrans[2]);
    let acrossY = null;
    let acrossTarget = null;

    if (bname.includes("Hand") && !bname.includes("Thumb") && !bname.includes("Index") && !bname.includes("Middle") && !bname.includes("Ring") && !bname.includes("Pinky")) {
      const side = bname.includes("Left") ? "Left" : "Right";
      const idxY = CANONICAL_REST_TRANS[`mixamorig${side}HandIndex1`];
      const pnkY = CANONICAL_REST_TRANS[`mixamorig${side}HandPinky1`];
      acrossY = new THREE.Vector3(idxY[0] - pnkY[0], idxY[1] - pnkY[1], idxY[2] - pnkY[2]);

      const idxTarget = targetBoneMap.get(`mixamorig${side}HandIndex1`);
      const pnkTarget = targetBoneMap.get(`mixamorig${side}HandPinky1`);
      if (idxTarget && pnkTarget) {
        acrossTarget = new THREE.Vector3().subVectors(idxTarget.position, pnkTarget.position);
      }
    }

    const qY = getOrthonormalBasis(vY, acrossY);
    const vTarget = targetChildBone.position.clone();
    const qTarget = getOrthonormalBasis(vTarget, acrossTarget);

    // M = qY * qTarget^-1
    const M = qY.clone().multiply(qTarget.clone().invert());
    M_map.set(bname, M);
  }

  // Consistent upper extremity anatomical basis mapping for standard +Y humanoid rigs (e.g. HumanBot):
  // Maps YBot canonical limb (+X on Left, -X on Right, flexion around canonical Z) to HumanBot limb (+Y along bone, flexion around +X)
  // Ensures C0 continuity along the entire kinematic chain (Arm -> ForeArm -> Hand -> Digits -> Thumbs).
  // Eliminates inter-joint twist, prevents 180° wrist flips, and preserves natural palm-directed finger flexion.
  const M_left_arm_chain = new THREE.Quaternion(0.5, 0.5, -0.5, 0.5);
  const M_right_arm_chain = new THREE.Quaternion(0.5, -0.5, 0.5, 0.5);

  for (const bname of BONE_ORDER) {
    if (bname.startsWith("mixamorigLeft") && (bname.includes("Arm") || bname.includes("Hand"))) {
      M_map.set(bname, M_left_arm_chain.clone());
    } else if (bname.startsWith("mixamorigRight") && (bname.includes("Arm") || bname.includes("Hand"))) {
      M_map.set(bname, M_right_arm_chain.clone());
    }
  }

  // Preserve each digit's authored rest alignment, especially thumb opposition.
  const digitRest = new Map();
  for (const name of BONE_ORDER) {
    if (/Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(name)) {
      const bone = targetBoneMap.get(name);
      if (bone) digitRest.set(name, bone.quaternion.clone());
    }
  }
  return { M_map, digitRest };
}

/**
 * Creates initial canonical pose tracker.
 */
export function createCanonicalPose() {
  const pose = {};
  for (const bname of BONE_ORDER) {
    pose[bname] = { x: 0, y: 0, z: 0 };
  }
  return pose;
}

/**
 * Returns canonical resting pose where arms are lowered naturally by sides.
 */
export function getCanonicalRestPose() {
  const pose = createCanonicalPose();
  pose["mixamorigNeck"] = { x: Math.PI / 12, y: 0, z: 0 };
  pose["mixamorigLeftArm"] = { x: 0, y: 0, z: -Math.PI / 3 };
  pose["mixamorigLeftForeArm"] = { x: 0, y: -Math.PI / 1.5, z: 0 };
  pose["mixamorigRightArm"] = { x: 0, y: 0, z: Math.PI / 3 };
  pose["mixamorigRightForeArm"] = { x: 0, y: Math.PI / 1.5, z: 0 };
  return pose;
}

/**
 * Applies retargeted animation pose from canonical YBot space to the target avatar skeleton.
 */
export function applyRetargetedPose(canonicalPose, targetBoneMap, retargetData) {
  const { M_map } = retargetData;

  // 1. Forward kinematics of canonical skeleton
  const W_can = new Map();
  for (const bname of BONE_ORDER) {
    const parent = BONE_PARENTS[bname];
    const parentW = parent && W_can.has(parent) ? W_can.get(parent) : new THREE.Quaternion();
    const p = canonicalPose[bname] || { x: 0, y: 0, z: 0 };
    const localQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.x, p.y, p.z, "XYZ"));
    const w = parentW.clone().multiply(localQ);
    W_can.set(bname, w);
  }

  // 2. Map canonical orientations to target avatar skeleton
  const W_target = new Map();
  for (const bname of BONE_ORDER) {
    const bone = targetBoneMap.get(bname);
    if (!bone) continue;
    const parentBone = bone.parent;
    const wCan = W_can.get(bname);
    const M = M_map.get(bname) || new THREE.Quaternion();

    // W_target = wCan * M
    const wTarget = wCan.clone().multiply(M);
    W_target.set(bone.id, wTarget);

    // Compute target local quaternion
    let localQ;
    if (parentBone && W_target.has(parentBone.id)) {
      const parentW = W_target.get(parentBone.id);
      localQ = parentW.clone().invert().multiply(wTarget);
    } else {
      localQ = wTarget;
    }
    if (retargetData.digitRest?.has(bname)) {
      const p = canonicalPose[bname] || { x: 0, y: 0, z: 0 };
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.x, p.y, p.z));
      localQ = M.clone().invert().multiply(delta).multiply(M);
      localQ.premultiply(retargetData.digitRest.get(bname));
      // Descendants must use the corrected parent orientation too.
      const parentW = W_target.get(parentBone?.id);
      W_target.set(bone.id, parentW ? parentW.clone().multiply(localQ) : localQ.clone());
    }
    bone.quaternion.copy(localQ);
  }
}
