# Project Handoff

This repository implements the Comb Sort Market Visualizer as a static-site plus Python data pipeline project.

## Architecture

- `src/config.py`: stock universe, sectors, lookback window, API settings, and comb-sort constants
- `src/comb_sort.py`: manual comb sort implementation with step recording and run statistics
- `src/fetch_data.py`: Alpha Vantage fetch pipeline and JSON writer for the frontend
- `data/`: prepared stock fixture plus generated step and ranking outputs
- `index.html`, `css/styles.css`, `js/app.js`: static frontend for replaying the recorded sort
- `tests/`: pytest coverage for comb-sort behavior and data-processing helpers

## Data flow

1. Python fetches or reads stock data.
2. The return metric is computed from the latest 30 trading sessions.
3. Records are shuffled deterministically for a reproducible unsorted order.
4. Comb sort runs and records snapshots after each comparison.
5. The frontend loads prepared JSON and animates the recorded sequence.

## Notes

- The browser never uses the Alpha Vantage API key.
- The bundled fixture lets the repository run without live API access.
- The website is built to work from relative paths so it can deploy on GitHub Pages.

