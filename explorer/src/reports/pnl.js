import {acc, pxf, esc, toCsv} from '../format.js';
import {table, callbox} from './table.js';

export default {
  key:'pnl', code:'RPT-02', title:'P&L attribution',
  desc:'Daily P&L split into price, carry, FX translation and variation margin.',
  build({results}) {
    const T = {price:0, carry:0, fxe:0, vm:0, pnl:0};
    const rows = [['ID','Instrument','Prior mark','Current mark','Price effect USD','Carry USD','FX translation USD','Variation margin USD','Total USD']];
    let body = '';
    results.forEach(r => {
      const p = r.p, v = r.val;
      if (v) Object.keys(T).forEach(k => T[k] += v[k]);
      body += `<tr><td>${esc(p.name)}<span class="sub">${p.id}</span></td><td class="n">${pxf(p,p.prior)}</td><td class="n">${pxf(p,r.px)}</td><td class="n">${v?acc(v.price):'—'}</td><td class="n">${v?acc(v.carry):'—'}</td><td class="n">${v?acc(v.fxe):'—'}</td><td class="n">${v?acc(v.vm):'—'}</td><td class="n"><b>${v?acc(v.pnl):'—'}</b></td></tr>`;
      rows.push([p.id,p.name,p.prior,r.px,v?.price.toFixed(2),v?.carry.toFixed(2),v?.fxe.toFixed(2),v?.vm.toFixed(2),v?.pnl.toFixed(2)]);
    });
    body += `<tr class="tot"><td colspan="3">Total fund</td><td class="n">${acc(T.price)}</td><td class="n">${acc(T.carry)}</td><td class="n">${acc(T.fxe)}</td><td class="n">${acc(T.vm)}</td><td class="n">${acc(T.pnl)}</td></tr>`;
    const nav = results.reduce((a, r) => a + (r.val ? r.val.mvB : 0), 0);
    const top = results.filter(r => r.val).sort((a, b) => Math.abs(b.val.pnl) - Math.abs(a.val.pnl))[0];
    const html = callbox([['Daily P&amp;L USD', acc(T.pnl)], ['Return on NAV (bps)', nav ? (T.pnl / nav * 1e4).toFixed(1) : '—'], ['Largest contributor', top ? top.p.id : '—'], ['Valuation point', 'Asia close']]) +
      `<div><h4>Attribution by position (USD)</h4>${table([{t:'Instrument'},{t:'Prior',n:1},{t:'Current',n:1},{t:'Price',n:1},{t:'Carry',n:1},{t:'FX transl.',n:1},{t:'Var. margin',n:1},{t:'Total',n:1}], body)}</div>
      <div class="notes"><span>Price effect = change in local value ÷ today's FX. FX translation = prior local value × (1/FX<sub>t</sub> − 1/FX<sub>t−1</sub>). Carry is coupon accrual between valuation dates.</span></div>`;
    return {html, csv:toCsv(rows)};
  }
};
