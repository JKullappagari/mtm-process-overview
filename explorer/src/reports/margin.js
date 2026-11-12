import {CSA} from '../data.js';
import {acc, nf, pxf, esc, toCsv} from '../format.js';
import {table, callbox} from './table.js';

/**
 * CSA call logic (simplified ISDA VM CSA, USD cash, no interest).
 * E > 0 means the counterparty owes us. Delivery rounds up, return rounds down.
 */
export function csaCall(E, csa = CSA) {
  const {independentAmount:IA, threshold:TH, mta:MTA, rounding:RND, collateralHeld:HELD} = csa;
  const csaAmt = Math.max(E + IA - TH, 0);
  if (E >= 0) {
    const d = csaAmt - HELD;
    if (d > MTA) { const amt = Math.ceil(d / RND) * RND; return {csaAmt, amt, dir:'Delivery amount (we call)', dec:`Call issued to ${csa.cpty} for USD ${nf(amt,0)}`}; }
    if (-d > MTA) { const amt = Math.floor(-d / RND) * RND; return {csaAmt, amt, dir:'Return amount (we return)', dec:`Return USD ${nf(amt,0)} to ${csa.cpty}`}; }
    return {csaAmt, amt:0, dir:'Within MTA', dec:'Movement below MTA: no call issued'};
  }
  const need = -E - TH;
  if (need > MTA) { const amt = Math.ceil(need / RND) * RND; return {csaAmt:-need, amt, dir:'Expected inbound call', dec:`Expect call from ${csa.cpty} for USD ${nf(amt,0)}`}; }
  return {csaAmt:-need, amt:0, dir:'Within MTA', dec:'Counterparty exposure below MTA: no call expected'};
}

export default {
  key:'margin', code:'RPT-04', title:'Margin call (CSA & ETD)',
  desc:'OTC exposure vs collateral under the CSA, and futures variation margin.',
  build({results}) {
    const rows = [['Section','ID','Trade','MTM/VM local','Ccy','MTM/VM USD']];
    const otc = results.filter(r => r.p.cls === 'fx');
    const E = otc.reduce((a, r) => a + (r.val ? r.val.mvB : 0), 0);
    const call = csaCall(E);
    let b1 = '';
    otc.forEach(r => {
      b1 += `<tr><td>${esc(r.p.name)}<span class="sub">${r.p.id} · ${esc(r.p.tk)}</span></td><td class="n">${r.val?acc(r.val.mvL,0):'—'}</td><td>${r.p.ccy}</td><td class="n">${r.val?acc(r.val.mvB,0):'—'}</td></tr>`;
      rows.push([`CSA ${CSA.cpty}`,r.p.id,r.p.name,r.val?.mvL.toFixed(2),r.p.ccy,r.val?.mvB.toFixed(2)]);
    });
    b1 += `<tr class="tot"><td colspan="3">Net exposure to ${CSA.cpty}</td><td class="n">${acc(E,0)}</td></tr>`;

    const etd = results.filter(r => r.p.cls === 'fu');
    let b2 = '', vt = 0;
    etd.forEach(r => {
      const v = r.val; if (v) vt += v.vm;
      b2 += `<tr><td>${esc(r.p.name)}<span class="sub">${r.p.id} · ${r.p.venue}</span></td><td class="n">${r.p.qty}</td><td class="n">${pxf(r.p,r.p.prior)} → ${pxf(r.p,r.px)}</td><td class="n">${v?acc(v.vmL,0):'—'}</td><td>${r.p.ccy}</td><td class="n">${v?acc(v.vm,0):'—'}</td><td>${v?(v.vm>=0?'Receive':'Pay'):'—'}</td></tr>`;
      rows.push(['ETD '+r.p.venue,r.p.id,r.p.name,v?.vmL.toFixed(2),r.p.ccy,v?.vm.toFixed(2)]);
    });
    b2 += `<tr class="tot"><td colspan="5">Net variation margin via clearing broker</td><td class="n">${acc(vt,0)}</td><td>${vt>=0?'Receive':'Pay'}</td></tr>`;
    rows.push(['CSA summary','','Exposure',E.toFixed(2),'USD',''], ['CSA summary','','Collateral held',CSA.collateralHeld,'USD',''], ['CSA summary','','Call amount',call.amt,'USD',call.dir]);

    const html = `<div><h4>A · OTC bilateral: ISDA CSA with ${CSA.cpty} (VM, USD cash)</h4>${table([{t:'Trade'},{t:'MTM local',n:1},{t:'Ccy'},{t:'MTM USD',n:1}], b1)}</div>` +
      callbox([['Exposure', acc(E,0)], ['Independent amount', nf(CSA.independentAmount,0)], ['Threshold', nf(CSA.threshold,0)], ['Credit support amount', acc(call.csaAmt,0)], ['Collateral held', nf(CSA.collateralHeld,0)], ['MTA / rounding', `${nf(CSA.mta,0)} / ${nf(CSA.rounding,0)}`], [call.dir, nf(call.amt,0), true]]) +
      `<p class="small"><b>Decision:</b> ${call.dec}. Delivery amounts round up and return amounts round down to the rounding amount, per the CSA.</p>
      <div><h4>B · Exchange-traded: daily variation margin</h4>${table([{t:'Contract'},{t:'Lots',n:1},{t:'Settle prior → today',n:1},{t:'VM local',n:1},{t:'Ccy'},{t:'VM USD',n:1},{t:'Direction'}], b2)}</div>`;
    return {html, csv:toCsv(rows)};
  }
};
