import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ORDER_STATUS, uploadImages } from '../api.js';
import { useStore } from '../store.jsx';
import { CloseIcon } from '../components/Icons.jsx';

/** Fetch helper: { data, error, loading, reload, setData } */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((e) => setState((s) => ({ ...s, error: e.message, loading: false })));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="a-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="a-head-actions">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="a-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`a-modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="a-modal-head">
          <h2>{title}</h2>
          <button className="a-icon" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
        </div>
        <div className="a-modal-body">{children}</div>
      </div>
    </div>
  );
}

export const StatusPill = ({ status }) => <span className={`a-pill st-${status}`}>{ORDER_STATUS[status] || status}</span>;

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="a-pager">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>السابق</button>
      <span>{page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>التالي</button>
    </div>
  );
}

export const Empty = ({ children }) => <div className="a-empty">{children}</div>;
export const Loading = () => <div className="spinner" />;

export function useNotify() {
  return useStore().notify;
}

/** Image picker: upload from device or paste URLs. value = array of urls */
export function ImagePicker({ value, onChange, max = 8 }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const add = (urls) => onChange([...value, ...urls].slice(0, max));
  const onFiles = async (files) => {
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      add(await uploadImages([...files]));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      input.current.value = '';
    }
  };
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="a-images">
      <div className="a-thumbs">
        {value.map((src, i) => (
          <div key={src + i} className="a-thumb">
            <img src={src} alt="" referrerPolicy="no-referrer" />
            {i === 0 && <span className="a-thumb-main">الرئيسية</span>}
            <div className="a-thumb-actions">
              {i > 0 && <button type="button" onClick={() => move(i, -1)} title="تقديم">→</button>}
              {i < value.length - 1 && <button type="button" onClick={() => move(i, 1)} title="تأخير">←</button>}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} title="حذف">✕</button>
            </div>
          </div>
        ))}
        {value.length < max && (
          <button type="button" className="a-thumb a-thumb-add" onClick={() => input.current.click()} disabled={busy}>
            {busy ? '...' : <><b>+</b><small>رفع صور</small></>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <div className="a-row">
        <input className="a-input" dir="ltr" placeholder="أو الصقي رابط صورة https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="a-btn" disabled={!/^https?:\/\/|^\//.test(url)} onClick={() => { add([url.trim()]); setUrl(''); }}>إضافة</button>
      </div>
      {error && <p className="a-error">{error}</p>}
    </div>
  );
}

/** Text tags input (sizes, colors, boards...) */
export function Tags({ value, onChange, placeholder, suggestions = [] }) {
  const [text, setText] = useState('');
  const add = (t) => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  return (
    <div className="a-tags">
      <div className="a-tag-list">
        {value.map((t) => (
          <span key={t} className="a-tag">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`حذف ${t}`}>×</button>
          </span>
        ))}
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => text && add(text)}
        />
      </div>
      {suggestions.filter((s) => !value.includes(s)).length > 0 && (
        <div className="a-suggest">
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button type="button" key={s} onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export const fmtDate = (d, withTime) =>
  new Date(d).toLocaleString('ar-IQ', withTime
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
