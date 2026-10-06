import { charCount, xWeightedLength } from './text.js';

// Platform rules. Limits are hard caps; folds are where the feed truncates
// with "…see more" (approximate, mobile-first); ideal ranges and best times
// are industry benchmarks to start from, not laws. Last reviewed: 2026.

export const PLATFORMS = {
  x: {
    id: 'x',
    name: 'X',
    limit: 280,
    counter: 'x-weighted',
    fold: null,
    ideal: [70, 240],
    hashtags: { ideal: [0, 1], max: 2 },
    links: 'ok',
    thread: { numbered: true },
    emoji: { max: 0.06 },
    utmSource: 'twitter',
    bestTimes: { days: [2, 3, 4], hours: [9, 12] },
    tone: 'Punchy. One idea per post.',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    limit: 3000,
    counter: 'chars',
    fold: 210,
    ideal: [600, 1800],
    hashtags: { ideal: [0, 3], max: 5 },
    links: 'first-comment',
    thread: null,
    emoji: { max: 0.03 },
    utmSource: 'linkedin',
    bestTimes: { days: [2, 3, 4], hours: [8, 10, 12] },
    tone: 'Insight-led, short paragraphs, white space.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    limit: 2200,
    counter: 'chars',
    fold: 125,
    ideal: [150, 1000],
    hashtags: { ideal: [3, 5], max: 5 },
    links: 'bio',
    thread: null,
    emoji: { max: 0.08 },
    utmSource: 'instagram',
    bestTimes: { days: [1, 2, 3, 4, 5], hours: [11, 13, 19] },
    tone: 'Visual-first caption. Hook, value, CTA.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    limit: 4000,
    counter: 'chars',
    fold: 90,
    ideal: [60, 300],
    hashtags: { ideal: [3, 5], max: 6 },
    links: 'bio',
    thread: null,
    emoji: { max: 0.08 },
    utmSource: 'tiktok',
    bestTimes: { days: [2, 3, 4], hours: [14, 17, 20] },
    tone: 'Short caption. The video does the talking.',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    limit: 500,
    counter: 'chars',
    fold: null,
    ideal: [80, 450],
    hashtags: { ideal: [0, 1], max: 1 },
    links: 'ok',
    thread: { numbered: false },
    emoji: { max: 0.06 },
    utmSource: 'threads',
    bestTimes: { days: [1, 2, 3, 4], hours: [8, 12, 18] },
    tone: 'Conversational. Start a discussion.',
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    limit: 300,
    counter: 'chars',
    fold: null,
    ideal: [70, 280],
    hashtags: { ideal: [0, 2], max: 3 },
    links: 'ok',
    thread: { numbered: true },
    emoji: { max: 0.05 },
    utmSource: 'bluesky',
    bestTimes: { days: [1, 2, 3, 4], hours: [9, 13, 17] },
    tone: 'Plain-spoken and genuine.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    limit: 63206,
    counter: 'chars',
    fold: 240,
    ideal: [80, 500],
    hashtags: { ideal: [0, 2], max: 3 },
    links: 'ok',
    thread: null,
    emoji: { max: 0.06 },
    utmSource: 'facebook',
    bestTimes: { days: [2, 3, 4], hours: [9, 12] },
    tone: 'Friendly, community tone.',
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS);

export const EMAIL = {
  id: 'email',
  name: 'Email',
  subject: { ideal: [25, 50], max: 78 },
  preheader: { ideal: [40, 90], max: 130 },
  utmSource: 'newsletter',
  bestTimes: { days: [2, 4], hours: [10] },
};

export function getPlatform(id) {
  const p = PLATFORMS[id];
  if (!p) throw new Error(`Unknown platform "${id}". Use one of: ${PLATFORM_IDS.join(', ')}`);
  return p;
}

// Length as the platform's own counter sees it.
export function lengthFor(platform, text) {
  return platform.counter === 'x-weighted' ? xWeightedLength(text) : charCount(text);
}
