import { findHashtags, words } from './text.js';
import { FILLERS } from './lexicon.js';

const TAG = '#[\\p{L}\\p{N}_]+';
const TAG_LINE_RE = new RegExp(`^(?:${TAG}[\\s,]*)+$`, 'u');
const TRAILING_TAGS_RE = new RegExp(`(?:[ \\t]+${TAG})+[ \\t]*$`, 'u');

export function dedupeTags(tags) {
  const seen = new Set();
  return tags.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Separates the "hashtag block" (lines that are only hashtags, or a run of
// tags at the very end) from tags used inline in sentences.
export function extractHashtagBlock(text) {
  const block = [];
  const kept = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t && TAG_LINE_RE.test(t)) block.push(...findHashtags(t));
    else kept.push(line);
  }
  let body = kept.join('\n').replace(/\s+$/, '');
  const m = body.match(TRAILING_TAGS_RE);
  if (m) {
    block.unshift(...findHashtags(m[0]));
    body = body.slice(0, m.index);
  }
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  return { body, inline: findHashtags(body), block: dedupeTags(block) };
}

// Keeps at most `cap` hashtags: inline ones first (they carry meaning in the
// sentence), then the block. Extra inline tags lose their # but keep the word.
export function applyHashtagBudget(body, inline, block, cap) {
  let seen = 0;
  let stripped = 0;
  const text = body.replace(/(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu, (m, pre, word) => {
    seen++;
    if (seen <= cap) return m;
    stripped++;
    return pre + word;
  });
  const inlineKeys = new Set(inline.map((t) => t.toLowerCase()));
  const candidates = block.filter((t) => !inlineKeys.has(t.toLowerCase()));
  const room = Math.max(0, cap - Math.min(inline.length, cap));
  const kept = candidates.slice(0, room);
  return {
    text: kept.length ? `${text}\n\n${kept.join(' ')}` : text,
    kept: Math.min(inline.length, cap) + kept.length,
    removed: stripped + (candidates.length - kept.length),
  };
}

const STOPWORDS = new Set(
  `about above after again against all also am an and any are aren as at be because been before being below
  between both but by can could did do does doing down during each few for from further had has have having
  he her here hers herself him himself his how i if in into is it its itself just let me more most my myself
  no nor not now of off on once only or other our ours ourselves out over own same she should so some such
  than that the their theirs them themselves then there these they this those through to too under until up
  very was we were what when where which while who whom why will with would you your yours yourself yourselves
  here's that's it's don't can't won't we're you're i'm i've we've they're there's what's let's thing things
  make made get got take took want wanted need needed every much many really new one two three first last
  next time today year years day days week weeks month months people way ways lot lots still even back`
    .split(/\s+/)
    .filter(Boolean),
);

// Suggests niche tags from the post's own most-repeated meaningful words.
export function suggestHashtags(text, n = 5) {
  const counts = new Map();
  for (const raw of words(text)) {
    const w = raw.toLowerCase().replace(/[’']s$/, '');
    if (w.length < 4 || /\d/.test(w) || STOPWORDS.has(w) || FILLERS.includes(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const existing = new Set(findHashtags(text).map((t) => t.slice(1).toLowerCase()));
  return [...counts.entries()]
    .filter(([w]) => !existing.has(w))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, n)
    .map(([w]) => '#' + w);
}
