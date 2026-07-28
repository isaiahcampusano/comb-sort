"""
Data-preparation pipeline for the Comb Sort Market Visualizer.

Run as:

    python -m src.fetch_data
"""

from __future__ import annotations

import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .comb_sort import comb_sort
from .config import (
    ALPHA_VANTAGE_BASE_URL,
    ALPHA_VANTAGE_FUNCTION,
    ALPHA_VANTAGE_OUTPUT_SIZE,
    DEFAULT_REQUEST_DELAY_SECONDS,
    LOOKBACK_SESSIONS,
    SECTORS,
    SHUFFLE_SEED,
    STOCKS,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"


class FetchWarning(Exception):
    """Raised for a per-ticker problem that should be logged and skipped."""


def _request_delay_seconds() -> float:
    """Delay between Alpha Vantage requests."""
    raw = os.environ.get("ALPHA_VANTAGE_REQUEST_DELAY_SECONDS")
    if raw is None:
        return DEFAULT_REQUEST_DELAY_SECONDS
    try:
        return max(0.0, float(raw))
    except ValueError:
        return DEFAULT_REQUEST_DELAY_SECONDS


def fetch_daily_series(ticker: str, api_key: str) -> dict[str, Any]:
    """Call the Alpha Vantage TIME_SERIES_DAILY endpoint for one ticker."""
    params = {
        "function": ALPHA_VANTAGE_FUNCTION,
        "symbol": ticker,
        "outputsize": ALPHA_VANTAGE_OUTPUT_SIZE,
        "apikey": api_key,
    }
    url = f"{ALPHA_VANTAGE_BASE_URL}?{urllib.parse.urlencode(params)}"

    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise FetchWarning(f"{ticker}: network error contacting Alpha Vantage ({exc})") from exc
    except json.JSONDecodeError as exc:
        raise FetchWarning(f"{ticker}: response was not valid JSON ({exc})") from exc

    if "Note" in payload:
        raise FetchWarning(f"{ticker}: rate limited by Alpha Vantage ({payload['Note']})")
    if "Information" in payload:
        raise FetchWarning(f"{ticker}: Alpha Vantage info/error message ({payload['Information']})")
    if "Error Message" in payload:
        raise FetchWarning(f"{ticker}: unknown symbol or bad request ({payload['Error Message']})")
    if "Time Series (Daily)" not in payload:
        raise FetchWarning(f"{ticker}: malformed response, missing daily time series")

    return payload


def compute_return(ticker: str, company: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Turn a raw Alpha Vantage payload into one stock record."""
    if "Time Series (Daily)" not in payload:
        raise FetchWarning(f"{ticker}: malformed response, missing daily time series")

    series: dict[str, dict[str, str]] = payload["Time Series (Daily)"]

    try:
        rows = sorted(
            ((date, float(values["4. close"])) for date, values in series.items()),
            key=lambda row: row[0],
        )
    except (KeyError, ValueError) as exc:
        raise FetchWarning(f"{ticker}: malformed daily close data ({exc})") from exc

    if len(rows) < LOOKBACK_SESSIONS:
        raise FetchWarning(
            f"{ticker}: only {len(rows)} trading sessions available, "
            f"need at least {LOOKBACK_SESSIONS}"
        )

    window = rows[-LOOKBACK_SESSIONS:]
    start_date, start_close = window[0]
    end_date, end_close = window[-1]

    if start_close == 0:
        raise FetchWarning(f"{ticker}: starting close is zero, cannot compute a return")

    return_pct = ((end_close - start_close) / start_close) * 100

    return {
        "ticker": ticker,
        "company": company,
        "sector": SECTORS.get(ticker, "Unknown"),
        "start_date": start_date,
        "end_date": end_date,
        "start_close": round(start_close, 2),
        "end_close": round(end_close, 2),
        "return_pct": return_pct,
    }


def build_stock_records(api_key: str, warnings: list[str]) -> list[dict[str, Any]]:
    """Fetch and process configured stock records."""
    records: list[dict[str, Any]] = []
    delay = _request_delay_seconds()
    tickers = list(STOCKS.items())

    for index, (ticker, company) in enumerate(tickers):
        try:
            payload = fetch_daily_series(ticker, api_key)
            record = compute_return(ticker, company, payload)
            records.append(record)
            print(f"  [{index + 1}/{len(tickers)}] {ticker}: {record['return_pct']:.2f}%")
        except FetchWarning as warning:
            print(f"  [{index + 1}/{len(tickers)}] SKIPPED - {warning}")
            warnings.append(str(warning))

        if index < len(tickers) - 1 and delay > 0:
            time.sleep(delay)

    return records


def write_json(path: Path, payload: Any) -> None:
    """Write JSON with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def write_visualizer_outputs(records: list[dict[str, Any]], warnings: list[str]) -> dict[str, Any]:
    """Write the three JSON files used by the static site."""
    stocks_payload = {
        "metadata": {
            "source": "Alpha Vantage TIME_SERIES_DAILY",
            "metric": f"{LOOKBACK_SESSIONS}-trading-day percentage return",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "sort_direction": "descending",
            "disclaimer": "Educational demonstration only; not investment advice.",
            "warnings": warnings,
        },
        "stocks": records,
    }
    write_json(DATA_DIR / "stocks.json", stocks_payload)

    sorted_items, steps, stats = comb_sort(records, key="return_pct", descending=True)
    write_json(DATA_DIR / "sort_steps.json", {"steps": steps, "stats": stats})

    ranked = [
        {
            "rank": position + 1,
            "ticker": item["ticker"],
            "company": item["company"],
            "sector": item["sector"],
            "start_close": item["start_close"],
            "end_close": item["end_close"],
            "return_pct": item["return_pct"],
        }
        for position, item in enumerate(sorted_items)
    ]
    write_json(
        DATA_DIR / "sorted_results.json",
        {"metadata": stocks_payload["metadata"], "results": ranked, "stats": stats},
    )
    return stats


def run(api_key: str | None) -> int:
    """Run the live-fetch pipeline."""
    warnings: list[str] = []

    if not api_key:
        print(
            "ALPHA_VANTAGE_API_KEY is not set. Skipping the live fetch and "
            "leaving the existing data/stocks.json fixture in place.\n"
            "Set the environment variable and re-run to pull live data."
        )
        return 1

    print(f"Fetching daily data for {len(STOCKS)} tickers from Alpha Vantage...")
    records = build_stock_records(api_key, warnings)

    if not records:
        print("No records were retrieved successfully; aborting without overwriting data files.")
        return 1

    random.Random(SHUFFLE_SEED).shuffle(records)
    stats = write_visualizer_outputs(records, warnings)

    print("\nDone.")
    print(f"  Records written: {len(records)}")
    print(f"  Warnings: {len(warnings)}")
    print(f"  Comparisons: {stats['comparisons']}  Swaps: {stats['swaps']}  Passes: {stats['passes']}")
    print(f"  Execution time: {stats['execution_time_ms']} ms")
    print("  Files: data/stocks.json, data/sort_steps.json, data/sorted_results.json")

    return 0


def main() -> None:
    """CLI entrypoint."""
    api_key = os.environ.get("ALPHA_VANTAGE_API_KEY")
    sys.exit(run(api_key))


if __name__ == "__main__":
    main()

