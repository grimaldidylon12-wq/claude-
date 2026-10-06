import { scoreHook } from './analyze.js';
import { capitalizeFirst } from './text.js';

// Proven hook formulas. Placeholders: {topic} {audience} {outcome} {n} {time}.
export const HOOK_FORMULAS = [
  ['Listicle', '{n} {topic} tips that actually work for {audience}'],
  ['Listicle', '{n} {topic} mistakes {audience} make (and how to fix them)'],
  ['Listicle', '{n} lessons from {time} of {topic}:'],
  ['Listicle', '{n} ways to {outcome} that take less than 10 minutes:'],
  ['Listicle', '{n} {topic} tools I use every week (most are free):'],
  ['How-to', 'How to {outcome} without doubling your budget'],
  ['How-to', "How to {outcome} if you're starting from zero:"],
  ['How-to', 'The simplest way to {outcome} in {time}:'],
  ['How-to', 'How to {outcome}, step by step:'],
  ['How-to', 'Want to {outcome}? Do less, not more.'],
  ['Contrarian', 'Unpopular opinion: most {topic} advice is wrong.'],
  ['Contrarian', 'Stop chasing {topic} hacks. Do this instead:'],
  ['Contrarian', "{Topic} isn't dead. Your approach is."],
  ['Contrarian', 'Most {audience} get {topic} backwards.'],
  ['Contrarian', "You don't need more {topic}. You need better {topic}."],
  ['Curiosity', 'Nobody talks about this {topic} lever.'],
  ['Curiosity', 'The {topic} secret {audience} learn too late:'],
  ['Curiosity', "Here's what nobody tells you about {topic}."],
  ['Curiosity', 'The one {topic} change that will help you {outcome}:'],
  ['Curiosity', "This is why your {topic} isn't working."],
  ['Mistake', "You're losing money on {topic}. Here's why."],
  ['Mistake', 'The biggest {topic} mistake I see {audience} make:'],
  ['Mistake', 'Avoid these {n} {topic} mistakes in {year}.'],
  ['Mistake', 'I wasted {time} on {topic} before I learned this.'],
  ['Result', 'We spent {time} testing {topic}. Here’s what actually worked.'],
  ['Result', 'I tested {n} {topic} ideas for {time}. Only 2 worked.'],
  ['Result', 'What {time} of {topic} experiments taught me:'],
  ['Question', 'What if you could {outcome} in {time}?'],
  ['Question', '{Audience}: are you making these {topic} mistakes?'],
  ['Question', 'Why do most {audience} struggle with {topic}?'],
  ['Question', 'Is your {topic} strategy built for {year}?'],
  ['Story', 'I was wrong about {topic}.'],
  ['Story', 'A year ago I almost gave up on {topic}. Then this happened.'],
  ['Story', 'My first {topic} campaign flopped. Here’s what I changed.'],
  ['Data', 'I studied the top {topic} posts in our niche. {n} patterns stood out:'],
  ['Data', '{n} {topic} numbers every one of you should know in {year}:'],
  ['Data', 'Most {audience} skip this {topic} step. Don’t.'],
  ['Urgency', "If you're not doing this with {topic} yet, you're behind."],
  ['Urgency', 'Read this before your next {topic} campaign.'],
  ['Steal this', 'Steal this {topic} framework:'],
  ['Steal this', 'The {topic} checklist I wish I had {time} ago:'],
  ['Steal this', 'My exact {topic} playbook to help you {outcome}. Free:'],
  ['Steal this', 'Save this {topic} template. It will help you {outcome}.'],
];

const DEFAULTS = { topic: 'content marketing', audience: 'marketers', outcome: 'grow your audience', n: 7, time: '30 days' };

export function fillFormula(template, vars) {
  const v = { ...DEFAULTS, year: new Date().getFullYear(), ...Object.fromEntries(Object.entries(vars).filter(([, x]) => x !== '' && x != null)) };
  return template.replace(/\{(\w+)\}/g, (m, key) => {
    const value = v[key.toLowerCase()];
    if (value == null) return m;
    return /^\p{Lu}/u.test(key) ? capitalizeFirst(String(value)) : String(value);
  });
}

// Fills every formula and ranks the results by hook score.
export function generateHooks(vars = {}) {
  const seen = new Set();
  return HOOK_FORMULAS.map(([category, template]) => {
    const text = fillFormula(template, vars);
    const scored = scoreHook(text);
    return { category, text, score: Math.round(scored.score * 100), signals: scored.signals };
  })
    .filter((h) => !seen.has(h.text) && seen.add(h.text))
    .sort((a, b) => b.score - a.score);
}

// Copywriting frameworks as fill-in skeletons for the editor.
export const FRAMEWORKS = {
  PAS: {
    name: 'Problem, Agitate, Solve',
    template: `Most {audience} struggle with {topic}.

[Problem: describe the pain in one sentence they'd say out loud.]

[Agitate: what it's costing them. Use a number.]

Here's the fix:
→ [Step 1]
→ [Step 2]
→ [Step 3]

[Solve: the result they get when they do this.]

Want the full breakdown? Comment "{topic}" and I'll send it.`,
  },
  AIDA: {
    name: 'Attention, Interest, Desire, Action',
    template: `{n} {topic} lessons that will help you {outcome}:

[Interest: a surprising fact or short story.]

[Desire: paint the after picture. What changes for them?]

1. [Lesson]
2. [Lesson]
3. [Lesson]

Save this for your next campaign and follow for more.`,
  },
  BAB: {
    name: 'Before, After, Bridge',
    template: `{time} ago, our {topic} was a mess.

Before: [what it looked like, with a number]

After: [what it looks like now, with a number]

The bridge: [the 1–3 changes that got us there]

What would you try first? Tell me below.`,
  },
  Listicle: {
    name: 'Numbered list',
    template: `{n} {topic} tips for {audience} (save this):

1. [Tip]: [why it works]
2. [Tip]: [why it works]
3. [Tip]: [why it works]
4. [Tip]: [why it works]
5. [Tip]: [why it works]

Which one are you trying first?`,
  },
  Story: {
    name: 'Story arc',
    template: `I almost gave up on {topic}.

[Setup: where you were and what you wanted.]

[Conflict: what went wrong. Be specific.]

[Turning point: the one thing you changed.]

[Result: what happened next, with a number.]

The lesson: [one sentence takeaway for {audience}].

Has this happened to you?`,
  },
};

export function fillFramework(id, vars = {}) {
  const f = FRAMEWORKS[id];
  if (!f) throw new Error(`Unknown framework "${id}". Use one of: ${Object.keys(FRAMEWORKS).join(', ')}`);
  return fillFormula(f.template, vars);
}
