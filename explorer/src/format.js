// Display helpers. Pure functions, no DOM.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const toDate = s => new Date(s + 'T00:00:00Z');
export const dmy = s => { const d = toDate(s); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };

const bad = n => n == null || isNaN(n);
/** Fixed-decimal number with thousands separators. */
export const nf = (n, d = 2) => bad(n) ? '—' : Number(n).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
/** Like nf but with a true minus sign. */
export const um = (n, d = 0) => bad(n) ? '—' : (n < 0 ? '−' : '') + nf(Math.abs(n), d);
/** Signed, coloured P&L as HTML. */
export const pl = (n, d = 0) => bad(n) ? '—' : `<span class="${n < -0.5 ? 'neg' : n > 0.5 ? 'pos' : ''}">${n > 0.5 ? '+' : ''}${um(n, d)}</span>`;
/** Accounting style: negatives in brackets. */
export const acc = (n, d = 0) => bad(n) ? '—' : (n < -0.5 ? `(${nf(Math.abs(n), d)})` : nf(n, d));
export const pct = (n, d = 2) => bad(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d) + '%';
export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/** Price in the instrument's display precision. */
export const pxf = (p, v) => v == null ? '—' : nf(v, p.dp);
export const sgt = d => d.toLocaleString('en-GB', {timeZone:'Asia/Singapore', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}) + ' SGT';
export const sgtTime = d => d.toLocaleTimeString('en-GB', {timeZone:'Asia/Singapore', hour12:false});

export function toCsv(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
}
