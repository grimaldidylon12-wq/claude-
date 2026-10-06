export const SAMPLE = `I'm excited to announce that we just published our new guide on email marketing! In today's world, inboxes are crowded and it's really hard to stand out, so we decided to leverage our data from 2,400 campaigns to find what actually moves the needle. The biggest surprise was that subject lines under 40 characters got 21% more opens than longer ones, and sending on Tuesday mornings beat every other slot. We also found that plain-text emails outperformed heavily designed templates for B2B audiences.

Read the full guide here: https://example.com/email-guide

#emailmarketing #marketing #b2b #growth #contentmarketing #digitalmarketing #marketingtips`;

export const STRONG = `7 email subject line mistakes that are costing you opens:

1. Writing more than 40 characters
2. Leading with your brand name
3. Using "newsletter" in the subject

Fix these and you'll see the difference in a week.

Which one are you guilty of? Tell me below.`;

// Deterministic pseudo-random text for property-style tests.
export function randomText(seed, sentenceCount) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const vocab = ['growth', 'marketing', 'audience', 'content', 'post', 'you', 'we', 'launch', 'campaign', 'strategy', 'creator', 'brand', 'insight', 'engagement', 'reach', 'test', 'results', 'week', 'data', 'story', '🚀', '数据', 'https://example.com/a-long-path/that-keeps-going?x=1'];
  const out = [];
  for (let i = 0; i < sentenceCount; i++) {
    const n = 4 + Math.floor(rand() * 30);
    const ws = Array.from({ length: n }, () => vocab[Math.floor(rand() * vocab.length)]);
    out.push(ws.join(' ').replace(/^./, (c) => c.toUpperCase()) + (rand() > 0.8 ? '?' : '.'));
    if (rand() > 0.7) out.push('\n\n');
  }
  return out.join(' ').replace(/ \n\n /g, '\n\n');
}
