import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapt, adaptEmail, videoScript } from '../src/core/adapt.js';
import { findHashtags } from '../src/core/text.js';
import { SAMPLE } from './fixtures.js';

test('Instagram: links become "link in bio" and hashtags stay within the cap', () => {
  const a = adapt(SAMPLE, 'instagram', { utm: { campaign: 'Email Guide' } });
  assert.ok(!/https?:\/\//.test(a.text));
  assert.match(a.text, /link in bio/);
  assert.match(a.bioLink, /utm_source=instagram&utm_medium=social&utm_campaign=email-guide/);
  assert.ok(findHashtags(a.text).length <= 5);
});

test('hook gets its own line on fold platforms', () => {
  const a = adapt(SAMPLE, 'linkedin');
  assert.equal(a.text.split('\n')[0], "I'm excited to announce that we just published our new guide on email marketing!");
  assert.equal(a.text.split('\n')[1], '');
});

test('X keeps links in place, tagged for X', () => {
  const a = adapt(SAMPLE, 'x', { utm: { campaign: 'launch' } });
  assert.ok(a.posts.some((p) => p.includes('utm_source=twitter')));
  assert.ok(findHashtags(a.text).length <= 1);
});

test('no campaign means links are left untouched', () => {
  assert.ok(adapt(SAMPLE, 'facebook').text.includes('https://example.com/email-guide\n') || adapt(SAMPLE, 'facebook').text.includes('https://example.com/email-guide'));
  assert.ok(!adapt(SAMPLE, 'facebook').text.includes('utm_'));
});

test('TikTok gets a short caption plus a timed script', () => {
  const a = adapt(SAMPLE, 'tiktok');
  assert.ok(a.text.length < 400);
  const { beats, duration } = a.script;
  assert.equal(beats[0].label, 'Hook');
  assert.equal(beats.at(-1).label, 'CTA');
  for (let i = 1; i < beats.length; i++) assert.equal(beats[i].start, beats[i - 1].end);
  assert.equal(duration, beats.at(-1).end);
  assert.ok(!beats.some((b) => /https?:/.test(b.line)), 'no URLs read aloud');
});

test('video script of empty text is empty', () => {
  assert.deepEqual(videoScript(''), { beats: [], duration: 0 });
});

test('email: subject lines fit the inbox and links are tagged as email', () => {
  const e = adaptEmail(SAMPLE, { utm: { campaign: 'guide' } });
  assert.ok(e.subjects.length >= 1);
  for (const s of e.subjects) assert.ok([...s].length <= 51, s);
  assert.ok(e.preheader.length > 0);
  assert.match(e.body, /utm_source=newsletter&utm_medium=email/);
  assert.ok(!/#emailmarketing/.test(e.body), 'hashtag block dropped from email');
});
