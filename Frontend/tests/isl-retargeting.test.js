import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group, Euler, Quaternion } from 'three';
import { initRetargeting, applyRetargetedPose, createCanonicalPose } from '../src/components/accessibility/isl/retargeting.js';

test('target bind curl is not added to authored finger flexion', () => {
  const root = new Group(), hand = new Bone(), finger = new Bone();
  root.add(hand); hand.add(finger);
  finger.rotation.set(0.2, 0, 0.03);
  const map = new Map([['mixamorigRightHand', hand], ['mixamorigRightHandIndex1', finger]]);
  const data = initRetargeting(root, map), pose = createCanonicalPose();
  pose.mixamorigRightHandIndex1.z = Math.PI / 2;
  applyRetargetedPose(pose, map, data);
  const expected = new Quaternion().setFromEuler(new Euler(0, 0, 0.03))
    .multiply(new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)));
  assert.ok(finger.quaternion.angleTo(expected) < 1e-6);
});
test('thumb base retains opposition at the neutral source pose', () => {
  const root = new Group(), hand = new Bone(), thumb = new Bone();
  root.add(hand); hand.add(thumb);
  thumb.rotation.set(0.12, 0.05, 0.4);
  const expected = thumb.quaternion.clone();
  const map = new Map([['mixamorigRightHand', hand], ['mixamorigRightHandThumb1', thumb]]);
  const data = initRetargeting(root, map);
  applyRetargetedPose(createCanonicalPose(), map, data);
  assert.ok(thumb.quaternion.angleTo(expected) < 1e-6);
});
