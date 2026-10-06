import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUtmUrl, tagLinks, parseUtm, slugify } from '../src/core/utm.js';

test('slugify makes campaign names analytics-safe', () => {
  assert.equal(slugify('Spring Launch 2026!'), 'spring-launch-2026');
  assert.equal(slugify('Café Été'), 'cafe-ete');
});

test('buildUtmUrl adds params and keeps existing query and hash', () => {
  const url = buildUtmUrl('https://shop.com/p?id=4#reviews', { source: 'linkedin', medium: 'social', campaign: 'Spring Sale' });
  assert.equal(url, 'https://shop.com/p?id=4&utm_source=linkedin&utm_medium=social&utm_campaign=spring-sale#reviews');
});

test('hand-tagged links are not overwritten unless asked', () => {
  const tagged = 'https://a.com/?utm_source=partner';
  assert.match(buildUtmUrl(tagged, { source: 'x', campaign: 'c' }), /utm_source=partner/);
  assert.match(buildUtmUrl(tagged, { source: 'x', campaign: 'c' }, { overwrite: true }), /utm_source=x/);
});

test('invalid URLs pass through; tagLinks needs a campaign', () => {
  assert.equal(buildUtmUrl('not a url', { source: 'x', campaign: 'c' }), 'not a url');
  assert.equal(tagLinks('see https://a.com', { source: 'x' }), 'see https://a.com');
  assert.equal(tagLinks('see https://a.com.', { source: 'x', medium: 'social', campaign: 'c' }), 'see https://a.com/?utm_source=x&utm_medium=social&utm_campaign=c.');
});

test('parseUtm reads params back', () => {
  assert.deepEqual(parseUtm('https://a.com/?utm_source=x&utm_campaign=c'), { source: 'x', campaign: 'c' });
});
