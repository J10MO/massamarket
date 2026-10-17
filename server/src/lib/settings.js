import { query } from '../db.js';

// Store-wide settings, editable from the admin dashboard. Defaults are for Iraq.
export const DEFAULT_SETTINGS = {
  store_name: 'Massa ماسة',
  tagline: 'فخامة تُحاكي ذوقچ',
  currency: 'د.ع',
  shipping_fee: 5000,
  free_shipping_over: 150000,
  whatsapp: '9647700000000',
  instagram: 'https://www.instagram.com/massa_desgin/',
  phone: '',
  hero_offer: 'عرض حصري: خصم 20% هذا الأسبوع',
  hero_title: 'تألّقي كالماسة',
  hero_title_accent: 'في كل مناسبة',
  hero_subtitle: 'أناقة • تميّز • اختيار راقٍ — لأنچ تستحقين الأجمل دائماً.',
  announcements: ['📦 توصيل لجميع المحافظات', 'الدفع عند الاستلام ✦', 'استبدال مجاني خلال 7 أيام ✦'],
  // Used-dress marketplace
  market_enabled: true,
  market_auto_approve: false, // false = admin reviews every new listing
  market_commission: 5, // % taken from each completed sale
  boost_plans: [
    { days: 3, price: 3000 },
    { days: 7, price: 6000 },
    { days: 15, price: 10000 },
    { days: 30, price: 18000 },
  ],
  payment_methods: [
    { name: 'زين كاش', details: '07XXXXXXXXX' },
    { name: 'آسيا حوالة', details: '07XXXXXXXXX' },
    { name: 'FastPay', details: '07XXXXXXXXX' },
  ],
  market_terms: 'يجب أن يكون الفستان نظيفاً ومغسولاً وبحالة جيدة، والصور حقيقية للقطعة نفسها. يتم التوصيل والدفع بالتنسيق بين البائعة والمشترية.',
  cities: [
    'بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك', 'كركوك', 'النجف', 'كربلاء', 'بابل',
    'ديالى', 'الأنبار', 'صلاح الدين', 'واسط', 'ذي قار', 'ميسان', 'المثنى', 'القادسية', 'حلبجة',
  ],
};

let cache = null;

export async function ensureDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)]);
  }
  cache = null;
}

export async function getSettings() {
  if (cache) return cache;
  const { rows } = await query('SELECT key, value FROM settings');
  cache = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return cache;
}

export async function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, JSON.stringify(value)]
    );
  }
  cache = null;
  return getSettings();
}
