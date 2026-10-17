import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setCurrency, setToken } from './api.js';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

function usePersisted(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = usePersisted('massa_cart', []);
  const [wishlist, setWishlist] = usePersisted('massa_wishlist', []);
  const [toast, setToast] = useState(null);
  const [authReady, setAuthReady] = useState(!getToken());
  const [settings, setSettings] = useState(null);
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    // The admin dashboard is designed for light mode only
    const inAdmin = window.location.pathname.startsWith('/admin');
    const applied = inAdmin ? 'light' : theme;
    document.documentElement.dataset.theme = applied;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', applied === 'dark' ? '#1a0e18' : '#4A1D3F');
    if (inAdmin) return; // don't overwrite the visitor's saved choice
    try {
      localStorage.setItem('juman_theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (getToken()) {
      api('/auth/me')
        .then(setUser)
        .catch(() => setToken(null))
        .finally(() => setAuthReady(true));
    }
    loadSettings();
  }, []);

  const loadSettings = useCallback(() => {
    api('/settings')
      .then((s) => {
        setCurrency(s.currency);
        setSettings(s);
      })
      .catch(() => {});
  }, []);

  const notify = useCallback((msg) => {
    setToast({ msg, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => {
    const cartKey = (id, size) => `${id}-${size || ''}`;
    return {
      user,
      authReady,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      settings: settings || {},
      settingsLoaded: !!settings,
      reloadSettings: loadSettings,
      login(token, u) {
        setToken(token);
        setUser(u);
      },
      logout() {
        setToken(null);
        setUser(null);
      },

      cart,
      cartCount: cart.reduce((s, i) => s + i.qty, 0),
      cartTotal: cart.reduce((s, i) => s + i.qty * i.price, 0),
      addToCart(p, size, qty = 1) {
        setCart((c) => {
          const key = cartKey(p.id, size);
          const found = c.find((i) => i.key === key);
          if (found) return c.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, 10) } : i));
          return [...c, { key, id: p.id, name: p.name, price: p.price, image_url: p.image_url, size, qty }];
        });
        notify('تمت الإضافة إلى السلة 🛍️');
      },
      setQty: (key, qty) =>
        setCart((c) => (qty < 1 ? c.filter((i) => i.key !== key) : c.map((i) => (i.key === key ? { ...i, qty: Math.min(qty, 10) } : i)))),
      clearCart: () => setCart([]),

      wishlist,
      isWished: (id) => wishlist.some((p) => p.id === id),
      toggleWish(p) {
        setWishlist((w) => (w.some((x) => x.id === p.id) ? w.filter((x) => x.id !== p.id) : [...w, p]));
      },

      toast,
      notify,
    };
  }, [user, authReady, theme, settings, loadSettings, cart, wishlist, toast, notify, setCart, setWishlist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
