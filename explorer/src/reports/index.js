// Report registry. To add a report: create a module exporting {key, code, title, desc, build(ctx)}
// where build returns {html, csv}, then add it to this array. The UI picks it up automatically.
// ctx = {results, state, counts}

import valuation from './valuation.js';
import pnl from './pnl.js';
import ipv from './ipv.js';
import margin from './margin.js';
import stp from './stp.js';

export const REPORTS = [valuation, pnl, ipv, margin, stp];
export const reportByKey = k => REPORTS.find(r => r.key === k);
