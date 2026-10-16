const TOKEN_KEY = 'lamsa_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'تعذر الاتصال بالخادم');
  return data;
}

// Currency comes from the store settings (default: Iraqi dinar)
let CURRENCY = 'د.ع';
export const setCurrency = (c) => (CURRENCY = c || CURRENCY);
export const price = (n) =>
  `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${CURRENCY}`;

export const ORDER_STATUS = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

export async function uploadImages(files) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const res = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'تعذر رفع الصورة');
  return data.urls;
}
