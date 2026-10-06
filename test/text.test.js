import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xWeightedLength, sentences, syllables, readability, findHashtags, findUrls, charCount, hookOf, countEmojis } from '../src/core/text.js';

test('X weighted length counts URLs as 23, emoji and CJK as 2', () => {
  assert.equal(xWeightedLength('hello'), 5);
  assert.equal(xWeightedLength('see https://example.com/a/very/long/path/indeed'), 4 + 23);
  assert.equal(xWeightedLength('🚀'), 2);
  assert.equal(xWeightedLength('数据'), 4);
  assert.equal(xWeightedLength('👩‍💻'), 2, 'ZWJ sequences count once');
});

test('graphemes treat emoji sequences as one character', () => {
  assert.equal(charCount('👩‍💻 ok'), 4);
  assert.equal(countEmojis('Go 🚀🔥 now'), 2);
});

test('sentences keep abbreviations together', () => {
  assert.deepEqual(sentences('I met Dr. Smith today. It went well! Did it?'), ['I met Dr. Smith today.', 'It went well!', 'Did it?']);
});

test('syllables and readability are sensible', () => {
  assert.equal(syllables('cat'), 1);
  assert.equal(syllables('marketing'), 3);
  const easy = readability('The cat sat. The dog ran. We had fun.');
  const hard = readability('Organizational transformation necessitates comprehensive stakeholder alignment regarding multifaceted operational considerations.');
  assert.ok(easy.gradeLevel < hard.gradeLevel);
  assert.ok(easy.readingEase > hard.readingEase);
});

test('hashtag detection skips URL fragments and bare numbers', () => {
  assert.deepEqual(findHashtags('Love #SEO and #b2b. Not page#anchor or #1.'), ['#SEO', '#b2b']);
  assert.deepEqual(findUrls('Go to https://example.com/x. Then stop.'), ['https://example.com/x']);
});

test('hook is the first line, or its first sentence when the line runs long', () => {
  assert.equal(hookOf('\n\nShort hook\nBody'), 'Short hook');
  const long = 'This first sentence is the hook. ' + 'Then a lot of words follow it in the same line without a break. '.repeat(4);
  assert.equal(hookOf(long), 'This first sentence is the hook.');
});
