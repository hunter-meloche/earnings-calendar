# Earnings Calendar

Real-time earnings calendar dashboard tracking upcoming earnings reports for major S&P 500 stocks. Shows EPS estimates, analyst ranges, and historical earnings surprises.

## What it does

- **Upcoming earnings table** — next 7, 14, or 30 days of reports with EPS estimates
- **Sector filtering** — filter by Technology, Financials, Healthcare, Energy, etc.
- **Click-to-detail** — click any row to see EPS history chart and surprise % for last 4 quarters
- **50-stock watchlist** — covers major S&P 500 components across all sectors
- Data via **yfinance** (free, no API key required)

## Stack

- **Backend:** Python 3.11 + FastAPI + yfinance
- **Frontend:** React 18 + Vite + Recharts
- **Ports:** 8103 (Docker backend) / 5175 (local frontend dev)

## Quick Start

### Docker (backend only)
```bash
docker-compose up -d
# Backend available at http://localhost:8103
```

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5175
```

### Run Tests

**Backend:**
```bash
cd /path/to/earnings-calendar
python3 -m pytest backend/tests/ -v
```

**Frontend:**
```bash
cd frontend
npm test
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/earnings/upcoming?days=14` | Upcoming earnings within N days |
| `GET /api/earnings/history/{ticker}` | Historical EPS data (last 4 quarters) |

## Gaps (Does NOT cover)

- Intraday price data or technical analysis
- Options chain or implied volatility
- Revenue surprise analysis
- Pre/post market price reaction to earnings
- Crypto earnings or non-public companies
