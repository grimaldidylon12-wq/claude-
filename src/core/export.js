import { PLATFORMS, EMAIL } from './platforms.js';
import { hookOf } from './text.js';

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function specFor(id) {
  return id === 'email' ? EMAIL : PLATFORMS[id];
}

// First benchmark slot at or after `from` (local time).
export function nextSlot(platformId, from) {
  const { days, hours } = specFor(platformId).bestTimes;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 14; i++) {
    const day = new Date(base.getTime() + i * DAY_MS);
    if (!days.includes(day.getDay())) continue;
    for (const h of hours) {
      const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0);
      if (slot >= from) return slot;
    }
  }
  return new Date(from);
}

// Gives each adapted post a publish slot. With stagger, each channel goes
// out at least `stagger` days after the previous one.
export function planSchedule(items, { start = new Date(), stagger = 0 } = {}) {
  let cursor = new Date(start);
  const plan = [];
  for (const item of items) {
    const at = nextSlot(item.platform, cursor);
    plan.push({ ...item, at });
    if (stagger > 0) {
      const next = new Date(at.getFullYear(), at.getMonth(), at.getDate() + stagger);
      cursor = next > cursor ? next : cursor;
    }
  }
  return plan.sort((a, b) => a.at - b.at);
}

function postsOf(item) {
  if (item.platform === 'email') {
    return [`Subject: ${item.subjects?.[0] ?? ''}\nPreheader: ${item.preheader ?? ''}\n\n${item.body ?? ''}`];
  }
  return item.posts || [];
}

// iCalendar text escaping and 75-octet line folding (RFC 5545).
function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const max = out.length ? 74 : 75;
    if (bytes + b > max) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function toICS(plan, { campaign = '' } = {}) {
  const now = icsDate(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Scrollstop//Content Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  plan.forEach((item, i) => {
    const name = specFor(item.platform).name;
    const posts = postsOf(item);
    const parts = posts.map((p, j) => (posts.length > 1 ? `[${j + 1}/${posts.length}]\n${p}` : p));
    if (item.firstComment) parts.push(`First comment:\n${item.firstComment}`);
    if (item.bioLink) parts.push(`Bio link:\n${item.bioLink}`);
    const end = new Date(item.at.getTime() + 15 * 60000);
    const hook = hookOf(item.platform === 'email' ? item.subjects?.[0] ?? '' : posts[0] ?? '').slice(0, 60);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsDate(item.at)}-${item.platform}-${i}@scrollstop`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(item.at)}`,
      `DTEND:${icsDate(end)}`,
      fold(`SUMMARY:${icsEscape(`Post to ${name}${campaign ? ` (${campaign})` : ''}: ${hook}`)}`),
      fold(`DESCRIPTION:${icsEscape(parts.join('\n\n---\n\n'))}`),
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${icsEscape(`Time to post on ${name}`)}`),
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function toCSV(plan) {
  const rows = [['date', 'time', 'platform', 'part', 'text', 'first_comment', 'bio_link']];
  for (const item of plan) {
    const posts = postsOf(item);
    posts.forEach((p, j) => {
      rows.push([
        formatDate(item.at),
        formatTime(item.at),
        specFor(item.platform).name,
        posts.length > 1 ? `${j + 1}/${posts.length}` : '1',
        p,
        j === 0 ? item.firstComment ?? '' : '',
        j === 0 ? item.bioLink ?? '' : '',
      ]);
    });
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toMarkdown(plan, { campaign = '' } = {}) {
  const out = [`# Content plan${campaign ? `: ${campaign}` : ''}`, ''];
  for (const item of plan) {
    const name = specFor(item.platform).name;
    out.push(`## ${name} · ${DAY_NAMES[item.at.getDay()]} ${formatDate(item.at)} ${formatTime(item.at)}`, '');
    postsOf(item).forEach((p, j, all) => {
      if (all.length > 1) out.push(`**Post ${j + 1} of ${all.length}**`, '');
      out.push(...p.split('\n').map((l) => `> ${l}`), '');
    });
    if (item.firstComment) out.push(`**First comment:** ${item.firstComment}`, '');
    if (item.bioLink) out.push(`**Bio link:** ${item.bioLink}`, '');
  }
  return out.join('\n');
}
