import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

const API = import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL.replace(/\/$/, '')

function formatMarketCap(val) {
  if (!val) return '—'
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`
  return `$${(val / 1e6).toFixed(0)}M`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function SurpriseBadge({ pct }) {
  if (pct == null) return <span style={{ color: '#64748b' }}>—</span>
  const isPos = pct >= 0
  const pctDisplay = (pct * 100).toFixed(1)
  return (
    <span style={{
      padding: '2px 7px',
      borderRadius: '12px',
      fontSize: '0.78rem',
      fontWeight: 600,
      background: isPos ? '#14532d' : '#450a0a',
      color: isPos ? '#4ade80' : '#f87171',
    }}>
      {isPos ? '+' : ''}{pctDisplay}%
    </span>
  )
}

function DetailPanel({ entry, history, onClose }) {
  const chartData = (history || []).map(h => ({
    quarter: h.date?.slice(0, 7),
    actual: h.eps_actual,
    estimate: h.eps_estimate,
    surprise: h.surprise_percent != null ? +(h.surprise_percent * 100).toFixed(1) : null,
  }))

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
      background: '#1e293b', borderLeft: '1px solid #334155',
      padding: '24px', overflowY: 'auto', zIndex: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>{entry.ticker}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{entry.company_name}</div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
            {entry.sector} · {formatMarketCap(entry.market_cap)}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.4rem' }}
        >×</button>
      </div>

      <div style={{
        background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '20px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
      }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Report Date</div>
          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatDate(entry.report_date)}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>EPS Estimate</div>
          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {entry.eps_estimate != null ? `$${entry.eps_estimate.toFixed(2)}` : '—'}
          </div>
        </div>
        {entry.eps_high != null && (
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>EPS High</div>
            <div style={{ color: '#4ade80' }}>${entry.eps_high.toFixed(2)}</div>
          </div>
        )}
        {entry.eps_low != null && (
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>EPS Low</div>
            <div style={{ color: '#f87171' }}>${entry.eps_low.toFixed(2)}</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '12px', fontWeight: 600, color: '#94a3b8' }}>EPS History</div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <XAxis dataKey="quarter" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(val, name) => [`$${val?.toFixed(2)}`, name]}
            />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="actual" name="Actual EPS" radius={[4,4,0,0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.actual >= (entry.estimate || 0) ? '#4ade80' : '#f87171'} />
              ))}
            </Bar>
            <Bar dataKey="estimate" name="Estimate" fill="#3b82f6" opacity={0.6} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>No history data</div>
      )}

      {chartData.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '8px', fontSize: '0.85rem' }}>
            SURPRISE HISTORY
          </div>
          {chartData.map((q, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid #1e293b',
            }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{q.quarter}</span>
              <SurpriseBadge pct={q.surprise != null ? q.surprise / 100 : null} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DAYS_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
]

export default function App() {
  const [days, setDays] = useState(14)
  const [sector, setSector] = useState('All')
  const [earnings, setEarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchEarnings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/earnings/upcoming?days=${days}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEarnings(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  async function selectRow(entry) {
    setSelected(entry)
    setHistory([])
    setHistoryLoading(true)
    try {
      const res = await fetch(`${API}/api/earnings/history/${entry.ticker}`)
      if (res.ok) setHistory(await res.json())
    } catch {}
    setHistoryLoading(false)
  }

  const sectors = ['All', ...new Set(earnings.map(e => e.sector).filter(Boolean))]
  const filtered = sector === 'All' ? earnings : earnings.filter(e => e.sector === sector)

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9' }}>
          📅 Earnings Calendar
        </h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>
          Upcoming earnings reports with EPS estimates and historical surprises
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#1e293b', borderRadius: '8px', padding: '4px' }}>
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.85rem',
                background: days === opt.value ? '#3b82f6' : 'transparent',
                color: days === opt.value ? '#fff' : '#94a3b8',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={sector}
          onChange={e => setSector(e.target.value)}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
            color: '#e2e8f0', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          {sectors.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Sectors' : s}</option>
          ))}
        </select>

        <span style={{ color: '#475569', fontSize: '0.8rem' }}>
          {filtered.length} report{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: '60px' }}>Loading earnings data…</div>
      ) : error ? (
        <div style={{ color: '#f87171', textAlign: 'center', padding: '60px' }}>
          Error: {error} — Is the backend running?
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: '60px' }}>
          No earnings in the next {days} days for the selected filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                {['Date', 'Ticker', 'Company', 'EPS Est', 'EPS Range', 'Market Cap', 'Sector'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', color: '#64748b', fontWeight: 600,
                    fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid #334155',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.ticker}
                  onClick={() => selectRow(entry)}
                  style={{
                    background: selected?.ticker === entry.ticker ? '#1e3a5f' : (i % 2 === 0 ? '#0f172a' : '#111827'),
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderBottom: '1px solid #1e293b',
                  }}
                  onMouseEnter={e => { if (selected?.ticker !== entry.ticker) e.currentTarget.style.background = '#1e293b' }}
                  onMouseLeave={e => { if (selected?.ticker !== entry.ticker) e.currentTarget.style.background = i % 2 === 0 ? '#0f172a' : '#111827' }}
                >
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{formatDate(entry.report_date)}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>
                    {entry.ticker}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#e2e8f0' }}>{entry.company_name}</td>
                  <td style={{ padding: '12px 14px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                    {entry.eps_estimate != null ? `$${entry.eps_estimate.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.8rem' }}>
                    {entry.eps_low != null && entry.eps_high != null
                      ? `$${entry.eps_low.toFixed(2)} – $${entry.eps_high.toFixed(2)}`
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{formatMarketCap(entry.market_cap)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
                      background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                    }}>
                      {entry.sector || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          entry={selected}
          history={historyLoading ? [] : history}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
