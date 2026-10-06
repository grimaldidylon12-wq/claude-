import { JARGON, FILLERS, DEFAULT_CTAS } from './lexicon.js';
import { sentences, capitalizeFirst, phraseRegExp, findHashtags, charCount } from './text.js';
import { findWeakOpener } from './analyze.js';
import { extractHashtagBlock, suggestHashtags, dedupeTags } from './hashtags.js';
import { getPlatform } from './platforms.js';

// Re-attaches a hashtag block after editing the body.
function withTags(body, tags) {
  return tags.length ? `${body}\n\n${tags.join(' ')}` : body;
}

function removeWeakOpener(text) {
  const opener = findWeakOpener(text);
  if (!opener) return text;
  const lead = text.match(/^[\s\p{Extended_Pictographic}‍️]*/u)[0];
  const after = text
    .slice(lead.length + opener.length)
    .replace(/^[\s,:;.!–—-]*(?:that\b)?[\s,:;.!–—-]*/i, '');
  return capitalizeFirst(after);
}

function addLineBreaks(text) {
  return text
    .split(/\n\s*\n/)
    .map((para) => {
      if (para.includes('\n') || charCount(para) <= 280) return para;
      const out = [];
      let cur = [];
      for (const s of sentences(para)) {
        const len = charCount(cur.join(' ')) + charCount(s);
        if (cur.length && (cur.length >= 2 || len > 220)) {
          out.push(cur.join(' '));
          cur = [];
        }
        cur.push(s);
      }
      if (cur.length) out.push(cur.join(' '));
      return out.join('\n\n');
    })
    .join('\n\n');
}

function addCta(text, platformId) {
  const { body, block } = extractHashtagBlock(text);
  return withTags(`${body}\n\n${DEFAULT_CTAS[platformId] || DEFAULT_CTAS.linkedin}`, block);
}

function matchCase(source, replacement) {
  return /^\p{Lu}/u.test(source) ? capitalizeFirst(replacement) : replacement;
}

function dejargon(text) {
  let out = text;
  for (const term of Object.keys(JARGON).sort((a, b) => b.length - a.length)) {
    out = out.replace(phraseRegExp(term), (m, pre, word) => pre + matchCase(word, JARGON[term]));
  }
  return out;
}

const FILLER_RE = new RegExp(`(^|[^\\p{L}\\p{N}'’])(${FILLERS.join('|')}),?\\s+([\\p{L}\\p{N}])`, 'giu');

function stripFiller(text) {
  let out = text;
  for (let i = 0; i < 3; i++) {
    const next = out.replace(FILLER_RE, (m, pre, word, nextChar) => pre + (/^\p{Lu}/u.test(word) ? nextChar.toUpperCase() : nextChar));
    if (next === out) break;
    out = next;
  }
  return out;
}

function addDisclosure(text) {
  const [first, ...rest] = text.split('\n');
  return [`${first.trimEnd()} #ad`, ...rest].join('\n');
}

function addHashtags(text, platformId) {
  const p = getPlatform(platformId);
  const { body, block } = extractHashtagBlock(text);
  const want = Math.max(p.hashtags.ideal[0], Math.min(3, p.hashtags.ideal[1]));
  const have = findHashtags(body).length + block.length;
  const extra = suggestHashtags(text, Math.max(0, want - have));
  return withTags(body, dedupeTags([...block, ...extra]));
}

// Hashtags in the first line become plain words; the tags move to the end.
function moveHashtags(text) {
  const nl = text.indexOf('\n');
  const first = nl < 0 ? text : text.slice(0, nl);
  const tags = findHashtags(first);
  if (!tags.length) return text;
  const cleaned = first.replace(/(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu, '$1$2');
  const { body, block } = extractHashtagBlock(cleaned + (nl < 0 ? '' : text.slice(nl)));
  return withTags(body, dedupeTags([...block, ...tags]));
}

export const FIXES = {
  'remove-weak-opener': { label: 'Cut the weak opener', apply: removeWeakOpener },
  'add-line-breaks': { label: 'Break up long paragraphs', apply: addLineBreaks },
  'add-cta': { label: 'Add a call to action', apply: addCta },
  dejargon: { label: 'Swap jargon for plain words', apply: dejargon },
  'strip-filler': { label: 'Cut filler words', apply: stripFiller },
  'add-disclosure': { label: 'Add #ad disclosure', apply: addDisclosure },
  'add-hashtags': { label: 'Add suggested hashtags', apply: addHashtags },
  'move-hashtags': { label: 'Move hashtags out of the hook', apply: moveHashtags },
};

export function applyFix(id, text, platformId = 'linkedin') {
  const fix = FIXES[id];
  if (!fix) throw new Error(`Unknown fix "${id}". Use one of: ${Object.keys(FIXES).join(', ')}`);
  return fix.apply(text, platformId);
}
