import test from 'node:test';
import assert from 'node:assert/strict';
import { planText, compileGestures, createTransition, sampleTransition } from '../src/components/accessibility/isl/playback.js';
import { getCanonicalRestPose, getCanonicalIdlePose } from '../src/components/accessibility/isl/retargeting.js';
import { TIME } from '../src/components/accessibility/isl/Words/TIME.js';
import { A } from '../src/components/accessibility/isl/Alphabets/A.js';

test('medical sentences preserve all words including negation', () => {
  const plan = planText('Doctor, do NOT go HOME', { HOME: TIME });
  assert.equal(plan.tokens.filter(t => t.letter).map(t => t.word).join(''), 'DOCTORDONOTGO');
  assert.equal(plan.tokens.at(-1).word, 'HOME');
  assert.equal(plan.spelled, true);
});
test('numbers are spelled and unsupported scripts are not silently discarded', () => {
  assert.equal(planText('12', {}).tokens.map(t => t.word).join(''), 'ONETWO');
  assert.deepEqual(planText('HOME नमस्ते', { HOME: TIME }).tokens, []);
  assert.equal(planText('?!', {}).tokens.length, 0);
});
test('word movement frames survive and reset occurs only at the end', () => {
  const steps = compileGestures(planText('TIME A', { TIME }).tokens, { TIME }, { A });
  assert.equal(steps.length, 5);
  assert.equal(steps.filter(s => s.hold).length, 2);
  assert.deepEqual(steps.at(-1).pose, getCanonicalIdlePose());
});
test('pose depends on elapsed time, not the number of rendered frames', () => {
  const from = getCanonicalRestPose();
  const to = structuredClone(from);
  to.mixamorigRightArm.x = 1;
  const transition = createTransition(from, to, 0);
  const slow = structuredClone(from), fast = structuredClone(from);
  for (let t = 0; t < 100; t += 1000 / 30) sampleTransition(transition, t, slow);
  for (let t = 0; t < 100; t += 1000 / 144) sampleTransition(transition, t, fast);
  sampleTransition(transition, 100, slow);
  sampleTransition(transition, 100, fast);
  assert.deepEqual(slow, fast);
  assert.equal(sampleTransition(transition, 10000, fast), true);
  assert.ok(Math.abs(fast.mixamorigRightArm.x - 1) < 1e-10);
});
test('repeated letters have a visible release and independent poses', () => {
  const steps = compileGestures(planText('AA', {}).tokens, {}, { A });
  assert.equal(steps.length, 4);
  assert.notDeepEqual(steps[0].pose, steps[1].pose);
  assert.deepEqual(steps[0].pose, steps[2].pose);
  assert.notEqual(steps[0].pose, steps[2].pose);
});
