import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

// Mock fetch globally
const mockUpcoming = [
  {
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    report_date: '2026-03-18',
    eps_estimate: 1.85,
    eps_high: 2.10,
    eps_low: 1.60,
    market_cap: 3600000000000,
    sector: 'Technology',
  },
  {
    ticker: 'MSFT',
    company_name: 'Microsoft Corp.',
    report_date: '2026-03-20',
    eps_estimate: 2.94,
    eps_high: 3.10,
    eps_low: 2.80,
    market_cap: 3100000000000,
    sector: 'Technology',
  },
  {
    ticker: 'XOM',
    company_name: 'Exxon Mobil',
    report_date: '2026-03-22',
    eps_estimate: 1.77,
    eps_high: 2.00,
    eps_low: 1.50,
    market_cap: 480000000000,
    sector: 'Energy',
  },
]

const mockHistory = [
  { date: '2025-03-31', eps_actual: 1.65, eps_estimate: 1.62, surprise_percent: 0.017 },
  { date: '2025-06-30', eps_actual: 1.57, eps_estimate: 1.43, surprise_percent: 0.101 },
  { date: '2025-09-30', eps_actual: 1.85, eps_estimate: 1.77, surprise_percent: 0.045 },
  { date: '2025-12-31', eps_actual: 2.84, eps_estimate: 2.67, surprise_percent: 0.063 },
]

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/earnings/history/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHistory) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUpcoming) })
  })
})

describe('EarningsTable', () => {
  it('renders the app without crashing', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Earnings Calendar/i)).toBeInTheDocument()
    })
  })

  it('renders the Date column header', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
    })
  })

  it('renders the Ticker column header', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Ticker')).toBeInTheDocument()
    })
  })

  it('renders the Company column header', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Company')).toBeInTheDocument()
    })
  })

  it('renders the EPS Estimate column header', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/EPS Est/i)).toBeInTheDocument()
    })
  })

  it('renders ticker rows from API data', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
  })

  it('renders company names in table rows', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    })
  })
})

describe('Days filter', () => {
  it('renders the 7-day option button', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument()
    })
  })

  it('renders the 14-day option button', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /14d/i })).toBeInTheDocument()
    })
  })

  it('renders the 30-day option button', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument()
    })
  })
})

describe('Sector filter', () => {
  it('renders sector filter dropdown', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('sector filter has All Sectors option', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/All Sectors/i)).toBeInTheDocument()
    })
  })

  it('filtering by Energy shows only Energy sector rows', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument())
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Energy' } })
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    expect(screen.getByText('XOM')).toBeInTheDocument()
  })
})

describe('Detail panel', () => {
  it('clicking a row shows detail panel', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('AAPL'))
    await waitFor(() => {
      expect(screen.getByText(/EPS History/i)).toBeInTheDocument()
    })
  })

  it('close button hides detail panel', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument())
    fireEvent.click(screen.getByText('AAPL'))
    await waitFor(() => expect(screen.getByText(/EPS History/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByText(/EPS History/i)).not.toBeInTheDocument()
  })
})

describe('Error state', () => {
  it('shows error message when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('shows loading text while fetching', async () => {
    // Delay resolution to catch loading state
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<App />)
    expect(screen.getByText(/Loading earnings data/i)).toBeInTheDocument()
  })
})

describe('Empty state', () => {
  it('shows empty state message when no earnings returned', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    )
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/No earnings in the next/i)).toBeInTheDocument()
    })
  })
})
