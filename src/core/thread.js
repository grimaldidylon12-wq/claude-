import { paragraphs, sentences, graphemes } from './text.js';

// Splits text into posts that each fit `limit` as measured by `measure`.
// Breaks on paragraphs, then sentences, then words, and keeps the opening
// paragraph as a standalone first post so the hook leads the thread.
export function splitThread(text, { limit, measure, numbered = false, hookFirst = true }) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (measure(trimmed) <= limit) return [trimmed];

  // The " i/n" suffix eats into every post; its size depends on n, so
  // re-split until the count stops changing.
  let n = 2;
  for (let attempt = 0; attempt < 5; attempt++) {
    const reserve = numbered ? ` ${n}/${n}`.length : 0;
    const chunks = pack(trimmed, limit - reserve, measure, hookFirst);
    if (!numbered) return chunks;
    if (String(chunks.length).length === String(n).length) {
      return chunks.map((c, i) => `${c} ${i + 1}/${chunks.length}`);
    }
    n = chunks.length;
  }
  const chunks = pack(trimmed, limit - ` ${n}/${n}`.length, measure, hookFirst);
  return chunks.map((c, i) => `${c} ${i + 1}/${chunks.length}`);
}

function pack(text, budget, measure, hookFirst) {
  const posts = [];
  let current = '';
  const flush = () => {
    if (current.trim()) posts.push(current.trim());
    current = '';
  };

  paragraphs(text).forEach((para, pi) => {
    // Keep line structure inside a paragraph (lists, one-liners).
    const paraLines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    paraLines.forEach((line, li) => {
      const sep = !current ? '' : li === 0 ? '\n\n' : '\n';
      const whole = current + sep + line;
      if (measure(whole) <= budget) {
        current = whole;
        return;
      }
      const units = sentences(line).flatMap((s) => (measure(s) <= budget ? [s] : splitWords(s, budget, measure)));
      units.forEach((unit, ui) => {
        const joiner = !current ? '' : ui === 0 ? sep : ' ';
        const candidate = current + joiner + unit;
        if (measure(candidate) <= budget) {
          current = candidate;
        } else {
          flush();
          current = unit;
        }
      });
    });
    if (hookFirst && pi === 0) flush();
  });
  flush();
  return posts;
}

function splitWords(sentence, budget, measure) {
  const out = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    const candidate = current ? current + ' ' + word : word;
    if (measure(candidate) <= budget) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    if (measure(word) <= budget || /^https?:\/\//i.test(word)) {
      current = word;
    } else {
      // A single token longer than the budget: hard-cut it.
      const gs = graphemes(word);
      let piece = '';
      for (const g of gs) {
        if (measure(piece + g) > budget) {
          out.push(piece);
          piece = '';
        }
        piece += g;
      }
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}
