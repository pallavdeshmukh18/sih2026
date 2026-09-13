import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSiteTextResolver, flattenStrings } from '../src/components/accessibility/isl/siteText.js';
import { planText, normalizeSignText } from '../src/components/accessibility/isl/playback.js';
const folder = new URL('../src/i18n/locales/', import.meta.url);
const resources = Object.fromEntries(readdirSync(folder).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), { translation: JSON.parse(readFileSync(new URL(f, folder))) }]));
const resolve = createSiteTextResolver(resources);

test('every English catalog label has playable text', () => {
  for (const [key, text] of Object.entries(flattenStrings(resources.en.translation))) {
    const plan = planText(text.replace(/\{\{.*?\}\}/g, '1'), {});
    assert.deepEqual(plan.unsupported, [], `${key}: ${text}`);
    assert.ok(plan.tokens.length > 0, key);
  }
});
test('localized website labels use their authored English counterpart', () => {
  for (const [language, { translation }] of Object.entries(resources)) {
    const label = translation.common.continue;
    assert.equal(resolve(label, language), resources.en.translation.common.continue);
  }
});
test('unrecognized dynamic content is preserved rather than guessed', () => {
  assert.equal(resolve('Unknown patient name', 'hi'), 'Unknown patient name');
  assert.equal(resolve('अनजान नाम', 'hi'), 'अनजान नाम');
});
test('medical symbols, decimals, and units keep their meaning', () => {
  assert.equal(normalizeSignText('98.6°F & 5mg'), '98 POINT 6 DEGREES F  AND  5 MG');
  assert.deepEqual(planText('SpO2 98% 5mg', {}).unsupported, []);
  assert.ok(normalizeSignText('-5').includes('MINUS'));
});
