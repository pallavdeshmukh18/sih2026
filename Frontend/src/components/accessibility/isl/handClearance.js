import { Box3, Vector3, Quaternion } from 'three';

// A conservative torso proxy from torso-weighted skin vertices, in world space.
// This avoids using the full model bounds, which include the moving arms.
export function createHandClearance(avatar, boneMap) {
  avatar.updateMatrixWorld(true);
  const torso = new Box3();
  const torsoSurface = [], handSurface = { Left: [], Right: [] }, skeletons = new Set();
  avatar.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !mesh.visible) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!skinIndex || !skinWeight) return;
    skeletons.add(mesh.skeleton);
    const groups = mesh.skeleton.bones.map(bone => {
      if (/(?:Spine\d*|Hips)(?:_\d+)?$/.test(bone.name)) return 'torso';
      if (/LeftHand/.test(bone.name)) return 'Left';
      if (/RightHand/.test(bone.name)) return 'Right';
      return '';
    });
    for (let i = 0; i < position.count; i++) {
      const weights = { torso: 0, Left: 0, Right: 0 };
      for (let j = 0; j < 4; j++) {
        const group = groups[skinIndex.getComponent(i, j)];
        if (group) weights[group] += skinWeight.getComponent(i, j);
      }
      if (weights.torso >= 0.7) torsoSurface.push({ mesh, index: i });
      for (const side of ['Left', 'Right']) {
        if (weights[side] >= 0.25) handSurface[side].push({ mesh, index: i });
      }
    }
  });
  if (!torsoSurface.length) return null;
  const arms = ['Left', 'Right'].map(side => ({
    hand: boneMap.get(`mixamorig${side}Hand`),
    surface: handSurface[side],
    joints: ['ForeArm', 'Arm'].map(part => boneMap.get(`mixamorig${side}${part}`)),
    samples: [...new Set([...boneMap.entries()].filter(([name]) => name.startsWith(`mixamorig${side}Hand`)).map(([, bone]) => bone))],
  })).filter(arm => arm.hand && arm.joints.every(Boolean));
  const constraint = { torso, arms, torsoSurface, skeletons,
    shoulder: boneMap.get('mixamorigLeftArm'), hip: boneMap.get('mixamorigHips'),
    margin: 0, point: new Vector3() };
  updateTorso(constraint);
  return constraint;
}

// Adjust the arm chain, never finger rotations or bone lengths. Preserve the
// requested wrist orientation so the handshape and palm direction remain intact.
export function applyHandClearance(avatar, constraint) {
  if (!constraint) return;
  avatar.updateMatrixWorld(true);
  updateTorso(constraint);
  const { torso, arms, margin } = constraint;
  const p = new Vector3(), wrist = new Vector3(), pivot = new Vector3();
  const a = new Vector3(), b = new Vector3(), target = new Vector3();
  const delta = new Quaternion(), world = new Quaternion(), parent = new Quaternion();
  avatar.updateMatrixWorld(true);
  for (const arm of arms) {
    const orientation = arm.hand.getWorldQuaternion(new Quaternion());
    for (let pass = 0; pass < 4; pass++) {
      let penetration = 0;
      for (const sample of arm.samples) {
        sample.getWorldPosition(p);
        if (p.x > torso.min.x - margin && p.x < torso.max.x + margin && p.y > torso.min.y && p.y < torso.max.y) {
          penetration = Math.max(penetration, torso.max.z + margin - p.z);
        }
      }
      // Bone centers can be clear while palms, knuckles or fingertips still clip.
      for (const skeleton of constraint.skeletons) skeleton.update();
      for (const { mesh, index } of arm.surface) {
        mesh.getVertexPosition(index, p);
        mesh.localToWorld(p);
        if (p.x > torso.min.x - margin && p.x < torso.max.x + margin && p.y > torso.min.y && p.y < torso.max.y) {
          penetration = Math.max(penetration, torso.max.z + margin - p.z);
        }
      }
      if (penetration < 0.001) break;
      arm.hand.getWorldPosition(wrist);
      target.copy(wrist); target.z += penetration;
      for (let iteration = 0; iteration < 8; iteration++) {
        for (const joint of arm.joints) {
          joint.getWorldPosition(pivot);
          arm.hand.getWorldPosition(wrist);
          a.subVectors(wrist, pivot).normalize();
          b.subVectors(target, pivot).normalize();
          delta.setFromUnitVectors(a, b);
          joint.getWorldQuaternion(world);
          joint.parent.getWorldQuaternion(parent).invert();
          joint.quaternion.copy(parent.multiply(delta).multiply(world));
          joint.updateWorldMatrix(false, true);
        }
      }
      arm.hand.parent.getWorldQuaternion(parent).invert();
      arm.hand.quaternion.copy(parent.multiply(orientation));
      arm.hand.updateWorldMatrix(false, true);
    }
  }
}

function updateTorso(constraint) {
  const { torso, torsoSurface, skeletons, point, shoulder, hip } = constraint;
  for (const skeleton of skeletons) skeleton.update();
  torso.makeEmpty();
  for (const { mesh, index } of torsoSurface) {
    mesh.getVertexPosition(index, point);
    mesh.localToWorld(point);
    torso.expandByPoint(point);
  }
  if (shoulder) torso.max.y = shoulder.getWorldPosition(point).y;
  if (hip) torso.min.y = hip.getWorldPosition(point).y;
  constraint.margin = Math.max(0.005, (torso.max.y - torso.min.y) * 0.035);
}
