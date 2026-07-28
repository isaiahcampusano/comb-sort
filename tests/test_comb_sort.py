"""Tests for src/comb_sort.py.

Run with: pytest
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.comb_sort import comb_sort, next_gap  # noqa: E402


def make_item(ticker: str, return_pct: float) -> dict:
    return {"ticker": ticker, "return_pct": return_pct}


def expected_order(items: list[dict]) -> list[dict]:
    """Reference ordering using Python's built-in sort for verification only."""
    return sorted(items, key=lambda item: item["return_pct"], reverse=True)


def test_next_gap_never_below_one():
    assert next_gap(1) == 1
    assert next_gap(0) == 1
    for gap in range(1, 50):
        assert next_gap(gap) >= 1


def test_next_gap_shrinks_by_default_factor():
    assert next_gap(15) == 11


def test_empty_list():
    sorted_items, steps, stats = comb_sort([])
    assert sorted_items == []
    assert steps == []
    assert stats["item_count"] == 0
    assert stats["comparisons"] == 0
    assert stats["swaps"] == 0


def test_single_item():
    items = [make_item("AAPL", 5.0)]
    sorted_items, steps, stats = comb_sort(items)
    assert sorted_items == items
    assert steps == []
    assert stats["comparisons"] == 0
    assert stats["swaps"] == 0


def test_already_sorted_descending_input():
    items = [make_item("A", 10), make_item("B", 5), make_item("C", 0)]
    sorted_items, _, stats = comb_sort(items, descending=True)
    assert [i["ticker"] for i in sorted_items] == ["A", "B", "C"]
    assert stats["swaps"] == 0


def test_reverse_sorted_input():
    items = [make_item("A", 0), make_item("B", 5), make_item("C", 10)]
    sorted_items, _, stats = comb_sort(items, descending=True)
    assert [i["ticker"] for i in sorted_items] == ["C", "B", "A"]
    assert stats["swaps"] > 0


def test_duplicate_return_values_break_ties_by_ticker():
    items = [make_item("ZETA", 5.0), make_item("ALPHA", 5.0), make_item("BETA", 5.0)]
    sorted_items, _, _ = comb_sort(items, descending=True)
    assert [i["ticker"] for i in sorted_items] == ["ALPHA", "BETA", "ZETA"]


def test_mixed_positive_and_negative_returns():
    items = [
        make_item("A", -7.6),
        make_item("B", 11.04),
        make_item("C", 0.0),
        make_item("D", -3.98),
        make_item("E", 4.13),
    ]
    sorted_items, _, _ = comb_sort(items, descending=True)
    returns = [i["return_pct"] for i in sorted_items]
    assert returns == sorted(returns, reverse=True)


def test_default_is_descending():
    items = [make_item("A", 1), make_item("B", 3), make_item("C", 2)]
    sorted_items, _, _ = comb_sort(items)
    assert [i["return_pct"] for i in sorted_items] == [3, 2, 1]


def test_ascending_when_requested():
    items = [make_item("A", 1), make_item("B", 3), make_item("C", 2)]
    sorted_items, _, _ = comb_sort(items, descending=False)
    assert [i["return_pct"] for i in sorted_items] == [1, 2, 3]


def test_no_records_lost_or_duplicated():
    items = [make_item(f"T{i}", float(15 - i)) for i in range(15)]
    sorted_items, _, _ = comb_sort(items)
    assert len(sorted_items) == len(items)
    assert {i["ticker"] for i in sorted_items} == {i["ticker"] for i in items}


def test_input_list_is_not_mutated():
    items = [make_item("A", 1), make_item("B", 3), make_item("C", 2)]
    original_order = [i["ticker"] for i in items]
    comb_sort(items)
    assert [i["ticker"] for i in items] == original_order


def test_final_gap_is_one():
    items = [make_item(f"T{i}", float(i)) for i in range(20)]
    _, _, stats = comb_sort(items)
    assert stats["final_gap"] == 1


def test_last_snapshot_matches_final_order():
    items = [
        make_item("DAL", -7.598039),
        make_item("COST", 2.659929),
        make_item("NVDA", 11.038867),
        make_item("KO", 1.399164),
        make_item("PLTR", 11.050094),
    ]
    sorted_items, steps, _ = comb_sort(items, record_steps=True)
    assert steps
    final_tickers = [i["ticker"] for i in sorted_items]
    assert steps[-1]["snapshot"] == final_tickers


def test_no_steps_recorded_when_disabled():
    items = [make_item("A", 1), make_item("B", 2)]
    _, steps, _ = comb_sort(items, record_steps=False)
    assert steps == []


def test_return_formula_matches_spec_example():
    start_close = 100.0
    end_close = 108.0
    return_pct = ((end_close - start_close) / start_close) * 100
    assert round(return_pct, 2) == 8.00


def test_matches_builtin_sort_full_fixture():
    fixture = [
        make_item("DAL", -7.598039),
        make_item("COST", 2.659929),
        make_item("NVDA", 11.038867),
        make_item("KO", 1.399164),
        make_item("PLTR", 11.050094),
        make_item("WMT", 5.303445),
        make_item("DIS", -3.983886),
        make_item("AAPL", 2.324051),
        make_item("JPM", 4.487180),
        make_item("LULU", -8.576303),
        make_item("META", 3.870626),
        make_item("V", 2.908631),
        make_item("AMZN", 3.514289),
        make_item("GOOGL", -2.307449),
        make_item("MSFT", 4.128114),
    ]
    sorted_items, _, stats = comb_sort(fixture)
    expected = expected_order(fixture)
    assert [i["ticker"] for i in sorted_items] == [i["ticker"] for i in expected]
    assert stats["initial_gap"] == 15
    assert stats["final_gap"] == 1

