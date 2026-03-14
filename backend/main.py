"""
earnings-calendar — FastAPI backend
Provides upcoming earnings and historical EPS data via yfinance.
"""
import math
import os
from datetime import date, datetime, timedelta
from typing import Optional
import logging

import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# --- Default watchlist: 50 major stocks across sectors ---
WATCHLIST = [
    # Technology
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AVGO", "AMD", "INTC",
    "CRM", "ORCL", "ADBE", "QCOM", "TXN",
    # Financials
    "JPM", "BAC", "WFC", "GS", "MS", "BLK", "V", "MA", "AXP", "C",
    # Healthcare
    "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY", "TMO", "DHR", "AMGN", "GILD",
    # Consumer
    "WMT", "HD", "MCD", "SBUX", "NKE", "TGT", "COST", "PG", "KO", "PEP",
    # Energy & Industrials
    "XOM", "CVX", "CAT", "BA", "GE", "MMM", "HON", "UPS", "LMT",
    # Telecom & Media
    "DIS",
]


class EarningEntry(BaseModel):
    ticker: str
    company_name: str
    report_date: str          # ISO YYYY-MM-DD
    eps_estimate: Optional[float]
    eps_high: Optional[float]
    eps_low: Optional[float]
    revenue_estimate: Optional[float]
    market_cap: Optional[float]
    sector: Optional[str]


class HistoryEntry(BaseModel):
    date: str
    eps_actual: Optional[float]
    eps_estimate: Optional[float]
    surprise_percent: Optional[float]


app = FastAPI(title="earnings-calendar", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/earnings/upcoming", response_model=list[EarningEntry])
def get_upcoming_earnings(days: int = 14):
    """Return earnings reports within the next `days` days (clamped 1-90)."""
    days = max(1, min(days, 90))
    today = date.today()
    cutoff = today + timedelta(days=days)
    results = []

    for ticker in WATCHLIST:
        try:
            t = yf.Ticker(ticker)
            cal = t.calendar
            if not cal or "Earnings Date" not in cal:
                continue
            earn_dates = cal.get("Earnings Date", [])
            if not earn_dates:
                continue
            # Can be a single date or list
            if not isinstance(earn_dates, list):
                earn_dates = [earn_dates]

            for earn_date in earn_dates:
                if isinstance(earn_date, str):
                    earn_date = datetime.strptime(earn_date, "%Y-%m-%d").date()
                if today <= earn_date <= cutoff:
                    info = t.info or {}
                    results.append(EarningEntry(
                        ticker=ticker,
                        company_name=info.get("shortName") or ticker,
                        report_date=earn_date.isoformat(),
                        eps_estimate=cal.get("Earnings Average"),
                        eps_high=cal.get("Earnings High"),
                        eps_low=cal.get("Earnings Low"),
                        revenue_estimate=cal.get("Revenue Average"),
                        market_cap=info.get("marketCap"),
                        sector=info.get("sector"),
                    ))
                    break  # only take first upcoming date per ticker
        except Exception as exc:
            logger.warning("Error fetching %s: %s", ticker, exc)
            continue

    results.sort(key=lambda e: e.report_date)
    return results


@app.get("/api/earnings/history/{ticker}", response_model=list[HistoryEntry])
def get_earnings_history(ticker: str):
    """Return historical EPS data for a ticker (last 4 quarters)."""
    try:
        t = yf.Ticker(ticker.upper())
        df = t.get_earnings_history()
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No earnings history found for {ticker}")

        records = []
        for idx, row in df.tail(4).iterrows():
            records.append(HistoryEntry(
                date=str(idx)[:10],
                eps_actual=_safe_float(row.get("epsActual")),
                eps_estimate=_safe_float(row.get("epsEstimate")),
                surprise_percent=_safe_float(row.get("surprisePercent")),
            ))
        return records
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("History error for %s: %s", ticker, exc)
        raise HTTPException(status_code=500, detail=str(exc))


def _safe_float(val) -> Optional[float]:
    try:
        if val is None:
            return None
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


# Serve React frontend static files if built (must be last — catches all remaining routes)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
