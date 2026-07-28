"""
A from-scratch comb sort implementation for stock-return records.

Comb sort improves on bubble sort by first comparing elements that are far
apart (separated by a "gap") and shrinking that gap on every pass. Because
far-apart, badly out-of-place values ("turtles") get moved most of the way
home in a single long-distance swap, comb sort converges in far fewer
passes than bubble sort, which can only ever swap neighbors and therefore
needs one pass per position a turtle has to travel. The final pass, once
the gap has shrunk to 1, is exactly a bubble-sort pass.
"""

from __future__ import annotations

import time
from typing import Any

from .config import SHRINK_FACTOR

Record = dict[str, Any]


def next_gap(gap: int, shrink_factor: float = SHRINK_FACTOR) -> int:
    """Shrink a comb sort gap by `shrink_factor`, floored at 1."""
    gap = int(gap / shrink_factor)
    return max(1, gap)


def _is_out_of_order(
    left: Record,
    right: Record,
    key: str,
    descending: bool,
    tie_breaker: str,
) -> bool:
    """True if `left` and `right` are in the wrong relative order."""
    left_val, right_val = left[key], right[key]

    if left_val == right_val:
        return left[tie_breaker] > right[tie_breaker]

    if descending:
        return left_val < right_val
    return left_val > right_val


def comb_sort(
    items: list[Record],
    key: str = "return_pct",
    descending: bool = True,
    record_steps: bool = True,
    tie_breaker: str = "ticker",
    shrink_factor: float = SHRINK_FACTOR,
) -> tuple[list[Record], list[Record], dict[str, Any]]:
    """Sort `items` by `key` using comb sort."""
    start_time = time.perf_counter()

    working = list(items)
    n = len(working)

    steps: list[Record] = []
    comparisons = 0
    swaps = 0
    passes = 0
    step_counter = 0

    initial_gap = n
    gap = n
    swapped = True

    while gap != 1 or swapped:
        gap = next_gap(gap, shrink_factor)
        swapped = False
        passes += 1

        for i in range(n - gap):
            j = i + gap
            comparisons += 1

            left_ticker_before = working[i][tie_breaker]
            right_ticker_before = working[j][tie_breaker]
            did_swap = _is_out_of_order(working[i], working[j], key, descending, tie_breaker)

            if did_swap:
                working[i], working[j] = working[j], working[i]
                swapped = True
                swaps += 1

            if record_steps:
                step_counter += 1
                steps.append(
                    {
                        "step": step_counter,
                        "action": "compare",
                        "gap": gap,
                        "left_index": i,
                        "right_index": j,
                        "left_ticker": left_ticker_before,
                        "right_ticker": right_ticker_before,
                        "swapped": did_swap,
                        "snapshot": [record[tie_breaker] for record in working],
                    }
                )

        if n <= 1:
            break

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    stats = {
        "algorithm": "comb_sort",
        "item_count": n,
        "comparisons": comparisons,
        "swaps": swaps,
        "passes": passes,
        "initial_gap": initial_gap,
        "final_gap": gap if n > 1 else max(1, n),
        "shrink_factor": shrink_factor,
        "execution_time_ms": round(elapsed_ms, 4),
    }

    return working, steps, stats

