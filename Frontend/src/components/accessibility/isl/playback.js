import { Euler, Quaternion } from 'three';
import { getCanonicalRestPose, getCanonicalIdlePose } from './retargeting.js';

const SYMBOL_WORDS = { '&': ' AND ', '%': ' PERCENT ', '+': ' PLUS ', '=': ' EQUALS ', '₹': ' RUPEES ', '$': ' DOLLARS ', '°': ' DEGREES ', '/': ' SLASH ', '@': ' AT ', '<': ' LESS THAN ', '>': ' GREATER THAN ', '−': ' MINUS ' };
export function normalizeSignText(text) {
  return String(text || '').normalize('NFKC')
    .replace(/[&%+=₹$°/@<>−]/g, symbol => SYMBOL_WORDS[symbol])
    .replace(/(\d)\.(?=\d)/g, '$1 POINT ')
    .replace(/-(?=\d)/g, ' MINUS ')
    .replace(/(\d)(?=[A-Za-z])|([A-Za-z])(?=\d)/g, '$1$2 ')
    .toUpperCase();
}

// Preserve meaning and ordering. Only exact dictionary matches use word gestures.
export function planText(text, dictionary) {
  const tokens = [];
  const unsupported = [];
  let spelled = false;
  for (const word of (normalizeSignText(text).match(/[\p{L}\p{N}\p{M}]+/gu) || [])) {
    if (typeof dictionary[word] === 'function') tokens.push({ word, label: word });
    else if (/^[A-Z]+$/.test(word)) {
      spelled = true;
      for (const letter of word) tokens.push({ word: letter, label: `${word} · ${letter}`, letter: true });
    } else if (/^[0-9]+$/.test(word)) {
      spelled = true;
      const names = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
      for (const digit of word) for (const letter of names[Number(digit)]) {
        tokens.push({ word: letter, label: `${word} · ${names[Number(digit)]} · ${letter}`, letter: true });
      }
    } else unsupported.push(word);
  }
  // Do not silently omit unsupported parts of a sentence.
  return { tokens: unsupported.length ? [] : tokens, unsupported, spelled };
}

export function compileGestures(tokens, dictionary, alphabet) {
  const steps = [];
  for (const [tokenIndex, token] of tokens.entries()) {
    const builder = token.letter ? alphabet[token.word] : dictionary[token.word];
    if (typeof builder !== 'function') continue;
    const collector = { animations: [], characters: [], pending: true };
    builder(collector);
    const frames = collector.animations.filter(frame => Array.isArray(frame[0]));
    // The last legacy frame resets the hands. Blend directly into the next sign instead.
    const signingFrames = frames.length > 1 ? frames.slice(0, -1) : frames;
    // Repeated letters need a visible release to distinguish LL from L.
    if (token.letter && tokens[tokenIndex - 1]?.word === token.word) {
      const released = structuredClone(steps.at(-1).pose);
      for (const [bone, action, axis, target] of frames.at(-1) || []) {
        if (action === 'rotation' && released[bone]) released[bone][axis] = target;
      }
      steps.push({ pose: released, hold: false });
    }
    let pose = getCanonicalRestPose();
    signingFrames.forEach((frame, index) => {
      pose = structuredClone(pose);
      for (const [bone, action, axis, target] of frame) {
        if (action === 'rotation' && pose[bone]) pose[bone][axis] = target;
      }
      steps.push({ pose, token: index === 0 ? token.label : '', hold: index === signingFrames.length - 1 });
    });
  }
  if (steps.length) steps.push({ pose: getCanonicalIdlePose(), hold: false });
  return steps;
}

export function createTransition(from, to, start, speed = 0.08) {
  const joints = [];
  let angle = 0;
  for (const [name, target] of Object.entries(to)) {
    const origin = from[name] || target;
    const a = new Quaternion().setFromEuler(new Euler(origin.x, origin.y, origin.z));
    const b = new Quaternion().setFromEuler(new Euler(target.x, target.y, target.z));
    angle = Math.max(angle, a.angleTo(b));
    joints.push({ name, a, b, q: new Quaternion(), euler: new Euler() });
  }
  const rate = Number.isFinite(speed) ? Math.max(0.02, Math.min(0.2, speed)) : 0.08;
  return { joints, start, duration: Math.max(120, angle / (rate * 60) * 1000) };
}

export function sampleTransition(transition, now, pose) {
  const t = Math.max(0, Math.min(1, (now - transition.start) / transition.duration));
  const eased = t * t * (3 - 2 * t);
  for (const joint of transition.joints) {
    joint.q.slerpQuaternions(joint.a, joint.b, eased);
    joint.euler.setFromQuaternion(joint.q);
    pose[joint.name] = { x: joint.euler.x, y: joint.euler.y, z: joint.euler.z };
  }
  return t === 1;
}
