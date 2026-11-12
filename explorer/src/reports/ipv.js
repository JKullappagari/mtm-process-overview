import {pxf, esc, toCsv} from '../format.js';
import {table, callbox} from './table.js';

export default {
  key:'ipv', code:'RPT-03', title:'Price exceptions & IPV',
  desc:'Every control hit, the vendor variance and how it was resolved.',
  build({results, state, counts}) {
    const rows = [['ID','Instrument','Rule','Severity','Finding','Primary','Secondary','Variance %','Price released','Resolution','Status']];
    let body = '', n = 0;
    results.forEach(r => r.flags.forEach(f => {
      n++;
      const p = r.p;
      const res = f.sev === 'auto' ? 'Auto-remediated by policy' : (r.status === 'RESOLVED' ? (r.o.reason || 'Approved by second reviewer') : 'Open');
      const st = f.sev === 'auto' ? 'AUTO' : r.status;
      body += `<tr><td>${esc(p.name)}<span class="sub">${p.id}</span></td><td class="mono">${f.rule}</td><td style="white-space:normal;min-width:240px">${esc(f.msg)}</td><td class="n">${pxf(p,r.md.pri)}</td><td class="n">${pxf(p,r.md.sec)}</td><td class="n">${r.variance==null?'—':r.variance.toFixed(2)+'%'}</td><td class="n">${pxf(p,r.px)}</td><td style="white-space:normal;min-width:180px" class="small">${esc(res)}</td><td><span class="pill st-${st}">${st}</span></td></tr>`;
      rows.push([p.id,p.name,f.rule,f.sev,f.msg,r.md.pri,r.md.sec,r.variance?.toFixed(3),r.px,res,st]);
    }));
    if (!n) body = '<tr><td colspan="9" class="muted">No control hits in this run.</td></tr>';
    const ver = results.filter(r => r.variance != null);
    const within = ver.filter(r => r.variance <= state.rules.tol).length;
    const html = callbox([['Prices verified vs 2nd source', `${ver.length}/${results.length}`], [`Within ${state.rules.tol.toFixed(2)}% tolerance`, within], ['Control hits', n], ['Still open', counts.open]]) +
      `<div><h4>Exception register</h4>${table([{t:'Instrument'},{t:'Rule'},{t:'Finding'},{t:'Primary',n:1},{t:'Secondary',n:1},{t:'Variance',n:1},{t:'Released',n:1},{t:'Resolution'},{t:'Status'}], body)}</div>`;
    return {html, csv:toCsv(rows)};
  }
};
