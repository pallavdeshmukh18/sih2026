import { Box3, Vector3, Quaternion } from 'three';

// A conservative torso proxy from torso-weighted skin vertices, in world space.
// This avoids using the full model bounds, which include the moving arms.
export function createHandClearance(avatar, boneMap) {
  avatar.updateMatrixWorld(true);
  const torso = new Box3();
  const point = new Vector3();
  avatar.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!skinIndex || !skinWeight) return;
    const indices = new Set(mesh.skeleton.bones.flatMap((bone, index) => /(?:Spine\d*|Hips)(?:_\d+)?$/.test(bone.name) ? [index] : []));
    mesh.skeleton.update();
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (indices.has(skinIndex.getComponent(i, j))) weight += skinWeight.getComponent(i, j);
      if (weight < 0.7) continue;
      mesh.getVertexPosition(i, point);
      mesh.localToWorld(point);
      torso.expandByPoint(point);
    }
  });
  if (torso.isEmpty()) return null;
  const shoulder = boneMap.get('mixamorigLeftArm')?.getWorldPosition(new Vector3());
  const hip = boneMap.get('mixamorigHips')?.getWorldPosition(new Vector3());
  if (shoulder) torso.max.y = shoulder.y;
  if (hip) torso.min.y = hip.y;
  const arms = ['Left', 'Right'].map(side => ({
    hand: boneMap.get(`mixamorig${side}Hand`),
    joints: ['ForeArm', 'Arm'].map(part => boneMap.get(`mixamorig${side}${part}`)),
    samples: [...new Set([...boneMap.entries()].filter(([name]) => name.startsWith(`mixamorig${side}Hand`)).map(([, bone]) => bone))],
  })).filter(arm => arm.hand && arm.joints.every(Boolean));
  return { torso, arms, margin: (torso.max.y - torso.min.y) * 0.045 };
}

// Adjust the arm chain, never finger rotations or bone lengths. Preserve the
// requested wrist orientation so the handshape and palm direction remain intact.
export function applyHandClearance(avatar, constraint) {
  if (!constraint) return;
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
