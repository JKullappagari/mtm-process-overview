# MTM Process Explorer

An interactive walkthrough of the end-of-day mark-to-market cycle for a sample multi-asset fund:

1. **Inputs**: positions plus primary/secondary vendor prices and FX, with five scenarios to load
2. **Transform**: raw vendor record → normalised → enriched → valued, traced for any instrument
3. **STP rules**: six controls with adjustable thresholds and a live STP rate
4. **Exceptions**: analyst queue to release a price with a reason, or give 4-eyes approval
5. **Reports**: daily MTM valuation, P&L attribution, price exceptions & IPV, margin call (CSA & ETD), STP control summary, each exportable as CSV

## Run it
```bash
npm install     # only needed for the build step
npm start       # http://localhost:5173
npm test
npm run build   # dist/mtm-explorer.html and dist/mtm-explorer.standalone.html
```

All data is illustrative. See `CLAUDE.md` for architecture and how to extend it.
