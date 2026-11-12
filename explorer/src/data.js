// Reference data for the sample book. Everything here is illustrative, not market data.
// To add an instrument: add it to POSITIONS and BASE_MARKET_DATA (same id). Use an existing `cls`,
// or add a new asset class in engine.js (valuate) and CLASS_NAMES / PRICE_TYPES / DEFAULT_RULES.move.

export const VAL_DATE = '2026-10-16';
export const PRIOR_DATE = '2026-10-15';
export const BASE_CCY = 'USD';
export const FUND = 'Meridian Asia Multi-Asset Fund';

/**
 * cls: eq | bd | fu | fx
 * qty: shares, nominal (bonds), lots (futures) or USD notional (FX forwards)
 * prior: yesterday's signed-off official mark
 * dp: decimals used when displaying prices
 * lvl: IFRS 13 fair value level
 */
export const POSITIONS = [
  {id:'EQ-001',cls:'eq',type:'Equity',book:'APAC Equities',name:'DBS Group Holdings',tk:'D05 SP Equity',ccy:'SGD',qty:50000,mult:1,prior:38.20,dp:2,lvl:1,venue:'SGX'},
  {id:'EQ-002',cls:'eq',type:'Equity',book:'APAC Equities',name:'Tencent Holdings',tk:'700 HK Equity',ccy:'HKD',qty:20000,mult:1,prior:512.00,dp:2,lvl:1,venue:'HKEX'},
  {id:'EQ-003',cls:'eq',type:'Equity',book:'APAC Equities',name:'Toyota Motor',tk:'7203 JT Equity',ccy:'JPY',qty:30000,mult:1,prior:2840,dp:1,lvl:1,venue:'TSE'},
  {id:'GB-001',cls:'bd',type:'Govt bond',book:'Rates',name:'UST 4.25% 15-Aug-2035',tk:'T 4.25 08/15/35',ccy:'USD',qty:10000000,mult:1,prior:98.150,dp:3,lvl:1,cpn:4.25,freq:2,last:'2026-08-15',next:'2027-02-15',dc:'ACT/ACT'},
  {id:'GB-002',cls:'bd',type:'Govt bond',book:'Rates',name:'SGS 3.00% 01-Sep-2033',tk:'SIGB 3 09/01/33',ccy:'SGD',qty:5000000,mult:1,prior:101.200,dp:3,lvl:1,cpn:3.00,freq:2,last:'2026-09-01',next:'2027-03-01',dc:'ACT/ACT'},
  {id:'CB-001',cls:'bd',type:'Corp bond',book:'Rates',name:'Harbourline Corp 5.50% 2029',tk:'HBLN 5.5 01/15/29',ccy:'USD',qty:2000000,mult:1,prior:97.400,dp:3,lvl:2,cpn:5.50,freq:2,last:'2026-07-15',next:'2027-01-15',dc:'30/360'},
  {id:'FU-001',cls:'fu',type:'Index future',book:'Index Futures',name:'Hang Seng Index Oct-26',tk:'HIV6 Index',ccy:'HKD',qty:10,mult:50,prior:26100,dp:0,lvl:1,venue:'HKFE'},
  {id:'FU-002',cls:'fu',type:'Index future',book:'Index Futures',name:'FTSE China A50 Oct-26',tk:'XUV6 Index',ccy:'USD',qty:-25,mult:1,prior:13850,dp:0,lvl:1,venue:'SGX'},
  {id:'FX-001',cls:'fx',type:'FX forward',book:'FX Hedging',name:'Buy USD 25m / Sell SGD',tk:'USDSGD 15-Jan-27',ccy:'SGD',qty:25000000,mult:1,dir:1,strike:1.2950,mat:'2027-01-15',prior:1.2905,dp:4,lvl:2,rate:0.020,cpty:'Bank Alpha'},
  {id:'FX-002',cls:'fx',type:'FX forward',book:'FX Hedging',name:'Sell USD 20m / Buy JPY',tk:'USDJPY 15-Jan-27',ccy:'JPY',qty:20000000,mult:1,dir:-1,strike:152.10,mat:'2027-01-15',prior:148.85,dp:2,lvl:2,rate:0.0075,cpty:'Bank Alpha'}
];
export const BY_ID = Object.fromEntries(POSITIONS.map(p => [p.id, p]));

export const CLASS_NAMES = {eq:'Equities', bd:'Bonds', fu:'Futures', fx:'FX forwards'};
export const PRICE_TYPES = {eq:'CLOSE', bd:'CLEAN_PCT_PAR', fu:'SETTLEMENT', fx:'FWD_OUTRIGHT'};

/** Vendor prices for the "Typical night" scenario. pri = primary vendor, sec = secondary, asOf = primary price date. */
export const BASE_MARKET_DATA = {
  'EQ-001':{pri:38.65,sec:38.64,asOf:VAL_DATE},
  'EQ-002':{pri:505.50,sec:505.20,asOf:VAL_DATE},
  'EQ-003':{pri:null,sec:2872,asOf:VAL_DATE},
  'GB-001':{pri:98.420,sec:98.400,asOf:VAL_DATE},
  'GB-002':{pri:101.050,sec:101.080,asOf:VAL_DATE},
  'CB-001':{pri:97.400,sec:96.700,asOf:'2026-10-14'},
  'FU-001':{pri:26350,sec:26350,asOf:VAL_DATE},
  'FU-002':{pri:13920,sec:13921,asOf:VAL_DATE},
  'FX-001':{pri:1.2930,sec:1.2931,asOf:VAL_DATE},
  'FX-002':{pri:149.40,sec:149.42,asOf:VAL_DATE}
};
/** FX quoted as units of currency per 1 USD. */
export const BASE_FX = {
  SGD:{pri:1.2990,sec:1.2991,prior:1.2965},
  HKD:{pri:7.7720,sec:7.7718,prior:7.7735},
  JPY:{pri:150.40,sec:150.38,prior:149.85}
};

const cleanFixes = md => { md['EQ-003'].pri = 2872; md['CB-001'] = {pri:96.720, sec:96.700, asOf:VAL_DATE}; };

/** Each scenario mutates a fresh copy of BASE_MARKET_DATA / BASE_FX. */
export const SCENARIOS = {
  typical:{label:'Typical night', desc:'One feed gap that the fallback rule fixes automatically (Toyota), and one stale evaluated corporate bond that disagrees with the secondary source.', apply:() => {}},
  clean:{label:'Clean night', desc:'Every price present, current and in tolerance. Everything flows straight through.', apply:md => cleanFixes(md)},
  spike:{label:'Price spike', desc:'Tencent prints 11% lower on a profit warning. The move breaches the equity limit and the P&L breaches materiality.', apply:md => { cleanFixes(md); md['EQ-002'] = {pri:455.00, sec:455.40, asOf:VAL_DATE}; }},
  mismatch:{label:'Vendor mismatch', desc:'The secondary vendor marks the 10-year UST 0.8 points lower than primary. Independent price verification fails.', apply:md => { cleanFixes(md); md['GB-001'].sec = 97.600; }},
  fxgap:{label:'FX feed down', desc:'No USD/JPY rate from either source. Every JPY position is blocked until an analyst supplies a rate.', apply:(md, fx) => { cleanFixes(md); fx.JPY.pri = null; fx.JPY.sec = null; }}
};

export const RULE_META = {
  R1:{name:'Completeness', desc:'Every position needs a price. If the primary vendor is missing, fall back to the secondary source.'},
  R2:{name:'Staleness', desc:'The primary price must be dated within N business days of the valuation date.'},
  R3:{name:'Source variance (IPV)', desc:'Primary and secondary prices must agree within tolerance.'},
  R4:{name:'Day-on-day move', desc:'Moves versus the prior official mark must stay within the asset-class limit.'},
  R5:{name:'FX availability', desc:'Each non-USD position needs a USD rate to translate into base currency.'},
  R6:{name:'Materiality (4-eyes)', desc:'Daily P&L above the threshold needs a second approver before release.'}
};

export const DEFAULT_RULES = {
  on:{R2:true, R3:true, R4:true, R5:true, R6:true},
  fallback:true,   // R1/R5: use secondary source when primary is missing
  stale:1,         // R2: max business days old
  tol:0.50,        // R3: % difference primary vs secondary
  move:{eq:8, bd:2, fu:8, fx:1.5}, // R4: % day-on-day limit per class
  mat:100000       // R6: USD P&L threshold for 4-eyes
};

export const RESOLUTION_REASONS = [
  'Stale vendor price challenged; secondary accepted',
  'Market move confirmed against news and exchange tape',
  'Vendor error confirmed with data provider',
  'Prior close carried pending vendor correction',
  'Manual FX rate from WM/Reuters fix',
  'Trader mark accepted after IPV review'
];

/** CSA terms for the bilateral margin report. */
export const CSA = {cpty:'Bank Alpha', independentAmount:0, threshold:0, mta:250000, rounding:10000, collateralHeld:50000};

export const AS_OF_CHOICES = ['2026-10-16','2026-10-15','2026-10-14','2026-10-13','2026-10-12'];
