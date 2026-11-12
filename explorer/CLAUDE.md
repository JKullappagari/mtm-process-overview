# MTM Process Explorer

Interactive, single-page explainer for the end-of-day mark-to-market (MTM) process. It walks a sample APAC multi-asset fund through: market data inputs → normalise/enrich → valuation → STP controls → exception queue → standard MTM reports. Audience: client support, ops and valuation teams learning or demoing the flow.

Plain HTML/CSS/JS with native ES modules. No framework and no runtime dependencies. esbuild is only used by `npm run build`.

## Commands
- `npm install` installs esbuild (only needed for build)
- `npm start` runs a local server at http://localhost:5173. Opening index.html straight from disk does **not** work because ES modules need http.
- `npm test` runs the engine/report unit tests (node:test, no deps)
- `npm run build` writes `dist/mtm-explorer.html` (artifact-ready, no html/head/body skeleton) and `dist/mtm-explorer.standalone.html` (opens from disk)

Run `npm test` after any change to `src/engine.js`, `src/data.js` or `src/reports/`.

## Layout
```
index.html            Page markup: static sections; JS fills the elements with ids
src/data.js           Reference data: positions, vendor prices, FX, scenarios, rule defaults, CSA terms
src/format.js         Pure display helpers (number/date formatting, CSV)
src/engine.js         Pure valuation + STP control logic. No DOM. Everything takes `state`
src/state.js          createState / loadScenario / runId
src/reports/*.js      One module per report; index.js is the registry
src/ui.js             All DOM rendering and event handling (mountApp)
src/main.js           Entry point
src/styles.css        All styling, built on design tokens in :root (light + dark)
src/base.css          Mirror of the artifact host's reset (dev only, excluded from artifact build)
scripts/serve.mjs     Dev server
scripts/build.mjs     Single-file bundler
tests/                node:test unit tests
```

## Data flow
`state` (market data, FX, rules, analyst overrides) → `runAll(state)` → one result per position `{p, px, src, fx, val, flags, rc, status, ...}` → UI sections and `report.build({results, state, counts})` → `{html, csv}`.

Statuses: `STP` (clean), `AUTO` (auto-remediated, still STP), `REVIEW` (4-eyes), `EXCEPTION` (failed a control), `RESOLVED` (analyst action). STP rate = (STP + AUTO) / positions.

Controls (engine.js `evaluate`): R1 completeness/fallback, R2 staleness, R3 primary vs secondary variance (IPV), R4 day-on-day move per asset class, R5 FX availability, R6 materiality 4-eyes.

## Extension recipes
- **New instrument:** add to `POSITIONS` and `BASE_MARKET_DATA` in data.js (same id). Add its currency to `BASE_FX` if new.
- **New asset class:** add a branch in `valuate()` (it must set mvL, mvB, expB, price/carry/fxe/vm, lines), then add an entry to `CLASS_NAMES`, `PRICE_TYPES` and `DEFAULT_RULES.move`. Add a test.
- **New STP rule:** add to `RULE_META` and `DEFAULT_RULES.on`. Implement it in `evaluate()` and set `rc.Rn` plus a flag. Add its config UI in `renderRules()` in ui.js.
- **New scenario:** add to `SCENARIOS` in data.js. `apply(md, fx)` mutates fresh copies.
- **New report:** create `src/reports/<name>.js` exporting `{key, code, title, desc, build(ctx)}` and register it in `src/reports/index.js`.

## Conventions
- Keep engine and reports free of DOM access so they stay testable in Node.
- FX is quoted as units of currency per 1 USD. Base currency is USD.
- Prices: equities close, bonds clean % of par (MV uses dirty), futures settlement, FX forwards outright.
- Colors only through CSS tokens in `:root`. Every token must also be redefined in both dark-mode blocks.
- Sample data is fictional (fund, counterparty, corporate issuer). Don't add real client names.
- Formulas are deliberately simplified (no holiday calendars, coupon cash flows, settlement lags or CSA interest). Note any simplification you add in the page footer or report notes.

## Publishing
The public page is served by GitHub Pages straight from this folder (no build): https://jkullappagari.github.io/mtm-process-overview/explorer/. Push to `main` to update it. The companion written overview is `../index.html`.

A private copy also exists as a claude.ai artifact (https://claude.ai/artifact/2KKmcY3ZRmRN8Z1HSUaxPD). To update that one, run `npm run build` and publish `dist/mtm-explorer.html` to the same artifact.
