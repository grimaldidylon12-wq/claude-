// Text primitives shared by every other module. Pure functions, no DOM.

const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
const graphemeSeg = hasSegmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const sentenceSeg = hasSegmenter ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
const wordSeg = hasSegmenter ? new Intl.Segmenter('en', { granularity: 'word' }) : null;

export const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/gi;
export const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;
export const MENTION_RE = /(^|[^\p{L}\p{N}_.])@([A-Za-z0-9_.]{2,30})/gu;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function graphemes(text) {
  if (!text) return [];
  if (graphemeSeg) return Array.from(graphemeSeg.segment(text), (s) => s.segment);
  return Array.from(text);
}

export function charCount(text) {
  return graphemes(text).length;
}

export function isEmoji(grapheme) {
  return EMOJI_RE.test(grapheme);
}

export function countEmojis(text) {
  return graphemes(text).filter(isEmoji).length;
}

export function findUrls(text) {
  return text.match(URL_RE) || [];
}

export function findHashtags(text) {
  return Array.from(text.matchAll(HASHTAG_RE), (m) => '#' + m[2]);
}

export function findMentions(text) {
  return Array.from(text.matchAll(MENTION_RE), (m) => '@' + m[2]);
}

// X counts most Latin text as 1, CJK and emoji as 2, and every URL as 23.
// Ranges mirror twitter-text's v3 config.
const X_LIGHT_RANGES = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

export function xWeightedLength(text) {
  const urls = findUrls(text);
  let stripped = text;
  for (const u of urls) stripped = stripped.replace(u, '');
  let len = urls.length * 23;
  for (const g of graphemes(stripped)) {
    if (isEmoji(g)) {
      len += 2;
      continue;
    }
    const cp = g.codePointAt(0);
    len += X_LIGHT_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
  }
  return len;
}

export function sentences(text) {
  // Shield URLs so "?" and "." inside them don't end a sentence.
  const urls = [];
  const clean = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(URL_RE, (u) => `${urls.push(u) - 1}`);
  if (!clean) return [];
  const restore = (s) => s.replace(/(\d+)/g, (m, i) => urls[Number(i)]);
  return splitSentences(clean).map(restore);
}

function splitSentences(clean) {
  if (sentenceSeg) {
    const out = [];
    let carry = '';
    for (const { segment } of sentenceSeg.segment(clean)) {
      const s = carry + segment;
      // ICU splits after common abbreviations ("Dr. Smith"); stitch those back.
      if (/\b(?:Dr|Mr|Mrs|Ms|Jr|Sr|vs|etc|e\.g|i\.e|St|No)\.\s*$/i.test(s.trim()) && !/[!?]\s*$/.test(s)) {
        carry = s;
        continue;
      }
      carry = '';
      if (s.trim()) out.push(s.trim());
    }
    if (carry.trim()) out.push(carry.trim());
    return out;
  }
  return clean.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g).map((s) => s.trim()).filter(Boolean);
}

export function words(text) {
  if (!text) return [];
  const t = text.replace(URL_RE, ' ');
  if (wordSeg) {
    return Array.from(wordSeg.segment(t))
      .filter((s) => s.isWordLike)
      .map((s) => s.segment);
  }
  return t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
}

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function readability(text) {
  const ws = words(text).filter((w) => /\p{L}/u.test(w));
  const ss = Math.max(1, sentences(text).length);
  if (!ws.length) return { readingEase: 100, gradeLevel: 0, avgSentenceLength: 0 };
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const wps = ws.length / ss;
  const spw = syl / ws.length;
  return {
    readingEase: round(206.835 - 1.015 * wps - 84.6 * spw, 1),
    gradeLevel: Math.max(0, round(0.39 * wps + 11.8 * spw - 15.59, 1)),
    avgSentenceLength: round(wps, 1),
  };
}

export function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function lines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

// The hook is what the reader sees first: the first non-empty line, or its
// first sentence when that line runs on.
export function hookOf(text) {
  const first = lines(text)[0] || '';
  if (first.length <= 160) return first;
  return sentences(first)[0] || first;
}

export function sliceGraphemes(text, n) {
  return graphemes(text).slice(0, n).join('');
}

export function round(n, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches a phrase on word boundaries, case-insensitive.
export function phraseRegExp(phrase, flags = 'gi') {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(phrase)})(?=$|[^\\p{L}\\p{N}])`, flags + 'u');
}

export function containsPhrase(text, phrase) {
  return phraseRegExp(phrase, 'i').test(text);
}

export function capitalizeFirst(s) {
  const i = s.search(/\p{L}/u);
  if (i < 0) return s;
  return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}
