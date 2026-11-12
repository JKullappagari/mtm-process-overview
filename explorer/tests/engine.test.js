import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID, VAL_DATE} from '../src/data.js';
import {createState, loadScenario} from '../src/state.js';
import {runAll, counts, evaluate, valuate, accrued, bizDays, days360} from '../src/engine.js';
import {csaCall} from '../src/reports/margin.js';
import {REPORTS} from '../src/reports/index.js';

const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const statusOf = (state, id) => runAll(state).find(r => r.p.id === id).status;

test('day counts', () => {
  assert.equal(bizDays('2026-10-14', VAL_DATE), 2);
  assert.equal(bizDays('2026-10-09', '2026-10-12'), 1); // Fri -> Mon
  assert.equal(days360('2026-07-15', '2026-10-16'), 91);
});

test('equity MTM matches the worked example', () => {
  const v = valuate(BY_ID['EQ-001'], 38.65, {t:1.2990, p:1.2965});
  near(v.price, 50000 * 0.45 / 1.2990, 0.01);  // USD 17,321
  near(v.mvB, 50000 * 38.65 / 1.2990, 0.01);
});

test('bond accrued interest and carry', () => {
  const ust = BY_ID['GB-001'];
  near(accrued(ust, VAL_DATE), 4.25 / 2 * 62 / 184, 1e-9);           // ACT/ACT
  near(accrued(BY_ID['CB-001'], VAL_DATE), 5.5 / 2 * 91 / 180, 1e-9); // 30/360
  const v = valuate(ust, 98.42, {t:1, p:1});
  near(v.carry, 1e7 * 4.25 / 2 / 184 / 100, 0.01); // one day of accrual
  assert.equal(v.fxe, 0);
});

test('futures carry zero MV and pay variation margin', () => {
  const v = valuate(BY_ID['FU-001'], 26350, {t:7.772, p:7.7735});
  assert.equal(v.mvB, 0);
  near(v.vmL, 10 * 50 * 250, 1e-9);
  near(v.pnl, v.vm, 1e-9);
});

test('P&L components add up for every position', () => {
  runAll(createState()).filter(r => r.val).forEach(r =>
    near(r.val.pnl, r.val.price + r.val.carry + r.val.fxe + r.val.vm, 1e-6));
});

test('scenario STP outcomes', () => {
  const s = createState('typical');
  assert.equal(statusOf(s, 'EQ-003'), 'AUTO');       // secondary fallback
  assert.equal(statusOf(s, 'CB-001'), 'EXCEPTION');  // stale + variance
  loadScenario(s, 'clean');
  assert.equal(counts(runAll(s)).rate, 100);
  loadScenario(s, 'spike');
  const r = evaluate(BY_ID['EQ-002'], s);
  assert.equal(r.rc.R4, 'exc');
  loadScenario(s, 'fxgap');
  assert.equal(statusOf(s, 'EQ-003'), 'EXCEPTION');
  assert.equal(statusOf(s, 'FX-002'), 'EXCEPTION');
});

test('analyst override resolves an exception', () => {
  const s = createState('typical');
  s.ovr['CB-001'] = {px:96.70, reason:'test', by:'t', at:'t'};
  assert.equal(statusOf(s, 'CB-001'), 'RESOLVED');
});

test('disabling fallback turns the Toyota gap into an exception', () => {
  const s = createState('typical');
  s.rules.fallback = false;
  assert.equal(statusOf(s, 'EQ-003'), 'EXCEPTION');
});

test('CSA call rounding and MTA', () => {
  assert.deepEqual(csaCall(321388).amt, 280000);  // 271,388 needed, rounds up
  assert.equal(csaCall(100000).amt, 0);           // within MTA
  assert.equal(csaCall(-600000).amt, 600000);     // inbound call
});

test('every report builds html and csv in every scenario', () => {
  for (const k of ['typical','clean','spike','mismatch','fxgap']) {
    const s = createState(k), results = runAll(s), c = counts(results);
    for (const rep of REPORTS) {
      const out = rep.build({results, state:s, counts:c});
      assert.ok(out.html.length > 100, `${rep.key}/${k} html`);
      assert.ok(out.csv.split('\n')[0].includes(','), `${rep.key}/${k} csv header`);
    }
  }
});
