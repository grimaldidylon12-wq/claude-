#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { PLATFORM_IDS, review, reviewAll, adapt, adaptEmail, applyFix, generateHooks } from '../src/core/index.js';

const HELP = `Scrollstop: score, fix and adapt social posts from the command line.

Usage
  scrollstop score [file]   Score a post on every channel (or --platform x)
  scrollstop fix   [file]   Apply every automatic fix for --platform (default linkedin)
  scrollstop adapt [file]   Print the native version for --platform (or email)
  scrollstop hooks          Write ranked hooks (--topic, --audience, --outcome)

Options
  --platform <id>   ${PLATFORM_IDS.join(', ')}, email, or all
  --campaign <name> Tag every link with UTM codes for its channel
  --topic --audience --outcome --n --time   Hook Lab inputs
  --limit <n>       Number of hooks to print (default 10)
  --json            Machine-readable output

Reads the post from [file], or from stdin when no file is given.
Example: echo "Stop posting links on LinkedIn." | scrollstop score --platform linkedin`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { bold: paint(1), dim: paint(2), red: paint(31), green: paint(32), yellow: paint(33), blue: paint(34) };
const tone = (score) => (score >= 80 ? c.green : score >= 55 ? c.yellow : c.red);
const STATUS = { fail: c.red('FIX    '), warn: c.yellow('IMPROVE'), pass: c.green('GOOD   '), auto: c.blue('DONE   ') };

function readInput(file) {
  try {
    if (file && file !== '-') return readFileSync(file, 'utf8');
    if (process.stdin.isTTY) return '';
    return readFileSync(0, 'utf8');
  } catch (err) {
    console.error(`Couldn't read ${file || 'stdin'}: ${err.message}`);
    process.exit(2);
  }
}

function requireText(text) {
  if (!text.trim()) {
    console.error('No post text. Pass a file or pipe text in. Run `scrollstop help` for usage.');
    process.exit(2);
  }
}

function printReview(r) {
  console.log(`\n${c.bold(r.name)}  ${tone(r.score)(c.bold(String(r.score)))}/100  grade ${r.grade}`);
  if (r.checks) {
    for (const ch of r.checks) {
      console.log(`  ${STATUS[ch.status]}  ${c.bold(ch.label)}: ${ch.message}${ch.fix ? c.dim(`  [fix: ${ch.fix.id}]`) : ''}`);
    }
  } else if (r.subjects) {
    for (const s of r.subjects) console.log(`  ${tone(s.score)(String(s.score).padStart(3))}  ${s.text}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd = 'help', file] = args._;
  const utm = args.campaign ? { campaign: String(args.campaign) } : undefined;
  const platform = String(args.platform || (cmd === 'score' ? 'all' : 'linkedin'));
  const known = [...PLATFORM_IDS, 'email', 'all'];
  if (!known.includes(platform)) {
    console.error(`Unknown platform "${platform}". Use one of: ${known.join(', ')}`);
    process.exit(2);
  }

  if (cmd === 'score') {
    const text = readInput(file);
    requireText(text);
    const all = reviewAll(text, { utm });
    const picked = platform === 'all' ? all : { [platform]: all[platform] };
    if (args.json) {
      console.log(JSON.stringify(picked, null, 2));
      return;
    }
    for (const r of Object.values(picked)) printReview(r);
    if (platform === 'all') {
      const avg = Math.round(PLATFORM_IDS.reduce((a, id) => a + all[id].score, 0) / PLATFORM_IDS.length);
      console.log(`\n${c.dim('Average across social channels:')} ${tone(avg)(c.bold(String(avg)))}`);
    }
    return;
  }

  if (cmd === 'fix') {
    if (platform === 'all' || platform === 'email') {
      console.error('Pick one social platform for fixes, e.g. --platform linkedin');
      process.exit(2);
    }
    let text = readInput(file);
    requireText(text);
    const before = review(text, platform, { utm }).score;
    const applied = [];
    // Fixes can unlock others (e.g. a cut opener reveals jargon), so loop.
    for (let round = 0; round < 4; round++) {
      const ids = [...new Set(review(text, platform, { utm }).checks.filter((x) => x.fix).map((x) => x.fix.id))].filter((id) => !applied.includes(id));
      if (!ids.length) break;
      for (const id of ids) {
        text = applyFix(id, text, platform);
        applied.push(id);
      }
    }
    const after = review(text, platform, { utm }).score;
    if (args.json) {
      console.log(JSON.stringify({ platform, before, after, applied, text }, null, 2));
      return;
    }
    console.log(text);
    console.error(c.dim(`\n${platform}: ${before} → ${after}. Applied: ${applied.join(', ') || 'nothing'}`));
    return;
  }

  if (cmd === 'adapt') {
    const text = readInput(file);
    requireText(text);
    if (platform === 'all') {
      console.error('Pick one platform to adapt for, e.g. --platform x');
      process.exit(2);
    }
    const a = platform === 'email' ? adaptEmail(text, { utm }) : adapt(text, platform, { utm });
    if (args.json) {
      console.log(JSON.stringify(a, null, 2));
      return;
    }
    if (platform === 'email') {
      console.log(`${c.bold('Subject lines')}\n${a.subjects.map((s) => `  ${s}`).join('\n')}\n\n${c.bold('Preheader')}\n  ${a.preheader}\n\n${c.bold('Body')}\n${a.body}`);
      return;
    }
    a.posts.forEach((p, i) => console.log(`${a.posts.length > 1 ? c.dim(`--- post ${i + 1}/${a.posts.length}\n`) : ''}${p}\n`));
    if (a.firstComment) console.log(`${c.bold('First comment:')} ${a.firstComment}\n`);
    if (a.bioLink) console.log(`${c.bold('Link in bio:')} ${a.bioLink}\n`);
    if (a.script) {
      console.log(c.bold(`Video script (${a.script.duration}s)`));
      for (const b of a.script.beats) console.log(`  ${c.dim(`${b.start}-${b.end}s`.padEnd(11))} ${b.label.padEnd(8)} ${b.line}`);
    }
    for (const n of a.notes) console.error(c.blue(`· ${n.text}`));
    return;
  }

  if (cmd === 'hooks') {
    const list = generateHooks({ topic: args.topic, audience: args.audience, outcome: args.outcome, n: args.n, time: args.time });
    const limit = Number(args.limit) || 10;
    if (args.json) {
      console.log(JSON.stringify(list.slice(0, limit), null, 2));
      return;
    }
    for (const h of list.slice(0, limit)) console.log(`${tone(h.score)(String(h.score).padStart(3))}  ${h.text}  ${c.dim(h.category)}`);
    return;
  }

  console.log(HELP);
  if (!['help', '--help', '-h'].includes(cmd)) process.exitCode = 2;
}

main();
