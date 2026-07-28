"""Tests for src/fetch_data.py's data-processing helpers."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import LOOKBACK_SESSIONS  # noqa: E402
from src.fetch_data import FetchWarning, compute_return  # noqa: E402


def _daily_payload(closes: dict[str, float]) -> dict:
    return {
        "Meta Data": {"2. Symbol": "TEST"},
        "Time Series (Daily)": {
            date: {
                "1. open": str(close),
                "2. high": str(close),
                "3. low": str(close),
                "4. close": str(close),
                "5. volume": "1000000",
            }
            for date, close in closes.items()
        },
    }


def _sequential_dates(n: int, start: str = "2026-01-02") -> list[str]:
    from datetime import date, timedelta

    day = date.fromisoformat(start)
    out = []
    while len(out) < n:
      if day.weekday() < 5:
        out.append(day.isoformat())
      day += timedelta(days=1)
    return out


def test_percentage_return_formula():
    dates = _sequential_dates(LOOKBACK_SESSIONS)
    closes = {date: 100.0 for date in dates}
    closes[dates[-1]] = 108.0
    payload = _daily_payload(closes)

    record = compute_return("TEST", "Test Co", payload)

    assert record["start_close"] == 100.0
    assert record["end_close"] == 108.0
    assert round(record["return_pct"], 2) == 8.00


def test_return_uses_oldest_and_newest_of_last_30_sessions_only():
    dates = _sequential_dates(40)
    closes = {date: 50.0 for date in dates}
    closes[dates[0]] = 9999.0
    closes[dates[-30]] = 100.0
    closes[dates[-1]] = 120.0
    payload = _daily_payload(closes)

    record = compute_return("TEST", "Test Co", payload)

    assert record["start_close"] == 100.0
    assert record["end_close"] == 120.0
    assert round(record["return_pct"], 2) == 20.00


def test_unrounded_return_preserved_internally():
    dates = _sequential_dates(LOOKBACK_SESSIONS)
    closes = {date: 100.0 for date in dates}
    closes[dates[-1]] = 108.33333
    payload = _daily_payload(closes)

    record = compute_return("TEST", "Test Co", payload)

    assert record["return_pct"] != round(record["return_pct"], 2)


def test_missing_time_series_key_raises_fetch_warning():
    payload = {"Meta Data": {}}
    with pytest.raises(FetchWarning):
        compute_return("TEST", "Test Co", payload)


def test_too_few_sessions_raises_fetch_warning():
    dates = _sequential_dates(LOOKBACK_SESSIONS - 5)
    closes = {date: 10.0 for date in dates}
    payload = _daily_payload(closes)
    with pytest.raises(FetchWarning) as excinfo:
        compute_return("TEST", "Test Co", payload)
    assert "sessions available" in str(excinfo.value)


def test_malformed_close_value_raises_fetch_warning():
    dates = _sequential_dates(LOOKBACK_SESSIONS)
    payload = _daily_payload({date: 10.0 for date in dates})
    some_date = dates[0]
    payload["Time Series (Daily)"][some_date]["4. close"] = "not-a-number"
    with pytest.raises(FetchWarning):
        compute_return("TEST", "Test Co", payload)


def test_zero_starting_close_raises_fetch_warning():
    dates = _sequential_dates(LOOKBACK_SESSIONS)
    closes = {date: 10.0 for date in dates}
    closes[dates[-LOOKBACK_SESSIONS]] = 0.0
    payload = _daily_payload(closes)
    with pytest.raises(FetchWarning):
        compute_return("TEST", "Test Co", payload)


def test_sector_lookup_falls_back_to_unknown_for_unlisted_ticker():
    dates = _sequential_dates(LOOKBACK_SESSIONS)
    payload = _daily_payload({date: 10.0 for date in dates})
    record = compute_return("ZZZZ", "Not In Config", payload)
    assert record["sector"] == "Unknown"

