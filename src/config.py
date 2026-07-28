"""
Configuration for the Comb Sort Market Visualizer.

Keeping the ticker universe here (instead of inside comb_sort.py or
fetch_data.py) means the stock list can be edited without touching any
algorithm or data-fetching logic.
"""

from __future__ import annotations

# Ticker -> company display name.
STOCKS: dict[str, str] = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "NVDA": "NVIDIA",
    "META": "Meta Platforms",
    "JPM": "JPMorgan Chase",
    "V": "Visa",
    "COST": "Costco",
    "WMT": "Walmart",
    "LULU": "Lululemon Athletica",
    "DIS": "Walt Disney",
    "KO": "Coca-Cola",
    "DAL": "Delta Air Lines",
    "PLTR": "Palantir Technologies",
}

# Ticker -> GICS-style sector label, used only for display in the results
# table (not used by the sorting algorithm itself).
SECTORS: dict[str, str] = {
    "AAPL": "Technology",
    "MSFT": "Technology",
    "GOOGL": "Communication Services",
    "AMZN": "Consumer Discretionary",
    "NVDA": "Technology",
    "META": "Communication Services",
    "JPM": "Financials",
    "V": "Financials",
    "COST": "Consumer Staples",
    "WMT": "Consumer Staples",
    "LULU": "Consumer Discretionary",
    "DIS": "Communication Services",
    "KO": "Consumer Staples",
    "DAL": "Industrials",
    "PLTR": "Technology",
}

# --- Financial metric parameters -------------------------------------------

# Number of most-recent trading sessions used to compute the return.
LOOKBACK_SESSIONS: int = 30

# Alpha Vantage endpoint parameters.
ALPHA_VANTAGE_BASE_URL: str = "https://www.alphavantage.co/query"
ALPHA_VANTAGE_FUNCTION: str = "TIME_SERIES_DAILY"
ALPHA_VANTAGE_OUTPUT_SIZE: str = "compact"

# Seconds to wait between Alpha Vantage requests.
DEFAULT_REQUEST_DELAY_SECONDS: float = 12.0

# Deterministic shuffle seed applied to the fetched records before they are
# written to data/stocks.json, so the "unsorted" starting order used for the
# animation is reproducible across runs and in tests.
SHUFFLE_SEED: int = 42

# Comb sort tuning.
SHRINK_FACTOR: float = 1.3

