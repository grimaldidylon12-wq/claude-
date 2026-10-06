import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSlot, planSchedule, toICS, toCSV, toMarkdown } from '../src/core/export.js';
import { PLATFORMS } from '../src/core/platforms.js';

const start = new Date(2026, 9, 5, 8, 30); // Mon 5 Oct 2026, 08:30 local

test('nextSlot lands on a benchmark day and hour at or after the start', () => {
  for (const id of Object.keys(PLATFORMS)) {
    const slot = nextSlot(id, start);
    assert.ok(slot >= start);
    assert.ok(PLATFORMS[id].bestTimes.days.includes(slot.getDay()), id);
    assert.ok(PLATFORMS[id].bestTimes.hours.includes(slot.getHours()), id);
  }
  assert.equal(nextSlot('linkedin', start).getDay(), 2, 'LinkedIn waits for Tuesday');
});

const items = [
  { platform: 'linkedin', posts: ['Hook line, with a comma; and semicolon\n\nBody'], firstComment: 'https://a.com' },
  { platform: 'x', posts: ['Post one 1/2', 'Post two 2/2'] },
  { platform: 'email', subjects: ['Subject'], preheader: 'Pre', body: 'Body' },
];

test('planSchedule sorts by time and staggers channels', () => {
  const plan = planSchedule(items, { start, stagger: 1 });
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at >= plan[i - 1].at);
  const days = new Set(plan.map((p) => p.at.toDateString()));
  assert.equal(days.size, 3);
});

test('ICS is valid: CRLF, escaped text, folded lines, one event per item', () => {
  const ics = toICS(planSchedule(items, { start }), { campaign: 'Launch' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 3);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('Hook line\\, with a comma\\; and semicolon\\n\\nBody'));
  assert.match(unfolded, /First comment:\\nhttps:\/\/a\.com/);
});

test('CSV has a row per post with quoted cells', () => {
  const rows = toCSV(planSchedule(items, { start })).trim().split('\r\n');
  assert.equal(rows[0], '"date","time","platform","part","text","first_comment","bio_link"');
  assert.equal(rows.length, 1 + 1 + 2 + 1);
  assert.ok(rows.some((r) => r.includes('"1/2"')));
});

test('Markdown brief lists every channel', () => {
  const md = toMarkdown(planSchedule(items, { start }), { campaign: 'Launch' });
  assert.match(md, /^# Content plan: Launch/);
  for (const name of ['LinkedIn', 'X', 'Email']) assert.match(md, new RegExp(`## ${name} · `));
});
