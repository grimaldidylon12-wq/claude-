// Word lists that drive scoring and fixes. Kept as data so teams can tune
// them to their own brand voice.

// Openers that burn the most valuable line of the post.
export const WEAK_OPENERS = [
  "i'm excited to announce",
  'i am excited to announce',
  "i'm thrilled to announce",
  'i am thrilled to announce',
  "i'm happy to announce",
  "i'm pleased to announce",
  "we're excited to announce",
  'we are excited to announce',
  "we're thrilled to announce",
  'we are thrilled to announce',
  "we're pleased to announce",
  'we are pleased to announce',
  "we're happy to announce",
  "i'm excited to share",
  "i'm thrilled to share",
  "i'm happy to share",
  'i am happy to share',
  "we're excited to share",
  'excited to announce',
  'excited to share',
  'thrilled to announce',
  'thrilled to share',
  'happy to share',
  'proud to announce',
  'just wanted to share',
  'i just wanted to',
  'i wanted to share',
  'hey guys',
  'hi everyone',
  'hello everyone',
  'hey everyone',
  'hi all',
  'happy monday',
  'happy friday',
  "in today's world",
  'in today’s world',
  "in today's fast-paced world",
  'in this day and age',
  'as we all know',
  'it goes without saying',
  'needless to say',
  'check out',
  'click here',
  'new blog post',
  'new post',
  'link below',
  'so,',
];

// Phrases that open a curiosity gap or promise a payoff.
export const CURIOSITY = [
  "here's",
  'here is',
  'here’s',
  'why',
  'how',
  'secret',
  'nobody',
  'no one',
  'most people',
  'the truth',
  'the real reason',
  'what happens',
  'what i learned',
  'i was wrong',
  'turns out',
  'the one thing',
  'this is why',
  'this is how',
  'steal',
  'framework',
  'playbook',
  'lessons',
  'mistake',
  'mistakes',
  'behind the scenes',
  'what nobody tells you',
];

// Pattern interrupts: contrarian or direct-address openers.
export const CONTRARIAN = [
  'unpopular opinion',
  'hot take',
  'stop',
  "don't",
  'do not',
  'never',
  'forget',
  'myth',
  'overrated',
  'is dead',
  'is a lie',
  'wrong',
  'quit',
  'avoid',
];

// Emotionally loaded words that lift attention when used sparingly.
export const POWER_WORDS = [
  'proven', 'instantly', 'effortless', 'surprising', 'shocking', 'brutal', 'simple',
  'easy', 'fast', 'free', 'new', 'now', 'finally', 'exactly', 'massive', 'tiny',
  'powerful', 'hidden', 'exclusive', 'limited', 'unexpected', 'honest', 'ultimate',
  'crazy', 'insane', 'genius', 'painful', 'costly', 'expensive', 'wasted', 'save',
  'double', 'triple', 'grow', 'boost', 'unlock', 'avoid', 'fail', 'failed', 'win',
  'won', 'lost', 'broke', 'quit', 'fired', 'hired', 'doubled', 'tripled', 'zero',
  'every', 'never', 'always', 'mistake', 'secret', 'truth', 'lesson',
];

// Corporate-speak with plain-English swaps.
export const JARGON = {
  synergy: 'teamwork',
  synergies: 'shared wins',
  leverage: 'use',
  leveraging: 'using',
  utilize: 'use',
  utilizing: 'using',
  utilization: 'use',
  'best-in-class': 'top',
  'world-class': 'excellent',
  'cutting-edge': 'new',
  'game-changer': 'big shift',
  'game-changing': 'big',
  'thought leader': 'expert',
  'thought leadership': 'expertise',
  'move the needle': 'make a difference',
  'moves the needle': 'makes a difference',
  'moved the needle': 'made a difference',
  'circle back': 'follow up',
  'low-hanging fruit': 'quick wins',
  'deep dive': 'close look',
  'paradigm shift': 'big change',
  'value-add': 'benefit',
  'robust': 'strong',
  'seamless': 'smooth',
  'seamlessly': 'smoothly',
  'holistic': 'complete',
  'empower': 'help',
  'empowering': 'helping',
  'innovative solution': 'new tool',
  'innovative solutions': 'new tools',
  'solutioning': 'solving',
  'ideate': 'brainstorm',
  'bandwidth': 'time',
  'actionable insights': 'clear takeaways',
  'at the end of the day': 'ultimately',
  'in order to': 'to',
  'going forward': 'from now on',
  'touch base': 'check in',
  'disruptive': 'bold',
};

export const FILLERS = [
  'very', 'really', 'just', 'actually', 'basically', 'literally', 'totally',
  'simply', 'quite', 'truly', 'definitely', 'honestly',
];

export const HEDGES = [
  'i think', 'i believe', 'i feel like', 'maybe', 'perhaps', 'kind of', 'sort of',
  'in my humble opinion', 'imho', 'i guess', 'might be', 'could be',
];

// Calls to action. A post that ends in a question also counts.
export const CTA_PHRASES = [
  'comment', 'reply', 'repost', 'retweet', 'share this', 'share it', 'save this',
  'save it', 'bookmark', 'follow', 'subscribe', 'sign up', 'signup', 'register',
  'join', 'download', 'grab', 'get yours', 'get the', 'try it', 'try this',
  'learn more', 'read more', 'click', 'tap', 'link in bio', 'link in the comments',
  'link in comments', 'first comment', 'dm me', 'dm us', 'send me', 'tag a',
  'tag someone', 'let me know', 'tell me', 'drop a', 'vote', 'book a', 'shop',
  'order', 'claim', 'watch', 'listen', 'agree?', 'thoughts?',
];

// Content that signals a paid relationship and needs a clear disclosure.
export const DISCLOSURE_TRIGGERS = [
  'sponsored', 'paid partnership', 'in partnership with', 'partnered with',
  'affiliate', 'use my code', 'use code', 'my code', 'discount code', 'promo code',
  'gifted', 'sent me', 'commission', 'brand ambassador', 'ambassador for',
];

export const DISCLOSURE_TAGS = ['#ad', '#sponsored', '#paidpartnership', 'paid partnership', '#partner', 'ad:', '#affiliate', 'affiliate link'];

// Claims that get ads rejected, posts flagged, or brands sued.
export const RISKY_CLAIMS = [
  'guaranteed', 'guarantee', '100% guaranteed', 'risk-free', 'risk free',
  'cure', 'cures', 'miracle', 'get rich', 'overnight success', 'make money fast',
  'lose weight fast', 'no side effects', 'clinically proven', 'doctor recommended',
  'fda approved', 'best in the world', '#1 in the world', 'scientifically proven',
  'never fails', 'instant results',
];

// Default CTAs by platform, used by the "Add a CTA" fix and the adapters.
export const DEFAULT_CTAS = {
  x: 'Agree or disagree? Reply below.',
  linkedin: "What's your take? Tell me in the comments.",
  instagram: 'Save this for later and share it with someone who needs it.',
  tiktok: 'Follow for part 2.',
  threads: 'What would you add?',
  bluesky: 'What would you add?',
  facebook: 'What do you think? Let us know below.',
};
