import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateHooks, fillFramework, FRAMEWORKS, HOOK_FORMULAS } from '../src/core/hooks.js';

test('generates 40+ filled, ranked hooks', () => {
  const hooks = generateHooks({ topic: 'TikTok ads', audience: 'DTC brands', outcome: 'cut your CPA', n: 5, time: '90 days' });
  assert.ok(hooks.length >= 40);
  for (const h of hooks) {
    assert.ok(!/[{}]/.test(h.text), h.text);
    assert.ok(h.score >= 0 && h.score <= 100);
  }
  for (let i = 1; i < hooks.length; i++) assert.ok(hooks[i].score <= hooks[i - 1].score);
  assert.ok(hooks.some((h) => h.text.startsWith('DTC brands:') || h.text.includes('DTC brands')));
});

test('defaults fill missing inputs', () => {
  assert.ok(generateHooks({}).every((h) => !/[{}]/.test(h.text)));
  assert.equal(HOOK_FORMULAS.length >= 40, true);
});

test('frameworks fill with the topic', () => {
  for (const id of Object.keys(FRAMEWORKS)) {
    const t = fillFramework(id, { topic: 'podcasting' });
    assert.ok(!/[{}]/.test(t));
  }
  assert.match(fillFramework('PAS', { topic: 'podcasting' }), /podcasting/);
});
