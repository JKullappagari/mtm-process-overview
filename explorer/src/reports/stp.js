import {POSITIONS, RULE_META} from '../data.js';
import {sgtTime, toCsv} from '../format.js';
import {runId} from '../state.js';
import {table, callbox} from './table.js';

export default {
  key:'stp', code:'RPT-05', title:'STP control summary',
  desc:'Straight-through rate, rule hit counts and the batch log.',
  build({results, state, counts:c}) {
    const rows = [['Rule','Name','Auto-fixed','Exceptions','4-eyes','Enabled']];
    let rb = '';
    Object.entries(RULE_META).forEach(([k, m]) => {
      const a = results.filter(r => r.rc[k] === 'auto').length, e = results.filter(r => r.rc[k] === 'exc').length, v = results.filter(r => r.rc[k] === 'review').length;
      const en = k === 'R1' || state.rules.on[k];
      rb += `<tr><td class="mono">${k}</td><td>${m.name}</td><td class="n">${a}</td><td class="n">${e}</td><td class="n">${v}</td><td>${en?'Yes':'No'}</td></tr>`;
      rows.push([k, m.name, a, e, v, en ? 'Y' : 'N']);
    });
    const t0 = state.runAt, at = s => sgtTime(new Date(t0.getTime() + s * 1000));
    const log = [
      [0,'Batch started',runId(state)],
      [4,'Positions extracted',`${POSITIONS.length} positions, ${new Set(POSITIONS.map(p=>p.book)).size} books`],
      [9,'Vendor files loaded',`Primary + secondary, ${Object.keys(state.fx).length} FX pairs`],
      [13,'Validation complete',`${results.filter(r=>r.md.pri==null).length} primary gaps`],
      [19,'Valuation complete',`${results.filter(r=>r.val).length}/${POSITIONS.length} valued`],
      [22,'STP controls applied',`${c.STP+c.AUTO} released, ${c.EXCEPTION+c.REVIEW+c.RESOLVED} touched`],
      [25,'Reports staged',c.open?'DRAFT pending exceptions':'FINAL']
    ];
    const csv = toCsv(rows.concat([[], ['Status','Count'], ...['STP','AUTO','RESOLVED','REVIEW','EXCEPTION'].map(k => [k, c[k]]), ['STP rate %', c.rate.toFixed(1)]]));
    const html = callbox([['STP rate', c.rate.toFixed(1)+'%', true], ['Straight-through', c.STP], ['Auto-remediated', c.AUTO], ['Manually resolved', c.RESOLVED], ['Open', c.open]]) +
      `<div><h4>Rule hits</h4>${table([{t:'Rule'},{t:'Control'},{t:'Auto-fixed',n:1},{t:'Exceptions',n:1},{t:'4-eyes',n:1},{t:'Enabled'}], rb)}</div>
      <div><h4>Batch log (simulated timings)</h4>${table([{t:'Time'},{t:'Step'},{t:'Detail'}], log.map(([s,a,b]) => `<tr><td class="mono">${at(s)}</td><td>${a}</td><td class="small">${b}</td></tr>`).join(''))}</div>`;
    return {html, csv};
  }
};
