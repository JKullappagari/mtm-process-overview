# MTM Process Overview & Explorer

Two pages about the end-of-day mark-to-market (MTM) process, both published with GitHub Pages from the `main` branch:

| Page | Live URL | Source |
|---|---|---|
| **Process overview**: a high-level written reference covering inputs, normalise/enrich, valuation, STP controls (R1–R6), exceptions, reports and margin calls | https://jkullappagari.github.io/mtm-process-overview/ | `index.html` |
| **Interactive explorer**: run the nightly batch on a sample book, switch scenarios, tune STP thresholds, work the exception queue and export the reports | https://jkullappagari.github.io/mtm-process-overview/explorer/ | `explorer/` |

Neither page needs a build step. The explorer is plain HTML/CSS/JS using native ES modules, so Pages serves its source directly. See [`explorer/README.md`](explorer/README.md) and [`explorer/CLAUDE.md`](explorer/CLAUDE.md) to run it locally, run the tests, or extend it.

All data and names are fictional and for illustration only.
