const base = (path, props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {path}
  </svg>
);

export const HomeIcon = (p) => base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>, p);
export const ShopIcon = (p) => base(<><path d="M9 3h6l1 3 3 2-2 3v10H7V11L5 8l3-2z" /><path d="M10 3c0 2 4 2 4 0" /></>, p);
export const HeartIcon = ({ filled, ...p }) =>
  base(<path d="M12 21s-7.5-4.6-9.3-9.5C1.5 8 3.8 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.7 1.2-1.6 2.7-2.7 4.7-2.7 3.5 0 5.8 3.5 4.6 7C19.5 16.4 12 21 12 21z" fill={filled ? 'currentColor' : 'none'} />, p);
export const BagIcon = (p) => base(<><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>, p);
export const UserIcon = (p) => base(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>, p);
export const SearchIcon = (p) => base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, p);
export const FilterIcon = (p) => base(<><path d="M4 6h16M7 12h10M10 18h4" /></>, p);
export const BackIcon = (p) => base(<path d="m9 6 6 6-6 6" />, p); // points right = "back" in RTL
export const CloseIcon = (p) => base(<path d="M6 6l12 12M18 6 6 18" />, p);
export const TruckIcon = (p) => base(<><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>, p);
export const ReturnIcon = (p) => base(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>, p);
export const StarIcon = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B301" aria-hidden="true" {...p}>
    <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" />
  </svg>
);
export const WhatsappIcon = (p) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
  </svg>
);
export const InstagramIcon = (p) => base(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></>, p);
export const RecycleIcon = (p) => base(<><path d="M7 19H4.5a1.5 1.5 0 0 1-1.3-2.25L5.5 13" /><path d="m11 19 2-2-2-2" /><path d="M13 17h6.5a1.5 1.5 0 0 0 1.3-2.25L19 11.5" /><path d="m8.5 8.5-3 .5-.5-3" /><path d="M5.5 9 8.2 4.3a1.5 1.5 0 0 1 2.6 0l1.7 3" /><path d="m17.5 10.5.5-3 3 .5" /></>, p);
