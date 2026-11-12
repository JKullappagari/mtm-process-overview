import {POSITIONS, VAL_DATE} from '../data.js';
import {acc, nf, pxf, esc, dmy, toCsv} from '../format.js';
import {table} from './table.js';

export default {
  key:'valuation', code:'RPT-01', title:'Daily MTM valuation',
  desc:'Position-level fair values by book, price source and FV level.',
  build({results}) {
    const books = [...new Set(POSITIONS.map(p => p.book))];
    const rows = [['Book','ID','Instrument','Type','Qty/Nominal','Ccy','Price','Source','Price date','FV level','MV local','FX','MV USD','Exposure USD','Status']];
    let body = '', tot = 0, totE = 0;
    books.forEach(b => {
      let sb = 0, se = 0;
      results.filter(r => r.p.book === b).forEach(r => {
        const p = r.p, v = r.val, pd = r.src === 'PRI' ? r.md.asOf : VAL_DATE;
        body += `<tr><td>${esc(p.name)}<span class="sub">${p.id} · ${esc(p.tk)}</span></td><td>${p.type}</td><td class="n">${nf(p.qty,0)}</td><td>${p.ccy}</td><td class="n">${pxf(p,r.px)}</td><td class="mono small">${r.src||'—'}</td><td class="mono small">${dmy(pd)}</td><td>L${p.lvl}</td><td class="n">${v?acc(v.mvL,0):'—'}</td><td class="n">${r.fx.ok?nf(r.fx.t,4):'—'}</td><td class="n">${v?acc(v.mvB,0):'—'}</td><td class="n">${v?acc(v.expB,0):'—'}</td><td><span class="pill st-${r.status}">${r.status}</span></td></tr>`;
        if (v) { sb += v.mvB; se += v.expB; }
        rows.push([b,p.id,p.name,p.type,p.qty,p.ccy,r.px,r.src,pd,'L'+p.lvl,v?v.mvL.toFixed(2):'',r.fx.t,v?v.mvB.toFixed(2):'',v?v.expB.toFixed(2):'',r.status]);
      });
      body += `<tr class="subtot"><td colspan="10">${b}</td><td class="n">${acc(sb,0)}</td><td class="n">${acc(se,0)}</td><td></td></tr>`;
      tot += sb; totE += se;
    });
    body += `<tr class="tot"><td colspan="10">Total fund</td><td class="n">${acc(tot,0)}</td><td class="n">${acc(totE,0)}</td><td></td></tr>`;
    const html = `<div><h4>Positions at fair value</h4>${table([{t:'Instrument'},{t:'Type'},{t:'Qty / nominal',n:1},{t:'Ccy'},{t:'Price',n:1},{t:'Src'},{t:'Price date'},{t:'Level'},{t:'MV local',n:1},{t:'FX',n:1},{t:'MV USD',n:1},{t:'Exposure USD',n:1},{t:'Status'}], body)}</div>
      <div class="notes"><span>Bond MV is dirty (clean + accrued). Futures carry zero MV after daily settlement; exposure column shows notional. FX forward MV is the discounted MTM; exposure is USD notional.</span><span>Negative values shown in brackets.</span></div>`;
    return {html, csv:toCsv(rows)};
  }
};
