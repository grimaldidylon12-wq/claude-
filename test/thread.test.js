import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitThread } from '../src/core/thread.js';
import { adapt } from '../src/core/adapt.js';
import { xWeightedLength, charCount, words } from '../src/core/text.js';
import { SAMPLE, randomText } from './fixtures.js';

const stripNumbering = (p) => p.replace(/ \d+\/\d+$/, '');

test('short text stays a single post', () => {
  assert.deepEqual(splitThread('Hello world.', { limit: 280, measure: charCount }), ['Hello world.']);
});

test('X threads respect the weighted limit and are numbered', () => {
  const { posts } = adapt(SAMPLE, 'x');
  assert.ok(posts.length > 1);
  posts.forEach((p, i) => {
    assert.ok(xWeightedLength(p) <= 280, `post ${i + 1} is ${xWeightedLength(p)}`);
    assert.match(p, new RegExp(` ${i + 1}/${posts.length}$`));
  });
  assert.match(posts[0], /^I'm excited to announce.*marketing! 1\//, 'hook leads the thread on its own');
});

for (const [name, limit, measure, numbered] of [
  ['x', 280, xWeightedLength, true],
  ['bluesky', 300, charCount, true],
  ['threads', 500, charCount, false],
]) {
  test(`${name}: every split of random text fits and keeps every word in order`, () => {
    for (let seed = 1; seed <= 60; seed++) {
      const text = randomText(seed, 3 + (seed % 25));
      const posts = splitThread(text, { limit, measure, numbered });
      for (const p of posts) assert.ok(measure(p) <= limit, `seed ${seed}: ${measure(p)} > ${limit}`);
      const rebuilt = posts.map(numbered ? stripNumbering : (p) => p).join(' ');
      assert.deepEqual(words(rebuilt), words(text), `seed ${seed}: words changed`);
    }
  });
}

test('a single token longer than the limit is hard-cut', () => {
  const posts = splitThread('a'.repeat(700), { limit: 300, measure: charCount });
  assert.equal(posts.join(''), 'a'.repeat(700));
  posts.forEach((p) => assert.ok(p.length <= 300));
});
