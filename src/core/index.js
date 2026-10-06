// Public API of the Scrollstop engine.
export { PLATFORMS, PLATFORM_IDS, EMAIL, getPlatform, lengthFor } from './platforms.js';
export { analyze, review, reviewAll, reviewEmail, scoreHook, measure, gradeOf, findWeakOpener } from './analyze.js';
export { adapt, adaptAll, adaptEmail, videoScript } from './adapt.js';
export { FIXES, applyFix } from './fixes.js';
export { HOOK_FORMULAS, FRAMEWORKS, generateHooks, fillFramework, fillFormula } from './hooks.js';
export { buildUtmUrl, tagLinks, parseUtm, slugify } from './utm.js';
export { planSchedule, nextSlot, toICS, toCSV, toMarkdown, formatDate, formatTime } from './export.js';
export { suggestHashtags } from './hashtags.js';
export { splitThread } from './thread.js';
export * as text from './text.js';
