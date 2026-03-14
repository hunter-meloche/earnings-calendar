"""
Tests for earnings-calendar API.
Written FIRST (TDD) — these fail until main.py is implemented.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
import pandas as pd
from fastapi.testclient import TestClient


# --- Shared mock data ---

def make_calendar(days_ahead=5):
    return {
        "Earnings Date": [date.today() + timedelta(days=days_ahead)],
        "Earnings Average": 1.85,
        "Earnings High": 2.10,
        "Earnings Low": 1.60,
        "Revenue Average": 90_000_000_000,
    }


def make_earnings_history():
    return pd.DataFrame({
        "epsActual":      [1.65, 1.57, 1.85, 2.84],
        "epsEstimate":    [1.62, 1.43, 1.77, 2.67],
        "epsDifference":  [0.03, 0.14, 0.08, 0.17],
        "surprisePercent":[0.0169, 0.1012, 0.0452, 0.0634],
    }, index=pd.to_datetime(["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"]))


def make_info():
    return {
        "shortName": "Apple Inc.",
        "sector": "Technology",
        "marketCap": 3_600_000_000_000,
    }


def mock_ticker_factory(ticker_sym):
    """Returns a mock yfinance Ticker object."""
    m = MagicMock()
    m.calendar = make_calendar()
    m.info = make_info()
    m.get_earnings_history = MagicMock(return_value=make_earnings_history())
    return m


def mock_ticker_no_earnings(ticker_sym):
    m = MagicMock()
    m.calendar = {}  # no Earnings Date
    m.info = {"shortName": "NoCal Corp", "sector": "Energy", "marketCap": None}
    m.get_earnings_history = MagicMock(return_value=pd.DataFrame())
    return m


# --- Tests ---

@pytest.fixture
def client():
    with patch("yfinance.Ticker", side_effect=mock_ticker_factory):
        from backend.main import app
        yield TestClient(app)


class TestUpcomingEarnings:
    def test_endpoint_returns_200(self, client):
        resp = client.get("/api/earnings/upcoming")
        assert resp.status_code == 200

    def test_response_is_list(self, client):
        resp = client.get("/api/earnings/upcoming")
        assert isinstance(resp.json(), list)

    def test_entry_has_ticker(self, client):
        resp = client.get("/api/earnings/upcoming")
        data = resp.json()
        assert len(data) > 0
        assert "ticker" in data[0]

    def test_entry_has_company_name(self, client):
        data = client.get("/api/earnings/upcoming").json()
        assert "company_name" in data[0]

    def test_entry_has_report_date(self, client):
        data = client.get("/api/earnings/upcoming").json()
        assert "report_date" in data[0]
        # Should be ISO date string YYYY-MM-DD
        assert len(data[0]["report_date"]) == 10

    def test_entry_has_eps_estimate(self, client):
        data = client.get("/api/earnings/upcoming").json()
        assert "eps_estimate" in data[0]

    def test_entry_has_market_cap(self, client):
        data = client.get("/api/earnings/upcoming").json()
        assert "market_cap" in data[0]

    def test_days_param_filters_results(self):
        """Tickers with earnings beyond `days` window should be excluded."""
        def factory_far(sym):
            m = MagicMock()
            m.calendar = make_calendar(days_ahead=60)  # 60 days out
            m.info = make_info()
            m.get_earnings_history = MagicMock(return_value=make_earnings_history())
            return m

        with patch("yfinance.Ticker", side_effect=factory_far):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/upcoming?days=7")
            assert resp.status_code == 200
            # With days=7 and earnings 60 days out, result should be empty
            assert resp.json() == []

    def test_cors_header_present(self, client):
        resp = client.get(
            "/api/earnings/upcoming",
            headers={"Origin": "http://localhost:5175"}
        )
        assert "access-control-allow-origin" in resp.headers


class TestEarningsHistory:
    def test_valid_ticker_returns_200(self, client):
        resp = client.get("/api/earnings/history/AAPL")
        assert resp.status_code == 200

    def test_history_is_list(self, client):
        data = client.get("/api/earnings/history/AAPL").json()
        assert isinstance(data, list)

    def test_history_entry_has_date(self, client):
        data = client.get("/api/earnings/history/AAPL").json()
        assert len(data) > 0
        assert "date" in data[0]

    def test_history_entry_has_eps_actual(self, client):
        data = client.get("/api/earnings/history/AAPL").json()
        assert "eps_actual" in data[0]

    def test_history_entry_has_eps_estimate(self, client):
        data = client.get("/api/earnings/history/AAPL").json()
        assert "eps_estimate" in data[0]

    def test_history_entry_has_surprise_percent(self, client):
        data = client.get("/api/earnings/history/AAPL").json()
        assert len(data) > 0
        assert "surprise_percent" in data[0]

    def test_lowercase_ticker_normalized(self, client):
        """Lowercase ticker 'aapl' should work same as 'AAPL'."""
        resp = client.get("/api/earnings/history/aapl")
        assert resp.status_code == 200

    def test_invalid_ticker_returns_404(self):
        def raise_on_bad(sym):
            m = MagicMock()
            m.get_earnings_history = MagicMock(return_value=pd.DataFrame())
            m.calendar = {}
            m.info = {}
            return m

        with patch("yfinance.Ticker", side_effect=raise_on_bad):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/history/INVALIDZZZ")
            assert resp.status_code == 404

    def test_unexpected_exception_returns_500(self):
        """Non-HTTPException from yfinance should map to 500."""
        def raise_on_call(sym):
            m = MagicMock()
            m.get_earnings_history = MagicMock(side_effect=RuntimeError("network down"))
            m.calendar = {}
            m.info = {}
            return m

        with patch("yfinance.Ticker", side_effect=raise_on_call):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/history/AAPL")
            assert resp.status_code == 500


class TestDaysParameter:
    def test_days_clamped_to_maximum_90(self):
        """days=1000 should be treated as 90, not crash."""
        with patch("yfinance.Ticker", side_effect=mock_ticker_factory):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/upcoming?days=1000")
            assert resp.status_code == 200

    def test_days_clamped_to_minimum_1(self):
        """days=0 should be treated as 1."""
        with patch("yfinance.Ticker", side_effect=mock_ticker_factory):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/upcoming?days=0")
            assert resp.status_code == 200

    def test_days_negative_clamped_to_minimum_1(self):
        """days=-5 should be treated as 1."""
        with patch("yfinance.Ticker", side_effect=mock_ticker_factory):
            from backend.main import app
            c = TestClient(app)
            resp = c.get("/api/earnings/upcoming?days=-5")
            assert resp.status_code == 200


class TestSafeFloat:
    def _call(self, val):
        from backend.main import _safe_float
        return _safe_float(val)

    def test_none_returns_none(self):
        assert self._call(None) is None

    def test_nan_returns_none(self):
        import math
        assert self._call(float("nan")) is None

    def test_valid_float_returned(self):
        assert self._call(1.5) == 1.5

    def test_invalid_string_returns_none(self):
        assert self._call("bad") is None

    def test_zero_returns_zero(self):
        assert self._call(0) == 0.0
