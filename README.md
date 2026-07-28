# Comb Sort Market Visualizer

Comb Sort Market Visualizer is an educational project that shows how a from-scratch Python comb sort reorders stocks by their 30-trading-day percentage return. Python prepares the data and records each comparison; the static website replays that sequence for GitHub Pages.

![Screenshot placeholder](./assets/favicon.svg)

## What it does

- Fetches daily stock data from Alpha Vantage with a local Python script.
- Calculates each stock's latest 30-trading-day percentage return.
- Runs comb sort without using Python's built-in sort implementation inside the algorithm.
- Records every comparison and swap for browser playback.
- Serves a static HTML, CSS, and JavaScript interface suitable for GitHub Pages.

## How comb sort works

Comb sort starts with a large comparison gap instead of only comparing neighbors. On each pass, the gap shrinks by a factor of `1.3` until it reaches `1`. That lets far-out-of-place values move much more quickly than they would in bubble sort. The final gap-1 pass behaves like a bubble-sort cleanup pass.

## Data source and metric

- Source: Alpha Vantage Daily Time Series API
- Metric: latest 30-trading-day percentage return
- Formula: `((end_close - start_close) / start_close) * 100`

The repository includes a development fixture in [data/stocks.json](C:/Users/hp/Documents/Codex/2026-07-28/claude-couldnt-finish-a-project-i/data/stocks.json) so the site runs immediately after cloning.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create an Alpha Vantage API key at [alphavantage.co](https://www.alphavantage.co/support/#api-key), then set it locally:

```powershell
$env:ALPHA_VANTAGE_API_KEY="your_key_here"
```

The API key must stay local. It should never be committed, written into JSON, or exposed in browser code.

## Run the data pipeline

```powershell
python -m src.fetch_data
```

This writes:

- `data/stocks.json`
- `data/sort_steps.json`
- `data/sorted_results.json`

## Run tests

```powershell
pytest
```

## Preview the static site

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

Use a local HTTP server instead of opening `index.html` with a `file://` URL because the browser needs to fetch local JSON files.

## Deploy with GitHub Pages

1. Push the repository to GitHub.
2. In the repository settings, enable GitHub Pages from the main branch and root directory.
3. Keep `index.html` at the repository root and use relative asset paths such as `./data/stocks.json`.

## Disclaimer

This project is for education only and is not investment advice.

