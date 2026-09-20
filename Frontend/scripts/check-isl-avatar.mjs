// Run against a local Vite dev server. Set PLAYWRIGHT_MODULE to an installed
// playwright module entry if Playwright is not installed in this workspace.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.ISL_TEST_URL || 'http://127.0.0.1:5173'}/test/isl`);
  await page.waitForFunction(() => window.__islRuntime?.isLoaded);
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const base = '/src/components/accessibility/isl/';
    const [alphabet, words, playback, rig, clearance] = await Promise.all(
      ['alphabets.js', 'words.js', 'playback.js', 'retargeting.js', 'handClearance.js'].map(file => import(base + file)));
    const runtime = window.__islRuntime;
    cancelAnimationFrame(runtime.animFrameId);
    const pose = rig.getCanonicalIdlePose();
    const point = new window.__THREE.Vector3();
    let frames = 0, worstPenetration = 0, totalMs = 0;
    for (const token of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'TIME', 'HOME', 'PERSON', 'YOU']) {
      for (const step of playback.compileGestures(playback.planText(token, words).tokens, words, alphabet)) {
        const transition = playback.createTransition(pose, step.pose, 0);
        for (let sample = 0; sample <= 10; sample++) {
          playback.sampleTransition(transition, transition.duration * sample / 10, pose);
          rig.applyRetargetedPose(pose, runtime.boneMap, runtime.retargetData);
          const start = performance.now();
          clearance.applyHandClearance(runtime.avatar, runtime.handClearance);
          totalMs += performance.now() - start;
          frames++;
          const { torso, skeletons, arms } = runtime.handClearance;
          for (const skeleton of skeletons) skeleton.update();
          for (const arm of arms) for (const { mesh, index } of arm.surface) {
            mesh.getVertexPosition(index, point); mesh.localToWorld(point);
            if (!Number.isFinite(point.x + point.y + point.z)) throw new Error(`Invalid vertex: ${token}`);
            if (point.x > torso.min.x && point.x < torso.max.x && point.y > torso.min.y && point.y < torso.max.y) {
              worstPenetration = Math.max(worstPenetration, torso.max.z - point.z);
            }
          }
        }
      }
    }
    return { frames, worstPenetration, meanClearanceMs: totalMs / frames };
  });
  assert.deepEqual(errors, []);
  assert.ok(result.worstPenetration < 0.001, JSON.stringify(result));
  console.log(result);
} finally { await browser.close(); }
