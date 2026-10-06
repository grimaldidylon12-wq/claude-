import { URL_RE } from './text.js';

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'];

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Adds utm_* params to a URL. Existing params win unless overwrite is set, so
// links someone already tagged by hand are left alone.
export function buildUtmUrl(url, params, { overwrite = false } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  for (const key of UTM_KEYS) {
    const value = params[key];
    if (!value) continue;
    const name = 'utm_' + key;
    if (overwrite || !u.searchParams.has(name)) u.searchParams.set(name, slugify(value));
  }
  return u.toString();
}

export function tagLinks(text, params, opts) {
  if (!params || !params.campaign) return text;
  return text.replace(URL_RE, (url) => buildUtmUrl(url, params, opts));
}

export function parseUtm(url) {
  try {
    const u = new URL(url);
    const out = {};
    for (const key of UTM_KEYS) {
      const v = u.searchParams.get('utm_' + key);
      if (v) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}
