// Small UI helpers shared by the student and instructor portals.

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One toast at a time (no overlapping stacks), announced to screen readers.
let toastEl = null; let toastTimer;
export function toast(msg, { ms = 4000, action } = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.append(toastEl);
  }
  toastEl.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}`;
  if (action) toastEl.querySelector('.toast-action').onclick = () => { action.onClick(); hideToast(); };
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}
export function hideToast() { if (toastEl) toastEl.hidden = true; }

// Plain-language versions of errors. Raw technical messages go to the console only.
export function friendly(e, fallback = 'Something went wrong.') {
  console.error(e);
  const m = String(e?.message || e || '');
  if (!navigator.onLine || /fetch|network|Failed to fetch|timeout/i.test(m)) return "You're offline or the connection dropped. Check the wifi and try again.";
  if (/under 2\.5 MB/.test(m)) return m; // our own readable message
  return fallback;
}

// Retry a write a few times (1 s, 2 s, 4 s) before giving up. Used for check-in saves so a
// wifi blip doesn't silently drop what the student answered.
export async function withRetry(fn, tries = 4) {
  let delay = 1000;
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, delay)); delay *= 2;
    }
  }
}

// Banner shown while the browser is offline.
export function watchConnection(text = "You're offline. Changes will sync when the connection comes back.") {
  const bar = document.createElement('div');
  bar.className = 'offline-bar'; bar.setAttribute('role', 'status'); bar.textContent = text;
  const sync = () => { bar.hidden = navigator.onLine; };
  document.body.prepend(bar); sync();
  window.addEventListener('online', sync); window.addEventListener('offline', sync);
}

// Disable a button while an async action runs (prevents double taps / double submits).
export async function busy(btn, fn) {
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
}
