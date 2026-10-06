import {
  PLATFORMS, PLATFORM_IDS, EMAIL, lengthFor, reviewAll, applyFix, FIXES, HOOK_FORMULAS, FRAMEWORKS,
  generateHooks, fillFramework, buildUtmUrl, planSchedule, toICS, toCSV, toMarkdown, formatDate, formatTime, text as T,
} from '../core/index.js';

const EXAMPLE = `I'm excited to announce that we just published our new guide on email marketing! In today's world, inboxes are crowded and it's really hard to stand out, so we decided to leverage our data from 2,400 campaigns to find what actually moves the needle. The biggest surprise was that subject lines under 40 characters got 21% more opens than longer ones, and sending on Tuesday mornings beat every other slot. We also found that plain-text emails outperformed heavily designed templates for B2B audiences.

Read the full guide here: https://example.com/email-guide

#emailmarketing #marketing #b2b #growth #contentmarketing #digitalmarketing #marketingtips`;

const CHANNELS = [...PLATFORM_IDS, 'email'];
const STORE_KEY = 'scrollstop:v1';
const VIEWS = ['studio', 'hooks', 'planner', 'links'];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n).toLocaleString('en-US');
const toneOf = (score) => (score >= 80 ? 'tone-good' : score >= 55 ? 'tone-warn' : 'tone-bad');
const specOf = (id) => (id === 'email' ? EMAIL : PLATFORMS[id]);

let framed = true;
try {
  framed = window.self !== window.top;
} catch {
  framed = true;
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

function defaults() {
  return {
    draft: EXAMPLE,
    isExample: true,
    campaign: 'email-guide',
    platform: 'linkedin',
    view: 'studio',
    hooks: { topic: 'email marketing', audience: 'founders', outcome: 'double your open rates', n: 7, time: '30 days' },
    filter: 'All',
    planner: { start: tomorrow(), stagger: '0', channels: [...CHANNELS] },
    utm: { url: 'https://example.com/email-guide', content: '', custom: '' },
  };
}

function load() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!saved) return base;
    const s = { ...base, ...saved, hooks: { ...base.hooks, ...saved.hooks }, planner: { ...base.planner, ...saved.planner }, utm: { ...base.utm, ...saved.utm } };
    if (!CHANNELS.includes(s.platform)) s.platform = 'linkedin';
    if (!VIEWS.includes(s.view)) s.view = 'studio';
    if (!s.planner.start || s.planner.start < formatDate(new Date())) s.planner.start = tomorrow();
    return s;
  } catch {
    return base;
  }
}

const state = load();
let reviews = {};
const undoStack = [];
let expanded = new Set();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the app still works for this visit */
  }
}

// ---------- Clipboard, download, toast ----------

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    toast(ok ? 'Copied' : 'Copy blocked here. Select the text and copy it yourself.');
  }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let toastTimer;
function toast(message, { undo = false } = {}) {
  $('#toast-text').textContent = message;
  $('#toast-undo').hidden = !undo;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), undo ? 6000 : 2200);
}

function setDraft(next, message) {
  undoStack.push({ draft: state.draft, isExample: state.isExample });
  if (undoStack.length > 50) undoStack.shift();
  state.draft = next;
  $('#draft').value = next;
  renderStudio();
  if (message) toast(message, { undo: true });
}

$('#toast-undo').addEventListener('click', () => {
  const prev = undoStack.pop();
  if (!prev) return;
  state.draft = prev.draft;
  state.isExample = prev.isExample;
  $('#draft').value = prev.draft;
  renderStudio();
  toast('Undone');
});

// ---------- Rich text for previews ----------

const INLINE_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])|((?<![\p{L}\p{N}_&/])#[\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)|((?<![\p{L}\p{N}_.])@[A-Za-z0-9_.]{2,30})/gu;

function inline(s) {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    out += esc(s.slice(last, m.index));
    out += `<span class="${m[1] ? 'url' : 'tag'}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}

function rich(text, markHook) {
  let marked = !markHook;
  return text
    .split('\n')
    .map((line) => {
      const html = inline(line);
      if (!marked && line.trim()) {
        marked = true;
        return `<mark>${html}</mark>`;
      }
      return html;
    })
    .join('\n');
}

// ---------- Studio ----------

function renderRail() {
  $('#rail').innerHTML = CHANNELS.map((id) => {
    const r = reviews[id];
    const tone = toneOf(r.score);
    return `<button class="chip" type="button" data-platform="${id}" aria-pressed="${id === state.platform}" title="${esc(r.name)}: ${r.score} out of 100">
      <span class="chip-top"><span class="chip-name">${esc(r.name)}</span><span class="chip-score ${tone}">${r.score}</span></span>
      <span class="meter ${tone}"><i style="width:${r.score}%"></i></span>
    </button>`;
  }).join('');
}

function renderMeta() {
  const t = state.draft;
  const ws = T.words(t).length;
  const r = T.readability(t);
  const secs = Math.max(0, Math.round((ws / 238) * 60));
  $('#draft-meta').innerHTML = t.trim()
    ? `<span>${fmt(T.charCount(t))} characters</span><span>${fmt(ws)} words</span><span>${secs} sec read</span><span>grade ${r.gradeLevel}</span>`
    : '<span>Empty draft</span>';
  $('#example-flag').hidden = !state.isExample;
}

function scoreHead(r, summary, fixIds = []) {
  const tone = toneOf(r.score);
  return `<div class="score-head">
    <div class="big-score ${tone}">${r.score}<small>/100</small></div>
    <div class="score-text"><span class="eyebrow">Scroll-stop score</span><h2>${esc(r.name)}</h2><span class="muted" style="font-size:.85rem">${summary}</span></div>
    ${fixIds.length > 1 ? `<button class="btn primary" type="button" data-fix-all="${fixIds.join(',')}">Fix all (${fixIds.length})</button>` : ''}
    <div class="grade ${tone}" aria-label="Grade ${r.grade}">${r.grade}</div>
  </div>`;
}

function hookBox(label, text, signals) {
  const items = signals.map((s) => `<li class="${s.good ? 'plus' : 'minus'}">${s.good ? '+' : '−'} ${esc(s.text)}</li>`).join('');
  return `<div class="hook-box">
    <span class="eyebrow">${label}</span>
    <div class="hook-line">${text ? `<mark>${esc(text)}</mark>` : '<span class="muted">No hook yet</span>'}</div>
    ${items ? `<ul class="signals">${items}</ul>` : ''}
  </div>`;
}

const PILL = { fail: 'Fix', warn: 'Improve', pass: 'Good', auto: 'Handled' };

function renderReport() {
  const id = state.platform;
  const r = reviews[id];
  const el = $('#report');
  if (!state.draft.trim()) {
    el.innerHTML = '<p class="muted">Write or paste a post above to see how it scores on every channel.</p>';
    return;
  }

  if (id === 'email') {
    const best = r.subjects.reduce((a, b) => (b.score > a.score ? b : a), r.subjects[0] || { text: '', score: 0, signals: [] });
    const pre = r.adapted.preheader || '';
    const rows = [
      { status: best.length <= EMAIL.subject.ideal[1] ? 'pass' : 'warn', label: 'Subject length', msg: `${best.length || 0} characters. ${EMAIL.subject.ideal[0]}–${EMAIL.subject.ideal[1]} shows in full on most phones.` },
      { status: pre && T.charCount(pre) >= EMAIL.preheader.ideal[0] ? 'pass' : 'warn', label: 'Preheader', msg: pre ? `${T.charCount(pre)} characters. The preview text after the subject; ${EMAIL.preheader.ideal[0]}–${EMAIL.preheader.ideal[1]} works best.` : 'Add a second line. Inboxes show it as preview text.' },
    ];
    el.innerHTML =
      scoreHead(r, 'Based on your best subject line') +
      hookBox('Best subject line', best.text, best.signals) +
      `<ul class="checks">${rows.map((c) => `<li class="check"><span class="pill ${c.status}">${PILL[c.status]}</span><div><div class="check-label">${c.label}</div><div class="check-msg">${esc(c.msg)}</div></div><span></span></li>`).join('')}</ul>`;
    return;
  }

  const fixes = [...new Set(r.checks.filter((c) => c.fix).map((c) => c.fix.id))];
  const open = r.checks.filter((c) => c.status === 'fail' || c.status === 'warn').length;
  const auto = r.checks.filter((c) => c.status === 'auto').length;
  const summary = [open ? `${open} thing${open > 1 ? 's' : ''} to improve` : 'Ready to post', auto ? `${auto} handled for you` : ''].filter(Boolean).join(' · ');
  const checks = r.checks
    .map(
      (c) => `<li class="check">
        <span class="pill ${c.status}">${PILL[c.status]}</span>
        <div><div class="check-label">${esc(c.label)}</div><div class="check-msg">${esc(c.message)}</div></div>
        ${c.fix ? `<button class="btn small" type="button" data-fix="${c.fix.id}">${esc(c.fix.label)}</button>` : '<span></span>'}
      </li>`,
    )
    .join('');
  el.innerHTML = scoreHead(r, summary, fixes) + hookBox('Your hook', r.hook.text, r.hook.signals) + `<ul class="checks">${checks}</ul>`;
}

const HANDLE = { x: '@yourbrand', linkedin: 'Head of Marketing', instagram: 'yourbrand', tiktok: '@yourbrand', threads: 'yourbrand', bluesky: '@yourbrand.bsky.social', facebook: 'Page' };

function postCard(p, text, i, total) {
  const len = lengthFor(p, text);
  let body;
  if (p.fold && T.charCount(text) > p.fold) {
    const cut = T.sliceGraphemes(text, p.fold).length;
    body = expanded.has(i)
      ? `${rich(text.slice(0, cut), i === 0)}<span class="fold-mark" title="${p.name} cuts the post here">see more</span>${rich(text.slice(cut), false)} <button class="see-more" type="button" data-collapse="${i}">show less</button>`
      : `${rich(text.slice(0, cut).trimEnd(), i === 0)}<button class="see-more" type="button" data-expand="${i}">…see more</button>`;
  } else {
    body = rich(text, i === 0);
  }
  return `<article class="post">
    <div class="who"><div class="avatar" aria-hidden="true">YB</div><div><div class="who-name">Your Brand</div><div class="who-meta">${esc(HANDLE[p.id])} · just now</div></div></div>
    <div class="post-text">${body}</div>
    <div class="post-foot">
      <span class="mono ${len > p.limit ? 'over' : ''}">${total > 1 ? `${i + 1}/${total} · ` : ''}${fmt(len)} / ${fmt(p.limit)}</span>
      <button class="btn ghost small" type="button" data-copy-post="${i}">Copy</button>
    </div>
  </article>`;
}

function sideCard(title, body, copy) {
  return `<div class="side-card">
    <div class="post-foot"><span class="eyebrow">${title}</span><button class="btn ghost small" type="button" data-copy-text="${esc(copy)}">Copy</button></div>
    <div class="post-text link-out">${esc(body)}</div>
  </div>`;
}

function renderPreview() {
  const id = state.platform;
  const r = reviews[id];
  const a = r.adapted;
  const el = $('#preview');
  $('#preview-title').textContent = `${r.name} preview`;

  if (id === 'email') {
    $('#preview-count').textContent = `${a.subjects.length} subject options`;
    if (!state.draft.trim()) {
      el.innerHTML = '<p class="muted">Your email version will appear here.</p>';
      return;
    }
    el.innerHTML = `<div class="subjects">${r.subjects
      .map(
        (s) => `<div class="subject">
          <span class="subject-score ${toneOf(s.score)}">${s.score}</span>
          <div class="inbox-row"><b>${esc(s.text)}</b><span class="muted" style="font-size:.84rem">${esc(a.preheader)}</span></div>
          <button class="btn ghost small" type="button" data-copy-text="${esc(s.text)}">Copy</button>
        </div>`,
      )
      .join('')}</div>
      ${sideCard('Preheader', a.preheader, a.preheader)}
      <article class="post"><span class="eyebrow">Email body</span><div class="post-text">${rich(a.body, false)}</div></article>`;
    return;
  }

  const p = PLATFORMS[id];
  $('#preview-count').textContent = a.posts.length > 1 ? `${a.posts.length}-post thread` : `${fmt(a.length)} / ${fmt(p.limit)}`;
  if (!a.posts.length) {
    el.innerHTML = `<p class="muted">Your ${esc(p.name)} post will appear here.</p>`;
    return;
  }
  const notes = a.notes.length
    ? `<div style="display:grid;gap:6px"><span class="eyebrow">Adapted for ${esc(p.name)}</span><ul class="notes">${a.notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul></div>`
    : '';
  let extra = '';
  if (a.firstComment) extra += sideCard('First comment', a.firstComment, a.firstComment);
  if (a.bioLink) extra += sideCard('Link in bio', a.bioLink, a.bioLink);
  if (a.script && a.script.beats.length) {
    const rows = a.script.beats
      .map((b) => `<tr><td class="mono">${b.start}–${b.end}s</td><td><b>${esc(b.label)}</b></td><td>${esc(b.line)}</td><td class="muted">${esc(b.onScreen)}</td></tr>`)
      .join('');
    const scriptText = a.script.beats.map((b) => `[${b.start}–${b.end}s] ${b.label}: ${b.line}`).join('\n');
    extra += `<div class="side-card">
      <div class="post-foot"><span class="eyebrow">Video script · ${a.script.duration}s${a.script.duration > 60 ? ' · trim to under 60s for Shorts' : ''}</span><button class="btn ghost small" type="button" data-copy-text="${esc(scriptText)}">Copy</button></div>
      <div class="scroll-x"><table><thead><tr><th>Time</th><th>Beat</th><th>Say</th><th>On screen</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted" style="font-size:.78rem">Works for TikTok, Instagram Reels and YouTube Shorts. Timed at a natural 150 words per minute.</p>
    </div>`;
  }
  el.innerHTML = `${notes}<div class="feed ${a.posts.length > 1 ? 'thread' : ''}">${a.posts.map((t, i) => postCard(p, t, i, a.posts.length)).join('')}</div>${extra}`;
}

function renderStudio() {
  reviews = reviewAll(state.draft, { utm: { campaign: state.campaign } });
  renderRail();
  renderMeta();
  renderReport();
  renderPreview();
  save();
}

let inputTimer;
$('#draft').addEventListener('input', (e) => {
  state.draft = e.target.value;
  state.isExample = false;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(renderStudio, 90);
});

$('#campaign').addEventListener('input', (e) => {
  state.campaign = e.target.value;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(renderStudio, 150);
});

$('#rail').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-platform]');
  if (!chip) return;
  state.platform = chip.dataset.platform;
  expanded = new Set();
  renderStudio();
});

$('#load-example').addEventListener('click', () => {
  setDraft(EXAMPLE, 'Example loaded');
  state.isExample = true;
  renderMeta();
  save();
});

$('#clear-draft').addEventListener('click', () => {
  setDraft('', 'Draft cleared');
  state.isExample = false;
  renderMeta();
  $('#draft').focus();
});

$('#report').addEventListener('click', (e) => {
  const one = e.target.closest('[data-fix]');
  const all = e.target.closest('[data-fix-all]');
  if (!one && !all) return;
  const ids = one ? [one.dataset.fix] : all.dataset.fixAll.split(',');
  const next = ids.reduce((t, id) => applyFix(id, t, state.platform), state.draft);
  if (next === state.draft) {
    toast('Nothing to change automatically. Edit this one by hand.');
    return;
  }
  setDraft(next, ids.length > 1 ? `Applied ${ids.length} fixes` : `Applied: ${FIXES[ids[0]].label}`);
});

$('#preview').addEventListener('click', (e) => {
  const t = e.target;
  const r = reviews[state.platform];
  if (t.closest('[data-expand]')) {
    expanded.add(Number(t.closest('[data-expand]').dataset.expand));
    renderPreview();
  } else if (t.closest('[data-collapse]')) {
    expanded.delete(Number(t.closest('[data-collapse]').dataset.collapse));
    renderPreview();
  } else if (t.closest('[data-copy-post]')) {
    copyText(r.adapted.posts[Number(t.closest('[data-copy-post]').dataset.copyPost)]);
  } else if (t.closest('[data-copy-text]')) {
    copyText(t.closest('[data-copy-text]').dataset.copyText);
  }
});

$('#copy-all').addEventListener('click', () => {
  const r = reviews[state.platform];
  if (state.platform === 'email') {
    const a = r.adapted;
    copyText(`Subject: ${a.subjects[0] || ''}\nPreheader: ${a.preheader}\n\n${a.body}`);
  } else {
    copyText(r.adapted.posts.join('\n\n———\n\n'));
  }
});

// ---------- Hook Lab ----------

const HOOK_FIELDS = { topic: '#h-topic', audience: '#h-audience', outcome: '#h-outcome', n: '#h-n', time: '#h-time' };
let hooks = [];

function renderHooks() {
  hooks = generateHooks(state.hooks);
  const cats = ['All', ...new Set(HOOK_FORMULAS.map(([c]) => c))];
  $('#hook-filters').innerHTML = cats
    .map((c) => `<button class="filter" type="button" data-filter="${esc(c)}" aria-pressed="${c === state.filter}">${esc(c)}</button>`)
    .join('');
  const shown = hooks.filter((h) => state.filter === 'All' || h.category === state.filter);
  $('#hooks-title').textContent = `${shown.length} hooks, best first`;
  $('#hook-list').innerHTML = shown
    .map(
      (h, i) => `<li class="hook-item">
        <span class="hook-score ${toneOf(h.score)}">${h.score}</span>
        <div style="min-width:0"><div class="eyebrow">${esc(h.category)}</div><div class="hook-text">${esc(h.text)}</div></div>
        <div class="hook-actions">
          <button class="btn small" type="button" data-use-hook="${i}">Use in draft</button>
          <button class="btn ghost small" type="button" data-copy-hook="${i}">Copy</button>
        </div>
      </li>`,
    )
    .join('');
  $('#hook-list').dataset.filter = state.filter;
  $('#frameworks').innerHTML = Object.entries(FRAMEWORKS)
    .map(
      ([id, f]) => `<div class="framework"><b>${esc(id)}</b><span class="muted" style="font-size:.8rem">${esc(f.name)}</span><button class="btn small" type="button" data-framework="${id}">Start from this</button></div>`,
    )
    .join('');
}

function shownHooks() {
  return hooks.filter((h) => state.filter === 'All' || h.category === state.filter);
}

for (const [key, sel] of Object.entries(HOOK_FIELDS)) {
  $(sel).value = state.hooks[key] ?? '';
  $(sel).addEventListener('input', (e) => {
    state.hooks[key] = e.target.value;
    renderHooks();
    save();
  });
}

$('#hook-form').addEventListener('submit', (e) => {
  e.preventDefault();
  renderHooks();
  toast(`${hooks.length} hooks written`);
});

$('#hook-filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  state.filter = b.dataset.filter;
  renderHooks();
  save();
});

$('#hook-list').addEventListener('click', (e) => {
  const use = e.target.closest('[data-use-hook]');
  const copy = e.target.closest('[data-copy-hook]');
  if (copy) copyText(shownHooks()[Number(copy.dataset.copyHook)].text);
  if (!use) return;
  const hook = shownHooks()[Number(use.dataset.useHook)].text;
  const draft = state.isExample ? '' : state.draft;
  const nl = draft.indexOf('\n');
  const next = draft.trim() ? hook + (nl < 0 ? '\n\n' : draft.slice(nl)) : `${hook}\n\n`;
  state.isExample = false;
  showView('studio');
  setDraft(next, draft.trim() ? 'Hook swapped into your draft' : 'Hook added. Write the rest below it.');
  $('#draft').focus();
});

$('#frameworks').addEventListener('click', (e) => {
  const b = e.target.closest('[data-framework]');
  if (!b) return;
  state.isExample = false;
  showView('studio');
  setDraft(fillFramework(b.dataset.framework, state.hooks), `${b.dataset.framework} framework added. Fill in the brackets.`);
  $('#draft').focus();
});

// ---------- Planner ----------

let plan = [];

function planItems() {
  return state.planner.channels
    .filter((id) => CHANNELS.includes(id))
    .map((id) => {
      const a = reviews[id].adapted;
      if (id === 'email') return { platform: 'email', subjects: a.subjects, preheader: a.preheader, body: a.body };
      return { platform: id, posts: a.posts, firstComment: a.firstComment, bioLink: a.bioLink };
    })
    .filter((item) => (item.platform === 'email' ? item.body : item.posts.length));
}

function renderPlanner() {
  $('#p-start').value = state.planner.start;
  $('#p-stagger').value = state.planner.stagger;
  $('#p-channels').innerHTML = CHANNELS.map(
    (id) => `<label><input type="checkbox" id="ch-${id}" data-channel="${id}" ${state.planner.channels.includes(id) ? 'checked' : ''}> ${esc(specOf(id).name)}</label>`,
  ).join('');

  const [y, m, d] = state.planner.start.split('-').map(Number);
  let start = new Date(y, m - 1, d);
  if (start < new Date()) start = new Date();
  plan = planSchedule(planItems(), { start, stagger: Number(state.planner.stagger) });

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  $('#plan-table').innerHTML = plan.length
    ? `<thead><tr><th>When</th><th>Channel</th><th>What goes out</th><th>Parts</th></tr></thead><tbody>${plan
        .map((item) => {
          const first = item.platform === 'email' ? `Subject: ${item.subjects[0] || ''}` : T.hookOf(item.posts[0]).replace(/ \d+\/\d+$/, '');
          const parts = item.platform === 'email' ? 'Email' : [item.posts.length > 1 ? `${item.posts.length} posts` : '1 post', item.firstComment ? '+ comment' : '', item.bioLink ? '+ bio link' : ''].filter(Boolean).join(' ');
          return `<tr><td class="mono">${days[item.at.getDay()]} ${formatDate(item.at)}<br>${formatTime(item.at)}</td><td><b>${esc(specOf(item.platform).name)}</b></td><td>${esc(first)}</td><td class="muted">${esc(parts)}</td></tr>`;
        })
        .join('')}</tbody>`
    : '<tbody><tr><td class="muted">Write a draft in the Studio and pick at least one channel to build a plan.</td></tr></tbody>';
}

$('#p-start').addEventListener('change', (e) => {
  state.planner.start = e.target.value || tomorrow();
  renderPlanner();
  save();
});

$('#p-stagger').addEventListener('change', (e) => {
  state.planner.stagger = e.target.value;
  renderPlanner();
  save();
});

$('#p-channels').addEventListener('change', (e) => {
  const id = e.target.dataset.channel;
  if (!id) return;
  const set = new Set(state.planner.channels);
  if (e.target.checked) set.add(id);
  else set.delete(id);
  state.planner.channels = CHANNELS.filter((c) => set.has(c));
  renderPlanner();
  save();
});

const EXPORTS = {
  ics: { label: 'Calendar file', file: 'scrollstop-plan.ics', type: 'text/calendar', hint: 'Import into Google Calendar, Outlook or Apple Calendar. Each post becomes an event with a 10-minute reminder and the copy ready to paste.', make: () => toICS(plan, { campaign: state.campaign }) },
  csv: { label: 'Spreadsheet', file: 'scrollstop-plan.csv', type: 'text/csv', hint: 'Opens in Excel or Google Sheets, with one row per post. Map the columns into your scheduler’s bulk upload.', make: () => toCSV(plan) },
  md: { label: 'Content brief', file: 'scrollstop-plan.md', type: 'text/markdown', hint: 'Paste into Notion, Google Docs or Slack to get sign-off before anything goes live.', make: () => toMarkdown(plan, { campaign: state.campaign }) },
};
let currentExport = null;

document.querySelectorAll('[data-export]').forEach((b) =>
  b.addEventListener('click', () => {
    if (!plan.length) {
      toast('Nothing to export yet. Write a draft and pick a channel.');
      return;
    }
    currentExport = EXPORTS[b.dataset.export];
    $('#export-box').hidden = false;
    $('#export-label').textContent = currentExport.label;
    $('#export-output').value = currentExport.make();
    $('#export-hint').textContent = framed ? `${currentExport.hint} Copy the text and save it as ${currentExport.file}.` : currentExport.hint;
    $('#export-download').hidden = framed;
  }),
);

$('#export-copy').addEventListener('click', () => copyText($('#export-output').value));
$('#export-download').addEventListener('click', () => currentExport && download(currentExport.file, $('#export-output').value, currentExport.type));

// ---------- Link tagger ----------

const UTM_FIELDS = { url: '#u-url', content: '#u-content', custom: '#u-custom' };

function renderLinks() {
  $('#u-campaign').value = state.campaign;
  const { url, content, custom } = state.utm;
  const rows = [
    ...PLATFORM_IDS.map((id) => ({ name: PLATFORMS[id].name, source: PLATFORMS[id].utmSource, medium: 'social' })),
    { name: 'Email', source: EMAIL.utmSource, medium: 'email' },
  ];
  if (custom.trim()) rows.push({ name: custom.trim(), source: custom.trim(), medium: 'referral' });
  let valid = true;
  try {
    new URL(url);
  } catch {
    valid = false;
  }
  if (!valid || !state.campaign.trim()) {
    $('#utm-table').innerHTML = `<tbody><tr><td class="muted">${!valid ? 'Enter a full link starting with https://' : 'Add a campaign name to build tracking links.'}</td></tr></tbody>`;
    return;
  }
  $('#utm-table').innerHTML = `<thead><tr><th>Channel</th><th>Tracking link</th><th></th></tr></thead><tbody>${rows
    .map((r) => {
      const link = buildUtmUrl(url, { source: r.source, medium: r.medium, campaign: state.campaign, content });
      return `<tr><td><b>${esc(r.name)}</b></td><td class="link-out">${esc(link)}</td><td><button class="btn ghost small" type="button" data-copy-text="${esc(link)}">Copy</button></td></tr>`;
    })
    .join('')}</tbody>`;
}

for (const [key, sel] of Object.entries(UTM_FIELDS)) {
  $(sel).value = state.utm[key] ?? '';
  $(sel).addEventListener('input', (e) => {
    state.utm[key] = e.target.value;
    renderLinks();
    save();
  });
}

$('#u-campaign').addEventListener('input', (e) => {
  state.campaign = e.target.value;
  $('#campaign').value = state.campaign;
  renderLinks();
  save();
});

$('#utm-form').addEventListener('submit', (e) => e.preventDefault());

$('#utm-table').addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy-text]');
  if (b) copyText(b.dataset.copyText);
});

// ---------- Views ----------

function showView(view) {
  state.view = VIEWS.includes(view) ? view : 'studio';
  for (const v of VIEWS) {
    $(`#view-${v}`).hidden = v !== state.view;
    $(`#tab-${v}`).setAttribute('aria-selected', String(v === state.view));
  }
  if (state.view === 'planner') {
    renderStudio();
    renderPlanner();
  }
  if (state.view === 'links') renderLinks();
  if (state.view === 'hooks') renderHooks();
  try {
    history.replaceState(null, '', `#${state.view}`);
  } catch {
    /* some frames block history changes */
  }
  save();
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-view]');
  if (tab) showView(tab.dataset.view);
});

// ---------- Boot ----------

$('#draft').value = state.draft;
$('#campaign').value = state.campaign;
renderStudio();
renderHooks();
const fromHash = location.hash.replace('#', '');
showView(VIEWS.includes(fromHash) ? fromHash : state.view);
