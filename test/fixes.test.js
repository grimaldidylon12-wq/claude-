import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFix, FIXES } from '../src/core/fixes.js';
import { review } from '../src/core/analyze.js';
import { SAMPLE } from './fixtures.js';

test('remove-weak-opener cuts the opener and "that", then capitalizes', () => {
  assert.equal(applyFix('remove-weak-opener', "I'm excited to announce that we launched Pulse!"), 'We launched Pulse!');
  assert.equal(applyFix('remove-weak-opener', 'Hey guys, today I want to share three tips.'), 'Today I want to share three tips.');
  assert.equal(applyFix('remove-weak-opener', 'Nothing weak here.'), 'Nothing weak here.');
});

test('dejargon swaps phrases and keeps capitalization', () => {
  assert.equal(applyFix('dejargon', 'Leverage synergy to move the needle.'), 'Use teamwork to make a difference.');
});

test('strip-filler removes fillers without breaking sentence case', () => {
  assert.equal(applyFix('strip-filler', 'Really, this is very very simple and it just works.'), 'This is simple and it works.');
});

test('add-cta goes before the hashtag block', () => {
  const out = applyFix('add-cta', 'Big news today.\n\n#launch #saas', 'linkedin');
  assert.match(out, /Big news today\.\n\nWhat's your take\? Tell me in the comments\.\n\n#launch #saas$/);
});

test('add-line-breaks splits walls of text into short paragraphs', () => {
  const wall = 'One sentence here that is long enough. '.repeat(10).trim();
  const out = applyFix('add-line-breaks', wall);
  for (const para of out.split('\n\n')) assert.ok(para.length <= 230);
});

test('add-disclosure clears the compliance check', () => {
  const draft = 'Use my code SAVE20 for 20% off these sneakers.\n\nLink in bio!';
  const fixed = applyFix('add-disclosure', draft, 'instagram');
  assert.equal(fixed.split('\n')[0], 'Use my code SAVE20 for 20% off these sneakers. #ad');
  assert.notEqual(review(fixed, 'instagram').checks.find((c) => c.id === 'compliance').status, 'fail');
});

test('move-hashtags pulls tags out of the hook', () => {
  assert.equal(applyFix('move-hashtags', 'Why #SEO still matters\n\nBody text.'), 'Why SEO still matters\n\nBody text.\n\n#SEO');
});

test('add-hashtags suggests tags from the post itself', () => {
  const out = applyFix('add-hashtags', 'Sourdough baking tips. Sourdough needs patience. Baking is chemistry.', 'instagram');
  assert.match(out, /#sourdough/);
  assert.match(out, /#baking/);
});

test('applying every suggested fix lifts the sample a lot', () => {
  for (const platform of ['linkedin', 'instagram', 'x']) {
    let text = SAMPLE;
    const before = review(text, platform).score;
    for (let round = 0; round < 3; round++) {
      for (const c of review(text, platform).checks) if (c.fix) text = applyFix(c.fix.id, text, platform);
    }
    const after = review(text, platform).score;
    assert.ok(after - before >= 15, `${platform}: ${before} -> ${after}`);
  }
});

test('every fix is a no-op or improvement on empty text', () => {
  for (const id of Object.keys(FIXES)) assert.equal(typeof applyFix(id, '', 'linkedin'), 'string');
});
