# Scrollstop

**Write one post. Scrollstop scores it, fixes it, adapts it and schedules it for every feed.**

Every marketer knows the grind: one idea has to be rewritten by hand for X, LinkedIn, Instagram, TikTok, Threads, Bluesky, Facebook and email. Each channel has its own character limit, "…see more" cutoff, hashtag norms and link penalties, and you can't tell whether a hook works until it flops.

Scrollstop does that work in one pass. It's free, needs no signup and no API key, and runs entirely in your browser, so your drafts never leave the page.

## What it does

| | |
|---|---|
| **Scroll-Stop Score** | A live 0–100 score and letter grade for each of 7 social channels plus email, as you type. Every point is explained. |
| **Hook analysis** | Grades your first line, the only line most people read. Numbers, "you", curiosity gaps and pattern interrupts earn points. "I'm excited to announce…", hashtags in the hook and hedging lose them. |
| **One-click fixes** | Cut the weak opener · break up walls of text · add a CTA · swap jargon for plain words · cut filler · add `#ad` disclosure · suggest hashtags · move hashtags out of the hook. **Fix all** does every one, and **Undo** reverses it. |
| **Platform adapter** | Turns the draft into each channel's native format. X, Threads and Bluesky get numbered threads that respect the real limits (X counts links as 23 characters and emoji as 2). LinkedIn gets the hook on its own line above the fold and the link moved to the first comment. Instagram and TikTok get "link in bio" and the right hashtag count. |
| **Feed previews** | A mock of each feed that shows exactly where the platform cuts your post off at "see more". |
| **Video script** | Turns any post into a timed TikTok, Reels or Shorts script (hook at 0–3s, then points and CTA) with on-screen captions. |
| **Email version** | Ranked subject lines that fit a phone inbox, plus a preheader. |
| **Auto-UTM** | Enter a campaign name and every link is tagged for its channel (`utm_source=linkedin`, `instagram`, …), so analytics show which feed drove the clicks. |
| **Hook Lab** | Enter your topic, audience and outcome to get 40+ hooks from proven formulas (listicle, contrarian, curiosity, mistake, story…), ranked by score. Includes PAS, AIDA, BAB, listicle and story frameworks. |
| **Planner** | Puts every channel on a benchmark posting time. Export a calendar file (.ics, with a reminder and the copy inside each event), a CSV, or a Markdown brief for approvals. |
| **Link tagger** | Paste one link and get a tracking link for every channel. |
| **Compliance check** | Flags paid content with no disclosure (FTC) and claims like "guaranteed" or "cure" that get posts flagged and ads rejected. |

## Use it

**In the browser**

```bash
npm start            # serves the app at http://localhost:5173
```

No install step and no dependencies. Node 18+ is only needed for the dev server and CLI. To host it for your team, enable GitHub Pages (Settings → Pages → Source: **GitHub Actions**). The included workflow deploys every push to `main`.

**From the command line**

```bash
node cli/scrollstop.js score post.txt                       # score on every channel
node cli/scrollstop.js score post.txt --platform linkedin   # one channel, with every check
node cli/scrollstop.js fix post.txt --platform linkedin     # apply all automatic fixes
node cli/scrollstop.js adapt post.txt --platform x --campaign spring-launch
node cli/scrollstop.js adapt post.txt --platform email
node cli/scrollstop.js hooks --topic "TikTok ads" --audience "DTC brands" --outcome "cut your CPA"
cat post.txt | node cli/scrollstop.js score --json          # pipe-friendly JSON for automations
```

Run `npm link` once to get a global `scrollstop` command.

**As a library**

```js
import { reviewAll, adapt, applyFix, generateHooks } from './src/core/index.js';

const scores = reviewAll(draft, { utm: { campaign: 'spring-launch' } });
scores.linkedin.score;            // 0–100
scores.linkedin.checks;           // [{ id, label, status, message, fix? }]
adapt(draft, 'x').posts;          // thread-ready posts
applyFix('remove-weak-opener', draft);
```

The engine is plain ES modules with no DOM access, so it runs in browsers, Node, Deno, edge functions, Zapier/Make code steps, or a Slack bot.

## How the score works

Each channel's score is a weighted average of checks run on the version Scrollstop would actually post there:

| Check | Weight | What it looks at |
|---|---|---|
| Hook strength | 25 | First line: length, specificity, "you", curiosity, pattern interrupt, weak openers, hedging, jargon |
| Above the fold | 10 | Does the hook land before "see more"? (LinkedIn ~210, Instagram ~125, TikTok ~90, Facebook ~240) |
| Length | 10 | Hard limit and the channel's sweet spot |
| Readability | 10 | Flesch-Kincaid grade level and sentence length |
| Easy to skim | 10 | Paragraph length on single-post channels |
| Call to action | 10 | A closing question, a clear ask, or a pointer to the link |
| Hashtags | 5 | Count against the channel's norm |
| Links | 5 | Link placement for the channel |
| Clarity | 5 | Jargon, filler words, hedges |
| Emoji | 5 | Density, when emoji are present |
| Disclosure and claims | 5–15 | FTC disclosure and risky claims (weighs more when it fails) |

Checks marked **Handled** are changes the adapter already made for you, such as moving a link to the first comment. A post over a hard limit is capped at 40.

Platform rules live in [`src/core/platforms.js`](src/core/platforms.js), and the word lists (weak openers, jargon swaps, CTA phrases, disclosure triggers) live in [`src/core/lexicon.js`](src/core/lexicon.js). Edit those two files to match your brand voice or a platform change.

> Limits, folds, hashtag norms and best times are 2026 industry benchmarks, and platforms change them often. Treat the score as a strong second opinion, and test against your own analytics.

## Project layout

```
index.html              the web app
src/ui/                 app.js (UI) and styles.css
src/core/               the engine: no DOM, no dependencies
  platforms.js          per-channel limits, folds, norms, best times
  text.js               graphemes, sentences, readability, X weighted length
  lexicon.js            tunable word lists
  analyze.js            scoring
  fixes.js              one-click rewrites
  adapt.js              per-channel formatting, video script, email
  thread.js             limit-aware thread splitter
  hooks.js              Hook Lab formulas and frameworks
  utm.js, export.js     link tagging; ICS / CSV / Markdown export
cli/scrollstop.js       command-line interface
test/                   node:test suite (npm test)
```

## Development

```bash
npm test     # 50+ tests, including property tests that threads never exceed limits or drop words
npm start
```
