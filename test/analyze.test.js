import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, review, reviewAll, scoreHook, findWeakOpener } from '../src/core/analyze.js';
import { PLATFORM_IDS } from '../src/core/platforms.js';
import { SAMPLE, STRONG } from './fixtures.js';

const byId = (r, id) => r.checks.find((c) => c.id === id);

test('weak openers are caught and sink the hook', () => {
  assert.equal(findWeakOpener("I’m excited to announce our launch"), "i'm excited to announce");
  assert.equal(findWeakOpener('🚀 Hey guys, big news'), 'hey guys');
  assert.equal(findWeakOpener('Checkout flows that convert'), null, 'needs a word boundary');
  const weak = scoreHook("I'm excited to announce our new email guide!");
  const strong = scoreHook('7 email mistakes that are costing you opens:');
  assert.ok(strong.score - weak.score >= 0.4, `${strong.score} vs ${weak.score}`);
  assert.equal(weak.weakOpener, "i'm excited to announce");
});

test('a strong post outscores a weak one on every channel', () => {
  const weak = reviewAll(SAMPLE);
  const strong = reviewAll(STRONG);
  for (const id of PLATFORM_IDS) assert.ok(strong[id].score > weak[id].score, `${id}: ${strong[id].score} <= ${weak[id].score}`);
});

test('scores are 0-100 with a letter grade and sorted checks', () => {
  for (const r of Object.values(reviewAll(SAMPLE))) {
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.match(r.grade, /^[A-F]$/);
  }
  const statuses = review(SAMPLE, 'linkedin').checks.map((c) => c.status);
  const order = { fail: 0, warn: 1, pass: 2, auto: 3 };
  assert.deepEqual(statuses, [...statuses].sort((a, b) => order[a] - order[b]));
});

test('LinkedIn: the link moves to the first comment and the check shows as handled', () => {
  const r = review(SAMPLE, 'linkedin');
  assert.ok(!/https?:\/\//.test(r.adapted.text));
  assert.equal(r.adapted.firstComment, 'https://example.com/email-guide');
  assert.equal(byId(r, 'links').status, 'auto');
  assert.equal(byId(r, 'hashtags').status, 'auto');
});

test('raw analysis flags a link in a LinkedIn body', () => {
  const r = analyze('Read this: https://example.com', 'linkedin');
  assert.equal(byId(r, 'links').status, 'warn');
  assert.equal(byId(analyze('Read this: https://example.com', 'instagram'), 'links').status, 'fail');
});

test('posts over a hard limit fail and cap the score', () => {
  const r = review('Long caption. '.repeat(200), 'instagram');
  assert.equal(byId(r, 'length').status, 'fail');
  assert.ok(r.score <= 40);
});

test('paid content without disclosure fails compliance', () => {
  const r = review('Use my code SAVE20 for 20% off these shoes. Link in bio!', 'instagram');
  const c = byId(r, 'compliance');
  assert.equal(c.status, 'fail');
  assert.equal(c.fix.id, 'add-disclosure');
  assert.equal(byId(review('Use my code SAVE20 for 20% off #ad. Link in bio!', 'instagram'), 'compliance').status, 'pass');
});

test('risky claims are flagged', () => {
  assert.equal(byId(review('Guaranteed results in 7 days or your money back.', 'facebook'), 'compliance').status, 'fail');
});

test('missing CTA is flagged with a fix; a closing question counts as a CTA', () => {
  assert.equal(byId(review('We shipped the new dashboard today.', 'x'), 'cta').fix.id, 'add-cta');
  assert.equal(byId(review('We shipped the new dashboard today. What should we build next?', 'x'), 'cta').status, 'pass');
});

test('empty input scores zero without throwing', () => {
  for (const r of Object.values(reviewAll(''))) assert.equal(r.score, 0);
});
