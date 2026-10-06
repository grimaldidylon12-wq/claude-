import { getPlatform, lengthFor, PLATFORM_IDS, EMAIL } from './platforms.js';
import {
  words, sentences, readability, findHashtags, findMentions, findUrls, countEmojis, paragraphs, lines,
  hookOf, charCount, containsPhrase, phraseRegExp,
} from './text.js';
import {
  WEAK_OPENERS, CURIOSITY, CONTRARIAN, POWER_WORDS, JARGON, FILLERS, HEDGES, CTA_PHRASES,
  DISCLOSURE_TRIGGERS, DISCLOSURE_TAGS, RISKY_CLAIMS,
} from './lexicon.js';
import { adapt, adaptEmail } from './adapt.js';
import { extractHashtagBlock } from './hashtags.js';

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const norm = (s) => s.replace(/[’‘]/g, "'");
const statusOf = (score) => (score >= 0.8 ? 'pass' : score >= 0.5 ? 'warn' : 'fail');
const fmt = (n) => n.toLocaleString('en-US');

const WEAK_SORTED = [...WEAK_OPENERS].sort((a, b) => b.length - a.length);

export function findWeakOpener(text) {
  const start = norm(text).replace(/^[\s\p{Extended_Pictographic}‍️]+/u, '').toLowerCase();
  return WEAK_SORTED.find((o) => start.startsWith(o) && !/^[\p{L}\p{N}]/u.test(start.slice(o.length))) || null;
}

function countPhrases(text, list) {
  return list.reduce((n, p) => n + (text.match(phraseRegExp(p)) || []).length, 0);
}

function foundPhrases(text, list) {
  return list.filter((p) => containsPhrase(text, p));
}

const NUMBER_RE = /\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million)\b/i;
const SPECIFIC_RE = /[$€£]\s?\d|\d+(?:[.,]\d+)?\s?%|\b\d+(?:\.\d+)?\s?[xkm]\b|\b\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|clients?|customers?|campaigns?|posts?|followers?|subscribers?|leads?)\b/i;

// Scores the opening line: the only part most people ever read.
export function scoreHook(hook) {
  const text = norm(hook || '').trim();
  const signals = [];
  if (!text) return { text: '', score: 0, signals: [{ good: false, text: 'No hook yet. Start with the line that makes people stop.' }], weakOpener: null };

  let s = 0.45;
  const good = (pts, msg) => { s += pts; signals.push({ good: true, text: msg }); };
  const bad = (pts, msg) => { s -= pts; signals.push({ good: false, text: msg }); };

  const n = words(text).length;
  if (n >= 4 && n <= 14) good(0.08, `Tight: ${n} words`);
  else if (n > 25) bad(0.15, `Long for a hook: ${n} words. Aim for 14 or fewer.`);
  else if (n > 14) bad(0.05, `A little long: ${n} words. Aim for 14 or fewer.`);
  else if (n < 3) bad(0.1, 'Too short to say anything specific.');

  if (NUMBER_RE.test(text)) good(0.12, 'Uses a specific number');
  if (SPECIFIC_RE.test(text)) good(0.06, 'Promises a concrete result or timeframe');
  if (/\byou(?:r|'re|'ll|'ve)?\b/i.test(text)) good(0.08, 'Speaks to the reader ("you")');
  if (foundPhrases(text, CURIOSITY).length) good(0.12, 'Opens a curiosity gap');
  if (foundPhrases(text, CONTRARIAN).length) good(0.1, 'Pattern interrupt: challenges an assumption');
  if (/\?/.test(text)) good(0.05, 'Asks a question');
  if (/[:…👇]$|\.\.\.$/u.test(text)) good(0.04, 'Ends on an open loop');
  if (foundPhrases(text, POWER_WORDS).length) good(0.06, 'Emotional, high-energy wording');

  const weak = findWeakOpener(text);
  if (weak) {
    const shown = text.replace(/^[\s\p{Extended_Pictographic}\u200d\ufe0f]+/u, '').slice(0, weak.length);
    bad(0.35, `Weak opener: "${shown}". It sounds like every other announcement.`);
  }
  if (/^\s*[#@]|^\s*https?:/i.test(text)) bad(0.2, 'Starts with a hashtag, mention or link');
  else if (findHashtags(text).length) bad(0.08, 'Hashtags in the hook distract from it');
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 8 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.6) bad(0.1, 'ALL CAPS reads as shouting');
  if (foundPhrases(text, HEDGES).length) bad(0.08, 'Hedging ("I think", "maybe") weakens the claim');
  if (foundPhrases(text, Object.keys(JARGON)).length) bad(0.08, 'Corporate jargon in the hook');

  return { text: hook.trim(), score: clamp(s), signals, weakOpener: weak };
}

export function measure(text, platformId) {
  const p = getPlatform(platformId);
  const ws = words(text);
  return {
    length: lengthFor(p, text),
    limit: p.limit,
    chars: charCount(text),
    words: ws.length,
    sentences: sentences(text).length,
    ...readability(text),
    readingTimeSec: Math.max(1, Math.round((ws.length / 238) * 60)),
    hashtags: findHashtags(text),
    mentions: findMentions(text),
    urls: findUrls(text),
    emojis: countEmojis(text),
    paragraphs: paragraphs(text).length,
    lines: lines(text).length,
  };
}

function check(id, label, weight, score, message, fix) {
  const c = { id, label, weight, score: clamp(score), status: statusOf(score), message };
  if (fix && score < 0.8) c.fix = fix;
  return c;
}

// Scores `text` as-is against one platform's rules.
export function analyze(text, platformId, { posts = 1, notes = [] } = {}) {
  const p = getPlatform(platformId);
  const m = measure(text, platformId);
  const checks = [];
  const firstLine = lines(text)[0] || '';
  const hook = scoreHook(hookOf(text));

  // Hook
  const negatives = hook.signals.filter((x) => !x.good);
  let hookMsg;
  if (negatives.length) hookMsg = negatives[0].text;
  else if (hook.score >= 0.8) hookMsg = 'Strong hook. It gives people a reason to stop.';
  else if (!NUMBER_RE.test(hook.text)) hookMsg = 'Add a specific number or result to make the hook concrete.';
  else hookMsg = 'Sharpen the hook: speak to "you" or open a curiosity gap.';
  let hookFix;
  if (hook.weakOpener) hookFix = { id: 'remove-weak-opener', label: 'Cut the weak opener' };
  else if (findHashtags(hook.text).length && !/^\s*#/.test(hook.text)) hookFix = { id: 'move-hashtags', label: 'Move hashtags out of the hook' };
  checks.push(check('hook', 'Hook strength', 25, hook.score, hookMsg, hookFix));

  // Fold
  if (p.fold) {
    const firstLen = charCount(firstLine);
    if (m.chars <= p.fold) checks.push(check('fold', 'Above the fold', 10, 1, `The whole post shows without "see more".`));
    else if (firstLen <= p.fold) checks.push(check('fold', 'Above the fold', 10, 1, `Hook fits above "see more" (${firstLen}/${p.fold} characters).`));
    else checks.push(check('fold', 'Above the fold', 10, 0.3, `Your first line is ${fmt(firstLen)} characters; ${p.name} cuts it off at about ${p.fold}. Shorten it so the hook lands before "see more".`));
  }

  // Length
  const [lo, hi] = p.ideal;
  if (posts > 1) {
    checks.push(check('length', 'Length', 10, 0.9, `Runs as a ${posts}-post thread; every post fits the ${fmt(p.limit)}-character limit.`));
  } else if (m.length > p.limit) {
    checks.push(check('length', 'Length', 10, 0, `${fmt(m.length - p.limit)} characters over the ${fmt(p.limit)} limit. ${p.name} won't let you post this.`));
  } else if (m.length < lo) {
    checks.push(check('length', 'Length', 10, 0.65, `${fmt(m.length)} characters. ${p.name} posts in the ${fmt(lo)}–${fmt(hi)} range tend to perform better.`));
  } else if (m.length > hi) {
    checks.push(check('length', 'Length', 10, 0.75, `${fmt(m.length)} characters is long for ${p.name}. The ${fmt(lo)}–${fmt(hi)} range tends to hold attention.`));
  } else {
    checks.push(check('length', 'Length', 10, 1, `${fmt(m.length)} characters, right in the ${fmt(lo)}–${fmt(hi)} sweet spot.`));
  }

  // Readability
  const g = m.gradeLevel;
  let rs = g <= 7 ? 1 : g <= 9 ? 0.8 : g <= 11 ? 0.55 : g <= 13 ? 0.35 : 0.15;
  if (m.avgSentenceLength > 25) rs -= 0.15;
  checks.push(
    check('readability', 'Readability', 10, rs,
      rs >= 0.8
        ? `Easy to read (grade ${g}).`
        : `Reads at grade ${g} with ${m.avgSentenceLength} words per sentence. Aim for grade 8 or below: shorter sentences, simpler words.`),
  );

  // Skimmability (single-post platforms; threads are short by design)
  if (!p.thread) {
    const longest = Math.max(0, ...paragraphs(text).map((x) => charCount(x)));
    if (m.chars < 280 || longest <= 300) {
      checks.push(check('skim', 'Easy to skim', 10, 1, 'Short paragraphs and white space. Easy to skim on a phone.'));
    } else {
      const sc = longest <= 500 ? 0.6 : 0.3;
      checks.push(check('skim', 'Easy to skim', 10, sc, `Your longest paragraph is ${fmt(longest)} characters. Break it into one- or two-sentence lines; people skim on phones.`, { id: 'add-line-breaks', label: 'Break up long paragraphs' }));
    }
  }

  // CTA
  const { body } = extractHashtagBlock(text);
  const tail = body.split(/\n\s*\n/).slice(-2).join(' ');
  // A closing question, an explicit ask, or a pointer to the link all count.
  const ctaFound = /\?\s*$/.test(tail.trim()) || CTA_PHRASES.some((x) => containsPhrase(tail, x)) || findUrls(tail).length > 0 || /\blink in (?:bio|the first comment)\b/i.test(tail);
  checks.push(
    ctaFound
      ? check('cta', 'Call to action', 10, 1, 'Ends with a clear next step for the reader.')
      : check('cta', 'Call to action', 10, 0.3, 'No call to action. Tell people what to do next: comment, save, share, or click.', { id: 'add-cta', label: 'Add a call to action' }),
  );

  // Hashtags
  const tags = m.hashtags.length;
  const [tlo, thi] = p.hashtags.ideal;
  if (tags > p.hashtags.max) {
    checks.push(check('hashtags', 'Hashtags', 5, 0.2, `${tags} hashtags. ${p.name} allows or rewards ${p.hashtags.max} at most.`));
  } else if (tags > thi) {
    checks.push(check('hashtags', 'Hashtags', 5, 0.7, `${tags} hashtags. ${tlo === 0 ? 'Up to' : `${tlo}–`}${thi} is the norm on ${p.name}.`));
  } else if (tags < tlo) {
    checks.push(check('hashtags', 'Hashtags', 5, 0.6, `Add ${tlo}–${thi} specific hashtags so ${p.name} knows who to show this to.`, { id: 'add-hashtags', label: 'Add suggested hashtags' }));
  } else {
    checks.push(check('hashtags', 'Hashtags', 5, 1, tags ? `${tags} hashtag${tags > 1 ? 's' : ''}, within the ${p.name} norm.` : `No hashtags. That's fine on ${p.name}.`));
  }

  // Links
  if (m.urls.length) {
    if (p.links === 'bio') checks.push(check('links', 'Links', 5, 0.2, `Links in ${p.name} captions aren't clickable. Say "link in bio" instead.`));
    else if (p.links === 'first-comment') checks.push(check('links', 'Links', 5, 0.5, `${p.name} tends to show posts with outside links to fewer people. Put the link in the first comment.`));
    else checks.push(check('links', 'Links', 5, 1, /utm_/.test(m.urls.join(' ')) ? 'Links are tagged for tracking.' : `Links work fine on ${p.name}. Add a campaign name to track clicks.`));
  }

  // Clarity
  const jargon = countPhrases(text, Object.keys(JARGON));
  const fillers = countPhrases(text, FILLERS);
  const hedges = countPhrases(text, HEDGES);
  const cs = 1 - 0.15 * jargon - 0.07 * fillers - 0.1 * hedges;
  let clarityMsg = 'Plain, confident language.';
  let clarityFix;
  if (cs >= 0.8) {
    // Good enough; leave the message positive.
  } else if (jargon) {
    clarityMsg = `${jargon} jargon phrase${jargon > 1 ? 's' : ''} (${foundPhrases(text, Object.keys(JARGON)).slice(0, 3).join(', ')}). Plain words land harder.`;
    clarityFix = { id: 'dejargon', label: 'Swap jargon for plain words' };
  } else if (fillers >= 2 || hedges) {
    clarityMsg = `${fillers + hedges} filler or hedge word${fillers + hedges > 1 ? 's' : ''} (${foundPhrases(text, [...FILLERS, ...HEDGES]).slice(0, 3).join(', ')}). Cut them to sound sure.`;
    clarityFix = { id: 'strip-filler', label: 'Cut filler words' };
  }
  checks.push(check('clarity', 'Clarity', 5, Math.max(0.2, cs), clarityMsg, clarityFix));

  // Emoji
  if (m.emojis) {
    const density = m.emojis / Math.max(1, m.words);
    const es = density <= p.emoji.max ? 1 : density <= p.emoji.max * 2 ? 0.6 : 0.25;
    checks.push(check('emoji', 'Emoji', 5, es, es === 1 ? `${m.emojis} emoji, used with restraint.` : `${m.emojis} emoji in ${m.words} words feels busy for ${p.name}. Keep the ones that add meaning.`));
  }

  // Compliance
  const triggers = foundPhrases(text, DISCLOSURE_TRIGGERS);
  const disclosed = DISCLOSURE_TAGS.some((t) => norm(text).toLowerCase().includes(t));
  const risky = foundPhrases(text, RISKY_CLAIMS);
  if (triggers.length && !disclosed) {
    checks.push(check('compliance', 'Disclosure and claims', 15, 0, `Mentions "${triggers[0]}" but has no disclosure. FTC rules require a clear #ad or "Paid partnership" label up front.`, { id: 'add-disclosure', label: 'Add #ad disclosure' }));
  } else if (risky.length) {
    checks.push(check('compliance', 'Disclosure and claims', 15, 0.3, `Claims like "${risky.slice(0, 2).join('", "')}" can get posts flagged and ads rejected. Back them up or soften them.`));
  } else {
    checks.push(check('compliance', 'Disclosure and claims', 5, 1, triggers.length ? 'Paid relationship is disclosed.' : 'No disclosure or risky-claim issues.'));
  }

  // Changes the adapter made for this platform show as handled.
  for (const note of notes) {
    const c = checks.find((x) => x.id === note.id);
    if (!c) checks.push({ id: note.id, label: note.id === 'links' ? 'Links' : note.id, weight: 5, score: 1, status: 'auto', message: note.text });
    else if (c.status === 'pass') Object.assign(c, { status: 'auto', message: note.text });
  }

  const total = checks.reduce((a, c) => a + c.weight, 0);
  let score = Math.round((100 * checks.reduce((a, c) => a + c.weight * c.score, 0)) / total);
  if (!p.thread && m.length > p.limit) score = Math.min(score, 40);
  if (!text.trim()) score = 0;

  const order = { fail: 0, warn: 1, pass: 2, auto: 3 };
  checks.sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);

  return { platform: p.id, name: p.name, score, grade: gradeOf(score), hook, metrics: m, checks };
}

export function gradeOf(score) {
  return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
}

// Adapts the master draft for a platform, then scores what you'd actually post.
export function review(master, platformId, opts = {}) {
  const adapted = adapt(master, platformId, opts);
  const analysis = analyze(adapted.text, platformId, { posts: adapted.posts.length, notes: adapted.notes });
  return { ...analysis, adapted };
}

export function reviewAll(master, opts = {}) {
  const out = {};
  for (const id of PLATFORM_IDS) out[id] = review(master, id, opts);
  out.email = reviewEmail(master, opts);
  return out;
}

export function reviewEmail(master, opts = {}) {
  const adapted = adaptEmail(master, opts);
  const scored = adapted.subjects.map((s) => {
    const h = scoreHook(s);
    const len = charCount(s);
    const [lo, hi] = EMAIL.subject.ideal;
    const fit = len >= lo && len <= hi ? 1 : len <= EMAIL.subject.max ? 0.75 : 0.4;
    return { text: s, length: len, score: Math.round(100 * (0.75 * h.score + 0.25 * fit)), signals: h.signals };
  });
  const best = scored.reduce((a, b) => (b.score > (a ? a.score : -1) ? b : a), null);
  const score = best ? best.score : 0;
  return { platform: 'email', name: 'Email', score, grade: gradeOf(score), subjects: scored, adapted };
}
