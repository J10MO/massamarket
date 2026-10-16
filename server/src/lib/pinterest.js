// Fetches images from Pinterest using its public, official endpoints:
//  - Board RSS feed:  https://www.pinterest.com/<user>/<board>.rss   (latest ~25 pins)
//  - oEmbed:          https://www.pinterest.com/oembed.json?url=<pin>  (single pin)

const UA = 'Mozilla/5.0 (compatible; DressShopBot/1.0)';

const decode = (s = '') =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

// i.pinimg.com/236x/ee/63/15/<hash>.jpg -> i.pinimg.com/736x/ee/63/15/<hash>.jpg
export const toLargeImage = (url) => url.replace(/\/(\d+x|originals)\//, '/736x/');

// Hash part of the image path, identical for every size of the same image
export const imageKey = (url) => {
  const m = url.match(/i\.pinimg\.com\/[^/]+\/(.+)$/);
  return m ? m[1] : url;
};

// Accepts "user/board", "https://xx.pinterest.com/user/board/" or a .rss URL
export function normalizeBoard(input) {
  const s = input.trim().replace(/\.rss$/, '');
  const m = s.match(/pinterest\.[a-z.]+\/([^/?#]+)\/([^/?#]+)/i);
  if (m) return `${m[1]}/${m[2]}`;
  const parts = s.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length === 2) return parts.join('/');
  throw new Error('رابط اللوحة غير صالح. مثال: https://www.pinterest.com/user/board/');
}

export const isPinUrl = (url) => /pinterest\.[a-z.]+\/pin\//i.test(url) || /pin\.it\//i.test(url);

export async function fetchBoard(input) {
  const board = normalizeBoard(input);
  const res = await fetch(`https://www.pinterest.com/${board}.rss`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`تعذر جلب اللوحة ${board} (HTTP ${res.status})`);
  const xml = await res.text();

  const pins = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const desc = decode(item.match(/<description>([\s\S]*?)<\/description>/)?.[1]);
    const img = desc.match(/src="([^"]+)"/)?.[1];
    if (!img) continue;
    pins.push({ pinUrl: decode(link), title: decode(title), image: toLargeImage(img) });
  }
  return pins;
}

export async function fetchPin(url) {
  const res = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`تعذر جلب الدبوس (HTTP ${res.status})`);
  const data = await res.json();
  if (!data.thumbnail_url) throw new Error('هذا الدبوس لا يحتوي على صورة');
  return { pinUrl: url, title: data.title || '', image: toLargeImage(data.thumbnail_url) };
}
