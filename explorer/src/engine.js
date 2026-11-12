// Valuation and STP control engine. Pure functions: no DOM, no globals except reference data.
// Everything takes `state` (see state.js) so it can be unit-tested in Node.

import {VAL_DATE, PRIOR_DATE, POSITIONS, CLASS_NAMES} from './data.js';
import {toDate, dmy, nf, um, pct, pxf} from './format.js';

/* ---------- date maths ---------- */
export const days = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);

/** Weekdays strictly after a, up to and including b. No holiday calendar. */
export function bizDays(a, b) {
  let n = 0, d = toDate(a); const e = toDate(b);
  while (d < e) { d = new Date(d.getTime() + 864e5); const w = d.getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}

/** 30/360 (US bond basis) day count. */
export function days360(a, b) {
  const x = toDate(a), y = toDate(b);
  const d1 = Math.min(x.getUTCDate(), 30); let d2 = y.getUTCDate();
  if (d1 === 30 && d2 === 31) d2 = 30;
  return 360 * (y.getUTCFullYear() - x.getUTCFullYear()) + 30 * (y.getUTCMonth() - x.getUTCMonth()) + (d2 - d1);
}

/** Accrued interest per 100 nominal. */
export function accrued(p, dt) {
  if (p.dc === '30/360') return p.cpn / p.freq * days360(p.last, dt) / (360 / p.freq);
  return p.cpn / p.freq * days(p.last, dt) / days(p.last, p.next); // ACT/ACT ICMA
}

/** Simple-interest discount factor to the forward's maturity. */
export const discountFactor = (p, dt) => 1 / (1 + p.rate * days(dt, p.mat) / 365);

/* ---------- FX ---------- */
/** Resolve today's and prior USD rate for a currency, applying the fallback policy. */
export function fxRaw(ccy, state) {
  if (ccy === 'USD') return {ok:true, t:1, p:1, src:'BASE'};
  const f = state.fx[ccy];
  if (f.pri != null) return {ok:true, t:f.pri, p:f.prior, src:'PRI'};
  if (f.sec != null && state.rules.fallback) return {ok:true, t:f.sec, p:f.prior, src:'SEC', auto:true};
  return {ok:false, t:null, p:f.prior, src:null};
}

/* ---------- valuation ---------- */
/**
 * Value one position at price `px` with FX {t: today, p: prior} (units per USD).
 * Returns MV (local and USD), exposure, P&L components and human-readable formula lines.
 * P&L = price + carry + fxe (FX translation) + vm (futures variation margin).
 */
export function valuate(p, px, fx) {
  const fT = fx.t, fP = fx.p, r = {carry:0, fxe:0, vm:0, price:0};
  if (p.cls === 'eq') {
    const mT = p.qty * px, mP = p.qty * p.prior;
    r.mvL = mT; r.mvB = mT / fT; r.expB = r.mvB;
    r.price = (mT - mP) / fT; r.fxe = mP * (1 / fT - 1 / fP);
    r.lines = [`MV local = ${nf(p.qty,0)} × ${pxf(p,px)} = ${p.ccy} ${um(mT,2)}`, `MV USD = ${um(mT,2)} ÷ ${nf(fT,4)} = ${um(r.mvB,2)}`, `Price P&L = ${nf(p.qty,0)} × (${pxf(p,px)} − ${pxf(p,p.prior)}) ÷ ${nf(fT,4)}`];
  } else if (p.cls === 'bd') {
    const aT = accrued(p, VAL_DATE), aP = accrued(p, PRIOR_DATE);
    const mT = p.qty * (px + aT) / 100, mP = p.qty * (p.prior + aP) / 100;
    r.accT = aT; r.accP = aP; r.mvL = mT; r.mvB = mT / fT; r.expB = r.mvB;
    r.price = p.qty * (px - p.prior) / 100 / fT; r.carry = p.qty * (aT - aP) / 100 / fT; r.fxe = mP * (1 / fT - 1 / fP);
    r.lines = [`Accrued (${p.dc}) = ${p.cpn}/${p.freq} × elapsed/period = ${aT.toFixed(5)}`, `Dirty = ${pxf(p,px)} + ${aT.toFixed(5)} = ${(px+aT).toFixed(5)}`, `MV local = ${nf(p.qty,0)} × ${(px+aT).toFixed(5)}% = ${p.ccy} ${um(mT,2)}`, `MV USD = ${um(mT,2)} ÷ ${nf(fT,4)} = ${um(r.mvB,2)}`];
  } else if (p.cls === 'fu') {
    const nT = p.qty * p.mult * px, vm = p.qty * p.mult * (px - p.prior);
    r.mvL = 0; r.mvB = 0; r.expB = nT / fT; r.vmL = vm; r.vm = vm / fT;
    r.lines = [`Notional = ${p.qty} × ${p.mult} × ${pxf(p,px)} = ${p.ccy} ${um(nT,0)}`, `Variation margin = ${p.qty} × ${p.mult} × (${pxf(p,px)} − ${pxf(p,p.prior)}) = ${p.ccy} ${um(vm,0)}`, `Settled daily, so carried MV resets to 0`];
  } else if (p.cls === 'fx') {
    const dT = discountFactor(p, VAL_DATE), dP = discountFactor(p, PRIOR_DATE);
    const qT = p.dir * p.qty * (px - p.strike) * dT, qP = p.dir * p.qty * (p.prior - p.strike) * dP;
    r.df = dT; r.mvL = qT; r.mvB = qT / fT; r.expB = p.qty;
    r.price = (qT - qP) / fT; r.fxe = qP * (1 / fT - 1 / fP);
    r.lines = [`DF = 1 ÷ (1 + ${(p.rate*100).toFixed(2)}% × ${days(VAL_DATE,p.mat)}/365) = ${dT.toFixed(6)}`, `MTM ${p.ccy} = ${p.dir>0?'+':'−'}${nf(p.qty,0)} × (${pxf(p,px)} − ${pxf(p,p.strike)}) × DF = ${um(qT,2)}`, `MTM USD = ${um(qT,2)} ÷ spot ${nf(fT,4)} = ${um(r.mvB,2)}`];
  } else {
    throw new Error(`No valuation model for asset class "${p.cls}"`);
  }
  r.pnl = r.price + r.carry + r.fxe + r.vm;
  return r;
}

/* ---------- STP controls ---------- */
const flag = (rule, sev, msg) => ({rule, sev, msg}); // sev: auto | exc | review

/**
 * Run R1–R6 on one position and decide its status.
 * rc[rule] is one of pass | auto | exc | review | off.
 * status is STP | AUTO | REVIEW | EXCEPTION | RESOLVED.
 */
export function evaluate(p, state) {
  const md = state.md[p.id], R = state.rules, on = R.on, o = state.ovr[p.id] || {};
  const fr = fxRaw(p.ccy, state), flags = [], rc = {};
  let px = null, src = null;

  // R1 completeness (always on)
  if (md.pri != null) { px = md.pri; src = 'PRI'; rc.R1 = 'pass'; }
  else if (md.sec != null && R.fallback) { px = md.sec; src = 'SEC'; rc.R1 = 'auto'; flags.push(flag('R1','auto','Primary price missing; secondary source used under fallback policy')); }
  else { rc.R1 = 'exc'; flags.push(flag('R1','exc', md.sec == null ? 'No price from primary or secondary source' : 'Primary price missing and fallback is disabled')); }

  // R2 staleness
  if (!on.R2) rc.R2 = 'off';
  else if (md.pri == null) rc.R2 = 'pass';
  else {
    const age = bizDays(md.asOf, VAL_DATE);
    if (age > R.stale) { rc.R2 = 'exc'; flags.push(flag('R2','exc',`Primary price dated ${dmy(md.asOf)} is ${age} business days old (limit ${R.stale})`)); }
    else if (age > 0) { rc.R2 = 'auto'; flags.push(flag('R2','auto',`Primary price is ${age} business day old, within the ${R.stale}-day tolerance`)); }
    else rc.R2 = 'pass';
  }

  // R3 source variance
  let variance = null;
  if (md.pri != null && md.sec != null) variance = Math.abs(md.pri - md.sec) / Math.abs(md.sec) * 100;
  if (!on.R3) rc.R3 = 'off';
  else if (variance == null) rc.R3 = 'pass';
  else if (variance > R.tol) { rc.R3 = 'exc'; flags.push(flag('R3','exc',`Primary vs secondary differ by ${variance.toFixed(2)}% (tolerance ${R.tol.toFixed(2)}%)`)); }
  else rc.R3 = 'pass';

  // R4 day-on-day move
  const move = px != null ? (px - p.prior) / p.prior * 100 : null;
  if (!on.R4) rc.R4 = 'off';
  else if (move == null) rc.R4 = 'pass';
  else if (Math.abs(move) > R.move[p.cls]) { rc.R4 = 'exc'; flags.push(flag('R4','exc',`Day-on-day move ${pct(move)} exceeds the ${R.move[p.cls]}% ${CLASS_NAMES[p.cls].toLowerCase()} limit`)); }
  else rc.R4 = 'pass';

  // R5 FX availability
  if (!on.R5) rc.R5 = 'off';
  else if (!fr.ok) { rc.R5 = 'exc'; flags.push(flag('R5','exc',`No USD/${p.ccy} rate from either FX source`)); }
  else if (fr.auto) { rc.R5 = 'auto'; flags.push(flag('R5','auto',`USD/${p.ccy} primary missing; secondary rate used`)); }
  else rc.R5 = 'pass';

  // Effective FX: analyst override, or prior-day rate if R5 is switched off
  let fx = fr; const fo = state.ovr['FX:' + p.ccy];
  if (!fx.ok && fo) fx = {ok:true, t:fo.fx, p:fr.p, src:'OVR'};
  if (!fx.ok && !on.R5) fx = {ok:true, t:fr.p, p:fr.p, src:'PRIOR'};

  const hasExc = flags.some(f => f.sev === 'exc');
  let resolved = false;
  if (hasExc && o.px != null && fx.ok) { px = o.px; src = 'OVR'; resolved = true; }

  const val = px != null && fx.ok ? valuate(p, px, fx) : null;

  // R6 materiality
  let review = false;
  if (!on.R6) rc.R6 = 'off';
  else if (val && Math.abs(val.pnl) > R.mat) { rc.R6 = 'review'; review = true; flags.push(flag('R6','review',`Daily P&L USD ${um(val.pnl,0)} exceeds materiality of USD ${nf(R.mat,0)}`)); }
  else rc.R6 = 'pass';

  let status;
  if (hasExc && !resolved) status = 'EXCEPTION';
  else if (hasExc && resolved) status = 'RESOLVED';
  else if (review && !o.approved) status = 'REVIEW';
  else if (review && o.approved) status = 'RESOLVED';
  else if (flags.some(f => f.sev === 'auto')) status = 'AUTO';
  else status = 'STP';

  return {p, md, px, src, fx, fr, flags, rc, status, val, variance, move, o, hasExc, review};
}

/** Evaluate the whole book. */
export const runAll = state => POSITIONS.map(p => evaluate(p, state));

/** Status counts and STP rate (STP + AUTO as % of positions). */
export function counts(results) {
  const c = {STP:0, AUTO:0, REVIEW:0, EXCEPTION:0, RESOLVED:0};
  results.forEach(r => c[r.status]++);
  c.n = results.length;
  c.rate = c.n ? (c.STP + c.AUTO) / c.n * 100 : 0;
  c.open = c.REVIEW + c.EXCEPTION;
  return c;
}
