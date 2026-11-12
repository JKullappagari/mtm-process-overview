// DOM rendering and event wiring. Reads/mutates `state`, calls engine + reports, re-renders.

import {POSITIONS, BY_ID, VAL_DATE, FUND, CLASS_NAMES, PRICE_TYPES, SCENARIOS, RULE_META, RESOLUTION_REASONS, AS_OF_CHOICES, PRIOR_DATE} from './data.js';
import {nf, um, pl, pct, esc, pxf, dmy, sgt} from './format.js';
import {runAll, counts, accrued, days} from './engine.js';
import {loadScenario, runId} from './state.js';
import {REPORTS, reportByKey} from './reports/index.js';

const $ = id => document.getElementById(id);
const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };

export function mountApp(state) {
  let RES = [], CSV = '';

  /* ---------- hero ticket ---------- */
  function renderTicket() {
    const r = RES[0];
    if (!r.val) { $('tkRes').textContent = 'No valid price yet for EQ-001'; return; }
    $('tkPx').textContent = 'SGD ' + nf(r.px, 2);
    $('tkFx').textContent = nf(r.fx.t, 4);
    const pnlL = r.p.qty * (r.px - r.p.prior);
    $('tkRes').textContent = `${nf(r.p.qty,0)} × (${nf(r.px,2)} − ${nf(r.p.prior,2)}) = SGD ${um(pnlL,0)} → USD ${um(pnlL / r.fx.t,0)}`;
  }

  /* ---------- pipeline ---------- */
  function renderFlow() {
    const c = counts(RES);
    const pts = POSITIONS.length * 2 + Object.keys(state.fx).length * 2;
    const missing = POSITIONS.filter(p => state.md[p.id].pri == null).length + POSITIONS.filter(p => state.md[p.id].sec == null).length + Object.values(state.fx).reduce((a, f) => a + (f.pri == null) + (f.sec == null), 0);
    const valued = RES.filter(r => r.val).length;
    const hits = RES.reduce((a, r) => a + r.flags.filter(f => f.sev !== 'auto').length, 0);
    const steps = [
      {h:'Capture', p:'Pull vendor files and the FX snapshot; extract positions from the books.', m:`${pts-missing}/${pts} data points`, s:missing?'warn':'ok'},
      {h:'Validate', p:'Schema, completeness and date checks on every record.', m:missing?`${missing} gaps found`:'No gaps', s:missing?'warn':'ok'},
      {h:'Normalise & enrich', p:'Map to one schema; add static data, FX and prior marks.', m:`${POSITIONS.length} records mapped`, s:'ok'},
      {h:'Value', p:'Apply the asset-class formula and translate to USD.', m:`${valued}/${POSITIONS.length} valued`, s:valued<POSITIONS.length?'bad':'ok'},
      {h:'STP controls', p:'Six rules decide which marks release untouched.', m:`STP ${c.rate.toFixed(0)}% · ${hits} hits`, s:c.rate<100?'warn':'ok'},
      {h:'Exceptions', p:'Analyst resolves breaks with a price and a reason.', m:c.open?`${c.open} open · ${c.RESOLVED} resolved`:`Queue clear · ${c.RESOLVED} resolved`, s:c.open?'bad':'ok'},
      {h:'Report & distribute', p:'Valuation, P&L, IPV, margin and control reports.', m:c.open?'DRAFT':'FINAL ready', s:c.open?'warn':'ok'}
    ];
    $('flow').innerHTML = steps.map((x, i) => `<li class="${x.s}" data-i="${i}"><span class="bar"></span><h4>${x.h}</h4><p>${x.p}</p><div class="metric">${x.m}</div></li>`).join('');
    $('navStatus').innerHTML = `<span class="lbl muted">${runId(state)}</span><span class="pill ${c.open?'st-EXCEPTION':'st-STP'}">STP ${c.rate.toFixed(0)}% · ${c.open} open</span>`;
  }

  /* ---------- inputs ---------- */
  function renderScenarios() {
    $('scenarios').innerHTML = '<span class="small muted" style="margin-right:4px">Scenario</span>' +
      Object.entries(SCENARIOS).map(([k, v]) => `<button type="button" class="btn" data-scen="${k}" aria-pressed="${state.scen===k}">${v.label}</button>`).join('');
    $('scenarioDesc').textContent = SCENARIOS[state.scen].desc;
  }

  function renderMarketData() {
    let h = '<thead><tr><th>ID</th><th>Instrument</th><th>Class</th><th class="n">Prior mark</th><th class="n">Primary</th><th>Primary as-of</th><th class="n">Secondary</th><th class="n">Δ vs prior</th><th class="n">Pri vs sec</th></tr></thead><tbody>';
    POSITIONS.forEach(p => {
      const m = state.md[p.id];
      h += `<tr><td class="mono small">${p.id}</td><td>${esc(p.name)}<span class="sub">${esc(p.tk)} · ${p.ccy} · L${p.lvl}</span></td><td>${p.type}</td><td class="n">${pxf(p,p.prior)}</td>
      <td class="inp"><input type="number" step="any" id="pri-${p.id}" data-md="${p.id}" data-f="pri" value="${m.pri??''}" aria-label="${esc(p.name)} primary price"></td>
      <td style="width:140px"><select id="dt-${p.id}" data-md="${p.id}" data-f="asOf" aria-label="${esc(p.name)} primary as-of date">${AS_OF_CHOICES.map(d => `<option value="${d}"${d===m.asOf?' selected':''}>${dmy(d)}</option>`).join('')}</select></td>
      <td class="inp"><input type="number" step="any" id="sec-${p.id}" data-md="${p.id}" data-f="sec" value="${m.sec??''}" aria-label="${esc(p.name)} secondary price"></td>
      <td class="n" id="mv-${p.id}"></td><td class="n" id="va-${p.id}"></td></tr>`;
    });
    $('mdTable').innerHTML = h + '</tbody>';
    let f = '<thead><tr><th>Pair</th><th class="n">Prior</th><th class="n">Primary</th><th class="n">Secondary</th><th class="n">Δ</th></tr></thead><tbody>';
    Object.entries(state.fx).forEach(([c, x]) => {
      f += `<tr><td class="mono">USD/${c}</td><td class="n">${nf(x.prior,4)}</td>
      <td class="inp"><input type="number" step="any" id="fxp-${c}" data-fx="${c}" data-f="pri" value="${x.pri??''}" aria-label="USD/${c} primary"></td>
      <td class="inp"><input type="number" step="any" id="fxs-${c}" data-fx="${c}" data-f="sec" value="${x.sec??''}" aria-label="USD/${c} secondary"></td><td class="n" id="fxd-${c}"></td></tr>`;
    });
    $('fxTable').innerHTML = f + '</tbody>';
  }

  function updateMarketDataComputed() {
    RES.forEach(r => {
      const p = r.p, m = r.md, b = m.pri ?? m.sec;
      const mv = b == null ? null : (b - p.prior) / p.prior * 100;
      $('mv-' + p.id).innerHTML = mv == null ? '—' : `<span class="${Math.abs(mv) > state.rules.move[p.cls] ? 'neg' : ''}">${pct(mv)}</span>`;
      $('va-' + p.id).innerHTML = r.variance == null ? '—' : `<span class="${r.variance > state.rules.tol ? 'neg' : ''}">${r.variance.toFixed(2)}%</span>`;
      $('pri-' + p.id).classList.toggle('missing', m.pri == null);
      $('sec-' + p.id).classList.toggle('missing', m.sec == null);
    });
    Object.entries(state.fx).forEach(([c, x]) => {
      const b = x.pri ?? x.sec;
      $('fxd-' + c).textContent = b == null ? '—' : pct((b - x.prior) / x.prior * 100, 3);
      $('fxp-' + c).classList.toggle('missing', x.pri == null);
      $('fxs-' + c).classList.toggle('missing', x.sec == null);
    });
  }

  /* ---------- lineage ---------- */
  function renderLineageSelect() {
    $('linSel').innerHTML = POSITIONS.map(p => `<option value="${p.id}"${p.id===state.lin?' selected':''}>${p.id} · ${esc(p.name)}</option>`).join('');
  }

  function renderLineage() {
    const r = RES.find(x => x.p.id === state.lin), p = r.p, m = r.md;
    const ymd = s => s.replace(/-/g, '');
    const field = {fu:'SETTLE', bd:'CLEAN_MID', fx:'OUTRIGHT', eq:'LAST'}[p.cls];
    const raw1 = m.pri == null ? '— no record received from primary feed —' : `PRICE|${p.tk}|PX_${field}=${m.pri}\n|PX_DATE=${ymd(m.asOf)}|CRNCY=${p.ccy}\n|SRC=${p.lvl===1?'EXCH':'EVAL'}`;
    const raw2 = m.sec == null ? '— no record from secondary —' : `"${p.tk}",${m.sec},${p.ccy},${VAL_DATE},COMPOSITE`;
    const norm = {instrument_id:p.id, asset_class:p.cls.toUpperCase(), price_type:PRICE_TYPES[p.cls], price:r.px, currency:p.ccy, as_of:(r.src==='SEC'||r.src==='OVR')?VAL_DATE:m.asOf, source:r.src||'NONE', fv_level:'L'+p.lvl};
    const kv = [['Quantity / nominal', nf(p.qty,0)], ['Multiplier', p.mult], ['Prior official mark', pxf(p,p.prior)]];
    if (p.cls === 'bd') kv.push(['Coupon / freq', p.cpn+'% / '+p.freq], ['Day count', p.dc], ['Last → next coupon', p.last.slice(5)+' → '+p.next.slice(5)], ['Accrued today', accrued(p,VAL_DATE).toFixed(5)], ['Accrued prior', accrued(p,PRIOR_DATE).toFixed(5)]);
    if (p.cls === 'fx') kv.push(['Contract rate', pxf(p,p.strike)], ['Maturity', dmy(p.mat)], ['Days to maturity', days(VAL_DATE,p.mat)], [`Discount rate (${p.ccy})`, (p.rate*100).toFixed(2)+'%'], ['Counterparty', p.cpty]);
    if (p.cls === 'fu') kv.push(['Exchange', p.venue]);
    kv.push([`FX today (USD/${p.ccy})`, r.fx.ok ? nf(r.fx.t,4)+' '+(r.fx.src||'') : 'missing'], ['FX prior', nf(r.fx.p ?? 1,4)]);
    const v = r.val;
    const valHtml = v
      ? `<pre>${v.lines.map(esc).join('\n')}</pre><dl class="kv"><dt>Price effect</dt><dd>${pl(v.price)}</dd>${p.cls==='bd'?`<dt>Carry (accrual)</dt><dd>${pl(v.carry)}</dd>`:''}${p.cls==='fu'?`<dt>Variation margin</dt><dd>${pl(v.vm)}</dd>`:`<dt>FX translation</dt><dd>${pl(v.fxe)}</dd>`}<dt><b>Daily P&amp;L USD</b></dt><dd><b>${pl(v.pnl)}</b></dd></dl>`
      : `<div class="flag exc">Cannot value: ${r.px==null?'no usable price':'no FX rate'}.</div>`;
    const fl = r.flags.length ? r.flags.map(f => `<div class="flag ${f.sev}"><b class="mono">${f.rule}</b> ${esc(f.msg)}</div>`).join('') : '<div class="flag pass">All six controls passed.</div>';
    $('lineage').innerHTML = `
      <div class="lin"><span class="tag">a · Raw vendor records</span><span class="small muted">Primary feed (pipe-delimited)</span><pre>${esc(raw1)}</pre><span class="small muted">Secondary feed (CSV)</span><pre>${esc(raw2)}</pre></div>
      <div class="lin"><span class="tag">b · Normalised</span><span class="small muted">One internal schema for every vendor. The source chosen by R1 is recorded.</span><pre>${esc(JSON.stringify(norm,null,1))}</pre></div>
      <div class="lin"><span class="tag">c · Enriched</span><span class="small muted">Static data, FX and prior mark joined on instrument ID.</span><dl class="kv">${kv.map(([a,b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>
      <div class="lin"><span class="tag">d · Valued &amp; controlled</span>${valHtml}<div class="flags">${fl}</div><div><span class="pill st-${r.status}">${r.status}</span></div></div>`;
  }

  /* ---------- rules ---------- */
  function renderRules() {
    const R = state.rules;
    const cfg = {
      R1:`<label class="chk"><input type="checkbox" id="r-fallback" ${R.fallback?'checked':''}> Allow fallback to secondary source</label>`,
      R2:`<div class="params"><label>Max age (business days)<input type="number" id="r-stale" min="0" step="1" value="${R.stale}"></label></div>`,
      R3:`<div class="params"><label>Tolerance %<input type="number" id="r-tol" min="0" step="0.05" value="${R.tol}"></label></div>`,
      R4:`<div class="params">${Object.keys(R.move).map(k => `<label>${CLASS_NAMES[k]} %<input type="number" id="r-mv-${k}" data-mv="${k}" min="0" step="0.5" value="${R.move[k]}"></label>`).join('')}</div>`,
      R5:`<p class="small">Fallback above also applies to FX. With R5 off, missing rates fall back to the prior day.</p>`,
      R6:`<div class="params"><label>Threshold USD<input type="number" id="r-mat" min="0" step="10000" value="${R.mat}"></label></div>`
    };
    $('rules').innerHTML = Object.entries(RULE_META).map(([k, m]) => `<div class="rule"><div class="hd"><h3><span class="code">${k}</span>${m.name}</h3>${k==='R1'?'<span class="pill st-STP">Always on</span>':`<label class="chk small"><input type="checkbox" id="on-${k}" data-on="${k}" ${R.on[k]?'checked':''}> On</label>`}</div><p>${m.desc}</p>${cfg[k]}</div>`).join('');
  }

  function renderControls() {
    const c = counts(RES);
    const seg = [['STP','var(--ok)'],['AUTO','var(--auto)'],['RESOLVED','var(--man)'],['REVIEW','var(--warn)'],['EXCEPTION','var(--bad)']];
    $('meter').innerHTML = `<div><div class="big">${c.rate.toFixed(0)}%</div><div class="small muted">STP rate (${c.STP+c.AUTO} of ${c.n} untouched)</div></div><div class="stack" role="img" aria-label="Status mix">${seg.map(([k,col]) => c[k] ? `<span style="width:${c[k]/c.n*100}%;background:${col}" title="${k} ${c[k]}"></span>` : '').join('')}</div><div class="legend">${seg.map(([k]) => `<span class="pill st-${k}">${k} ${c[k]}</span>`).join('')}</div>`;
    const lab = {pass:'PASS', auto:'FIX', exc:'FAIL', review:'4-EYE', off:'OFF'};
    let h = '<thead><tr><th>Instrument</th><th class="n">Price used</th><th>Src</th>' + Object.keys(RULE_META).map(k => `<th title="${RULE_META[k].name}" style="text-align:center">${k}</th>`).join('') + '<th class="n">P&amp;L USD</th><th>Status</th></tr></thead><tbody>';
    RES.forEach(r => { h += `<tr><td>${esc(r.p.name)}<span class="sub">${r.p.id}</span></td><td class="n">${pxf(r.p,r.px)}</td><td class="mono small">${r.src||'—'}</td>${Object.keys(RULE_META).map(k => `<td class="rc rc-${r.rc[k]}">${lab[r.rc[k]]}</td>`).join('')}<td class="n">${r.val?pl(r.val.pnl):'—'}</td><td><span class="pill st-${r.status}">${r.status}</span></td></tr>`; });
    $('ctlTable').innerHTML = h + '</tbody>';
  }

  /* ---------- exception queue ---------- */
  function renderQueue() {
    const open = RES.filter(r => r.status === 'EXCEPTION' || r.status === 'REVIEW');
    if (!open.length) $('queue').innerHTML = '<div class="empty">Queue clear. Every position is either straight-through or signed off, so reports can be issued as FINAL.</div>';
    else $('queue').innerHTML = open.map(r => {
      const p = r.p, m = r.md;
      const hd = `<div class="hd"><div><h3>${esc(p.name)}</h3><span class="small muted mono">${p.id} · ${esc(p.tk)} · ${p.ccy}</span></div><span class="pill st-${r.status}">${r.status==='REVIEW'?'4-eyes review':'Exception'}</span></div>`;
      const fl = `<div class="flags">${r.flags.filter(f => f.sev !== 'auto').map(f => `<div class="flag ${f.sev}"><b class="mono">${f.rule}</b> ${esc(f.msg)}</div>`).join('')}</div>`;
      if (r.status === 'REVIEW') return `<div class="qcard review">${hd}${fl}<p class="small muted">Price ${pxf(p,r.px)} (${r.src}) passed price controls. Release needs a second approver because of the P&amp;L size.</p><div class="btnrow"><button class="btn primary" type="button" data-approve="${p.id}">Approve release</button></div></div>`;
      const cands = []; if (m.pri != null) cands.push(['Primary', m.pri]); if (m.sec != null) cands.push(['Secondary', m.sec]); cands.push(['Prior close', p.prior]);
      const def = (r.rc.R2 === 'exc' || r.rc.R3 === 'exc') && m.sec != null ? m.sec : (m.pri ?? m.sec ?? p.prior);
      const needFx = !r.fr.ok && !state.ovr['FX:' + p.ccy];
      return `<div class="qcard">${hd}${fl}
        <div class="cands"><span class="small muted" style="align-self:center">Candidates</span>${cands.map(([l,v]) => `<button type="button" class="btn" data-cand="${p.id}" data-v="${v}">${l} ${pxf(p,v)}</button>`).join('')}</div>
        <div class="form"><label>Price to release<input type="number" step="any" id="q-px-${p.id}" value="${def}"></label>
        ${needFx?`<label>USD/${p.ccy} rate<input type="number" step="any" id="q-fx-${p.id}" value="${state.fx[p.ccy].prior}"></label>`:''}
        <label>Reason<select id="q-rs-${p.id}">${RESOLUTION_REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <div><button class="btn primary" type="button" data-resolve="${p.id}" style="width:100%">Accept &amp; release</button></div></div></div>`;
    }).join('');
    const done = RES.filter(r => r.status === 'RESOLVED');
    $('resolvedList').innerHTML = done.length ? `<h3 style="margin-bottom:8px">Resolved this run</h3><div class="well"><table><thead><tr><th>Instrument</th><th>Action</th><th class="n">Price</th><th>Reason</th><th>By</th><th></th></tr></thead><tbody>${done.map(r => `<tr><td>${esc(r.p.name)}<span class="sub">${r.p.id}</span></td><td>${r.o.px!=null?'Price override':'4-eyes approval'}</td><td class="n">${pxf(r.p,r.px)}</td><td class="small">${esc(r.o.reason||'Approved within policy')}</td><td class="small">${esc(r.o.by)}<span class="sub">${r.o.at}</span></td><td><button class="btn" type="button" data-undo="${r.p.id}">Undo</button></td></tr>`).join('')}</tbody></table></div>` : '';
  }

  /* ---------- reports ---------- */
  function renderTemplates() {
    $('tpls').innerHTML = REPORTS.map(t => `<button type="button" class="tpl" data-tpl="${t.key}" aria-pressed="${state.report===t.key}"><span class="code">${t.code}</span><b>${t.title}</b><span class="d">${t.desc}</span></button>`).join('');
  }

  function renderReport() {
    const t = reportByKey(state.report), c = counts(RES), final = !c.open;
    const out = t.build({results:RES, state, counts:c});
    CSV = out.csv;
    $('paper').innerHTML = `<div class="phead"><div><div class="eyebrow">${t.code} · ${esc(FUND)}</div><h3>${t.title} report</h3></div><div class="stamp ${final?'final':'draft'}">${final?'FINAL':'DRAFT · '+c.open+' OPEN'}</div></div>
      <div class="meta"><div><span>Valuation date</span><b>${dmy(VAL_DATE)}</b></div><div><span>Prior date</span><b>${dmy(PRIOR_DATE)}</b></div><div><span>Base currency</span><b>USD</b></div><div><span>Run ID</span><b>${runId(state)}</b></div><div><span>Generated</span><b>${sgt(state.runAt)}</b></div><div><span>Pricing policy</span><b>VP-2026.2 · Asia close</b></div></div>
      <div class="pbody">${out.html}</div>
      <div class="pfoot"><div><div class="sign">Prepared by: Valuation Control (system)</div></div><div><div class="sign">Reviewed by: ____________________</div></div><div><div class="sign">Distribution: Finance, Risk, Fund Administrator${t.key==='margin'?', Collateral Ops':''}</div></div></div>`;
    $('genNote').textContent = `${t.code} · ${runId(state)} · ${final?'FINAL':'DRAFT'}`;
  }

  /* ---------- orchestration ---------- */
  function refresh() {
    RES = runAll(state);
    renderTicket(); renderFlow(); updateMarketDataComputed(); renderLineage(); renderControls(); renderQueue(); renderReport();
  }

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function runBatch() {
    state.run++; state.runAt = new Date(); refresh();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = [...document.querySelectorAll('#flow li')];
    if (!reduce) items.forEach((li, i) => setTimeout(() => {
      items.forEach(x => x.classList.remove('live')); li.classList.add('live');
      if (i === items.length - 1) setTimeout(() => li.classList.remove('live'), 500);
    }, i * 220));
    toast('EOD batch complete · ' + runId(state));
  }

  function copyCsv() {
    const ta = $('csvFallback');
    const fallback = () => { ta.hidden = false; ta.value = CSV; ta.focus(); ta.select(); toast('Clipboard blocked; CSV selected below'); };
    try { navigator.clipboard.writeText(CSV).then(() => { ta.hidden = true; toast('CSV copied to clipboard'); }, fallback); }
    catch { fallback(); }
  }

  document.addEventListener('change', e => {
    const el = e.target, R = state.rules;
    if (el.dataset.md) { const id = el.dataset.md, f = el.dataset.f; state.md[id][f] = f === 'asOf' ? el.value : num(el.value); delete state.ovr[id]; refresh(); return; }
    if (el.dataset.fx) { const c = el.dataset.fx; state.fx[c][el.dataset.f] = num(el.value); delete state.ovr['FX:' + c]; refresh(); return; }
    if (el.id === 'r-fallback') { R.fallback = el.checked; refresh(); return; }
    if (el.id === 'r-stale') { R.stale = Math.max(0, parseInt(el.value) || 0); refresh(); return; }
    if (el.id === 'r-tol') { R.tol = Math.max(0, num(el.value) ?? 0); refresh(); return; }
    if (el.id === 'r-mat') { R.mat = Math.max(0, num(el.value) ?? 0); refresh(); return; }
    if (el.dataset.mv) { R.move[el.dataset.mv] = Math.max(0, num(el.value) ?? 0); refresh(); return; }
    if (el.dataset.on) { R.on[el.dataset.on] = el.checked; refresh(); return; }
    if (el.id === 'linSel') { state.lin = el.value; renderLineage(); }
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.scen) { loadScenario(state, b.dataset.scen); renderScenarios(); renderMarketData(); refresh(); toast(SCENARIOS[state.scen].label + ' loaded'); return; }
    if (b.dataset.cand) { $('q-px-' + b.dataset.cand).value = b.dataset.v; return; }
    if (b.dataset.resolve) {
      const id = b.dataset.resolve, p = BY_ID[id], px = num($('q-px-' + id).value);
      if (px == null || px <= 0) { toast('Enter a positive price to release'); return; }
      const fxEl = $('q-fx-' + id);
      if (fxEl) { const fx = num(fxEl.value); if (fx == null || fx <= 0) { toast('Enter a USD/' + p.ccy + ' rate'); return; } state.ovr['FX:' + p.ccy] = {fx}; }
      state.ovr[id] = {px, reason:$('q-rs-' + id).value, by:'Valuation analyst', at:sgt(new Date()).slice(12, 20)};
      refresh(); toast(id + ' released'); return;
    }
    if (b.dataset.approve) { const id = b.dataset.approve; state.ovr[id] = {...(state.ovr[id] || {}), approved:true, by:'Head of valuation', reason:'Approved by second reviewer', at:sgt(new Date()).slice(12, 20)}; refresh(); toast(id + ' approved'); return; }
    if (b.dataset.undo) {
      const id = b.dataset.undo, p = BY_ID[id];
      delete state.ovr[id];
      if (!RES.some(r => r.p.ccy === p.ccy && r.p.id !== id && state.ovr[r.p.id]?.px != null)) delete state.ovr['FX:' + p.ccy];
      refresh(); return;
    }
    if (b.dataset.tpl) { state.report = b.dataset.tpl; renderTemplates(); renderReport(); return; }
    if (b.id === 'genBtn') { state.run++; state.runAt = new Date(); refresh(); toast('Report generated · ' + runId(state)); return; }
    if (b.id === 'runBtn') { runBatch(); return; }
    if (b.id === 'csvBtn') { copyCsv(); }
  });

  renderScenarios(); renderMarketData(); renderLineageSelect(); renderRules(); renderTemplates(); refresh();
}
