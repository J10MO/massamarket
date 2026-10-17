// Store categories + the Pinterest boards each one is filled from.
export const CATEGORIES = [
  {
    slug: 'evening',
    name: 'فساتين سهرة',
    description: 'إطلالات فاخرة لحفلاتك ومناسباتك الخاصة',
    color: '#4A1D3F',
    boards: ['lovingmode/evening-dresses', 'flooooour/evening-dress', 'kateklassa/evening-gown'],
  },
  {
    slug: 'engagement',
    name: 'فساتين خطوبة',
    description: 'فساتين ناعمة لأجمل يوم في حياتك',
    color: '#B04A76',
    boards: ['thewhitefiles/engagement-dresses-with-the-white-files', 'imanemani42/engagement-party-dress', 'alaanadeen60/engagement-dress'],
  },
  {
    slug: 'casual',
    name: 'فساتين كاجوال',
    description: 'فساتين يومية مريحة وأنيقة',
    color: '#9A6370',
    boards: ['summerdresses95/summer-dress', 'cornekallis21/casual-summer-dresses', 'thechicpursuit/summer-dress', 'petalandpup/casual-dresses'],
  },
  {
    slug: 'abaya',
    name: 'عبايات',
    description: 'عبايات محتشمة بتصاميم عصرية',
    color: '#6B3A5B',
    boards: ['ferozasujee/abaya', 'muneeraparker/abaya', 'ranafarghali/abaya-board'],
  },
  {
    slug: 'sets',
    name: 'بلوزات وتنانير',
    description: 'تنسيقات متكاملة لكل يوم',
    color: '#8A4F7D',
    boards: ['marykiboye/skirt-and-blouse-outfits', 'jenjenb1983/blouse-and-skirt-style-outfit'],
  },
];

const NAMES = {
  evening: ['فستان سهرة', 'فستان حفلات', 'فستان سواريه', 'فستان ستان', 'فستان ترتر', 'فستان مخمل'],
  engagement: ['فستان خطوبة', 'فستان ملكة', 'فستان دانتيل', 'فستان شيفون', 'فستان تول'],
  casual: ['فستان كاجوال', 'فستان صيفي', 'فستان ميدي', 'فستان ماكسي', 'فستان قطني', 'فستان كتان'],
  abaya: ['عباية', 'عباية كريب', 'عباية مطرزة', 'عباية كلوش', 'عباية بشت'],
  sets: ['طقم بلوزة وتنورة', 'تنورة بليسيه', 'بلوزة حرير', 'طقم ناعم', 'تنورة ميدي'],
};
const ADJ = ['أنيق', 'فاخر', 'ناعم', 'راقي', 'كلاسيكي', 'عصري', 'ملكي', 'ساحر', 'مميز', 'رقيق'];
const ADJ_F = ['أنيقة', 'فاخرة', 'ناعمة', 'راقية', 'كلاسيكية', 'عصرية', 'ملكية', 'ساحرة', 'مميزة', 'رقيقة'];
const isFeminine = (noun) => /^(عباية|تنورة|بلوزة)/.test(noun);
const COLORS = ['أسود', 'أحمر', 'وردي', 'بيج', 'أبيض', 'كحلي', 'زيتي', 'عنابي', 'ذهبي', 'سماوي', 'بني'];
// Prices in Iraqi dinar (IQD)
const PRICE = { evening: [75000, 250000], engagement: [100000, 350000], casual: [25000, 75000], abaya: [35000, 120000], sets: [30000, 90000] };
const DESC = {
  evening: 'قصة انسيابية تبرز جمال القوام، بخامة فاخرة ولمسات أنيقة تناسب السهرات والحفلات.',
  engagement: 'تصميم رومانسي بتفاصيل ناعمة وخامة مريحة، مثالي ليوم الخطوبة وجلسات التصوير.',
  casual: 'خامة خفيفة تسمح بمرور الهواء، مريح للاستخدام اليومي والطلعات والسفر.',
  abaya: 'عباية محتشمة بقصة واسعة وخامة لا تحتاج إلى كي، تناسب الدوام والمناسبات.',
  sets: 'تنسيق متكامل سهل الارتداء، يمكن ارتداء كل قطعة منفصلة لإطلالات متعددة.',
};

// Deterministic pseudo-random from a string, so re-imports produce the same data
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

export function generateProduct(slug, key) {
  const rnd = seeded(key);
  const [min, max] = PRICE[slug] || [30000, 100000];
  const price = Math.round((min + rnd() * (max - min)) / 1000) * 1000;
  const roll = rnd();
  const badge = roll < 0.18 ? 'sale' : roll < 0.32 ? 'new' : roll < 0.4 ? 'hot' : null;
  const colors = [...new Set([pick(rnd, COLORS), pick(rnd, COLORS), pick(rnd, COLORS)])];
  const noun = pick(rnd, NAMES[slug] || ['فستان']);
  return {
    name: `${noun} ${pick(rnd, isFeminine(noun) ? ADJ_F : ADJ)}`,
    description: DESC[slug] || '',
    price,
    old_price: badge === 'sale' ? Math.round((price * (1.2 + rnd() * 0.3)) / 1000) * 1000 : null,
    badge,
    colors,
    sizes: slug === 'abaya' ? ['52', '54', '56', '58', '60'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: Math.round((4 + rnd()) * 10) / 10,
    sold_count: Math.floor(rnd() * 400),
    stock: 5 + Math.floor(rnd() * 40),
    is_featured: rnd() < 0.12,
  };
}
