import { getPlatform, lengthFor, EMAIL, PLATFORM_IDS } from './platforms.js';
import { URL_RE, findUrls, sentences, words, hookOf, lines, charCount, round } from './text.js';
import { extractHashtagBlock, applyHashtagBudget } from './hashtags.js';
import { splitThread } from './thread.js';
import { tagLinks } from './utm.js';
import { CTA_PHRASES, DEFAULT_CTAS } from './lexicon.js';
import { containsPhrase } from './text.js';

function utmFor(source, utm, medium = 'social') {
  if (!utm || !utm.campaign) return null;
  return { source, medium: utm.medium || medium, campaign: utm.campaign, content: utm.content, term: utm.term };
}

// Moves links out of the body where the platform punishes or ignores them.
function handleLinks(text, policy, platformName) {
  const urls = findUrls(text);
  if (!urls.length || policy === 'ok') return { text, notes: [] };
  const where = policy === 'bio' ? 'link in bio' : 'link in the first comment';
  const out = text
    .split('\n')
    .map((line) => {
      if (!findUrls(line).length) return line;
      const rest = line.replace(URL_RE, '').replace(/[\s:–—-]+$/, '').trim();
      if (!rest) return where.charAt(0).toUpperCase() + where.slice(1) + '.';
      if (/(?:here|below|this|more|guide|post|article|link)$/i.test(rest)) return `${rest}: ${where}.`;
      return line.replace(URL_RE, `(${where})`);
    })
    .join('\n');
  const notes = [
    {
      id: 'links',
      text:
        policy === 'bio'
          ? `${platformName} captions can't hold clickable links, so the post now says "link in bio". Put the link shown below in your bio.`
          : `${platformName} tends to show posts with outside links to fewer people, so the link moved to the first comment.`,
    },
  ];
  return policy === 'bio' ? { text: out, bioLink: urls[0], notes } : { text: out, firstComment: urls.join('\n'), notes };
}

// Puts the first sentence on its own line so it lands above "see more".
function isolateHook(text) {
  const paras = text.split(/\n\s*\n/);
  const first = paras[0];
  if (first.includes('\n')) return text;
  const ss = sentences(first);
  if (ss.length < 2) return text;
  return [ss[0], ss.slice(1).join(' '), ...paras.slice(1)].join('\n\n');
}

function hasCta(text) {
  const tail = text.split(/\n\s*\n/).slice(-2).join(' ');
  return /\?\s*$/.test(tail.trim()) || CTA_PHRASES.some((p) => containsPhrase(tail, p)) || findUrls(tail).length > 0 || /\blink in (?:bio|the first comment)\b/i.test(tail);
}

// TikTok captions are short; the post's substance moves into the script.
function tiktokCaption(body) {
  const hook = hookOf(body);
  const ctaLine = sentences(body).reverse().find((s) => CTA_PHRASES.some((p) => containsPhrase(s, p)));
  return [hook, ctaLine && ctaLine !== hook ? ctaLine : DEFAULT_CTAS.tiktok].join('\n\n');
}

export function adapt(master, platformId, opts = {}) {
  const p = getPlatform(platformId);
  const notes = [];
  const source = String(master || '').replace(/\r\n?/g, '\n').trim();
  let { body, inline, block } = extractHashtagBlock(source);
  const measure = (t) => lengthFor(p, t);

  body = tagLinks(body, utmFor(p.utmSource, opts.utm));
  const linked = handleLinks(body, p.links, p.name);
  body = linked.text;
  notes.push(...linked.notes);

  if (p.id === 'tiktok' && body) {
    const caption = tiktokCaption(body);
    if (caption !== body) notes.push({ id: 'length', text: 'Trimmed to a short caption. The full message is in the video script below.' });
    body = caption;
    inline = inline.filter((t) => body.includes(t));
  }

  // Lead with the hook alone: above the fold, or as post 1 of a thread.
  if (p.fold || (p.thread && measure(body) > p.limit)) {
    const iso = isolateHook(body);
    if (iso !== body) {
      body = iso;
      if (p.fold) notes.push({ id: 'fold', text: 'Put the hook on its own line so it lands above "see more".' });
    }
  }

  const cap = p.hashtags.ideal[1];
  const tagged = applyHashtagBudget(body, inline, block, cap);
  if (tagged.removed > 0) {
    notes.push({
      id: 'hashtags',
      text: cap === 0 ? `Removed hashtags; they don't help on ${p.name}.` : `Kept ${tagged.kept} of ${tagged.kept + tagged.removed} hashtags, the ${p.name} norm.`,
    });
  }
  const text = tagged.text;

  const posts = p.thread && text ? splitThread(text, { limit: p.limit, measure, numbered: p.thread.numbered }) : text ? [text] : [];
  if (posts.length > 1) notes.push({ id: 'length', text: `Split into a ${posts.length}-post thread; every post fits the ${p.limit}-character limit.` });

  const result = {
    platform: p.id,
    name: p.name,
    text,
    posts,
    length: measure(text),
    limit: p.limit,
    fold: p.fold,
    notes,
    hasCta: hasCta(text),
  };
  if (linked.firstComment) result.firstComment = linked.firstComment;
  if (linked.bioLink) result.bioLink = linked.bioLink;
  if (p.id === 'tiktok') result.script = videoScript(source);
  return result;
}

export function adaptAll(master, opts = {}) {
  const out = {};
  for (const id of PLATFORM_IDS) out[id] = adapt(master, id, opts);
  out.email = adaptEmail(master, opts);
  return out;
}

const SPOKEN_WPS = 2.5; // ~150 words per minute

// Turns a post into a timed short-form video script (TikTok, Reels, Shorts).
export function videoScript(master) {
  const { body } = extractHashtagBlock(String(master || '').trim());
  const spoken = handleLinks(body, 'bio', '').text.replace(/\(link in bio\)/gi, '');
  const all = sentences(spoken.replace(/\n+/g, ' '));
  if (!all.length) return { beats: [], duration: 0 };

  const [hook, ...rest] = all;
  let cta = DEFAULT_CTAS.tiktok;
  const last = rest[rest.length - 1];
  if (last && CTA_PHRASES.some((p) => containsPhrase(last, p))) cta = rest.pop();

  // Group the middle into beats of up to ~25 words.
  const middle = [];
  let cur = [];
  for (const s of rest) {
    const n = cur.reduce((a, x) => a + words(x).length, 0) + words(s).length;
    if (cur.length && n > 25) {
      middle.push(cur.join(' '));
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length) middle.push(cur.join(' '));

  const beats = [];
  let t = 0;
  const add = (label, line) => {
    const secs = Math.max(2, round(words(line).length / SPOKEN_WPS, 1));
    const caption = words(line).slice(0, 6).join(' ');
    beats.push({ label, start: round(t, 1), end: round(t + secs, 1), line, onScreen: caption + (words(line).length > 6 ? '…' : '') });
    t += secs;
  };
  add('Hook', hook);
  middle.forEach((m, i) => add(middle.length > 1 ? `Point ${i + 1}` : 'Body', m));
  add('CTA', cta);
  return { beats, duration: round(t, 1) };
}

function shorten(s, max) {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (charCount(clean) <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.5 ? cut.slice(0, at) : clean.slice(0, max)).replace(/[\s,;:–—-]+$/, '') + '…';
}

function stripTrailing(s) {
  return s.replace(/[\s.!:;,]+$/, '');
}

export function adaptEmail(master, opts = {}) {
  const source = String(master || '').replace(/\r\n?/g, '\n').trim();
  const { body } = extractHashtagBlock(source);
  const tagged = tagLinks(body, utmFor(EMAIL.utmSource, opts.utm, 'email'));
  const hook = hookOf(body);
  const ss = sentences(body.replace(/\n+/g, ' '));
  const clauses = hook.split(/[,:;–—]|\s-\s/).map((c) => c.trim()).filter((c) => words(c).length >= 3);

  const candidates = [stripTrailing(hook), clauses[0] && stripTrailing(clauses[0]), ss[1] && stripTrailing(ss[1])]
    .filter(Boolean)
    .map((s) => shorten(s, EMAIL.subject.ideal[1]));
  const subjects = [...new Set(candidates)].filter((s) => s.length > 3).slice(0, 3);

  const bodyLines = lines(body).filter((l) => !findUrls(l).length);
  const preheaderSource = bodyLines.find((l) => stripTrailing(l) !== stripTrailing(hook)) || ss[1] || '';
  const preheader = shorten(preheaderSource.replace(hook, '').trim() || preheaderSource, EMAIL.preheader.ideal[1]);

  return { platform: 'email', name: 'Email', subjects, preheader, body: tagged, notes: [] };
}
