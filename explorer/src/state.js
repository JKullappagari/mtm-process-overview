// App state. One plain object, mutated by ui.js event handlers, read by engine/reports.

import {BASE_MARKET_DATA, BASE_FX, SCENARIOS, DEFAULT_RULES} from './data.js';

const clone = o => JSON.parse(JSON.stringify(o));

/**
 * state = {
 *   scen:   active scenario key
 *   md:     {id: {pri, sec, asOf}}       editable market data
 *   fx:     {ccy: {pri, sec, prior}}     editable FX
 *   ovr:    {id: {px, reason, by, at, approved}} and {'FX:ccy': {fx}}  analyst actions
 *   rules:  thresholds (see DEFAULT_RULES)
 *   run:    run counter, runAt: Date of last run
 *   report: selected report key, lin: instrument shown in lineage
 * }
 */
export function createState(scenario = 'typical') {
  const s = {rules:clone(DEFAULT_RULES), run:1, runAt:new Date(), report:'valuation', lin:'GB-001'};
  loadScenario(s, scenario);
  return s;
}

/** Reset market data, FX and analyst overrides to a scenario. Rules are kept. */
export function loadScenario(state, key) {
  if (!SCENARIOS[key]) throw new Error(`Unknown scenario "${key}"`);
  state.scen = key;
  state.md = clone(BASE_MARKET_DATA);
  state.fx = clone(BASE_FX);
  SCENARIOS[key].apply(state.md, state.fx);
  state.ovr = {};
  return state;
}

export const runId = state => 'MTM-20261016-' + String(state.run).padStart(4, '0');
