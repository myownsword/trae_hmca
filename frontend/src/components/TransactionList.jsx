import { useState, useEffect } from 'react'
import { getTransactions } from '../api.js'

const typeOptions = [
  { key: '', label: '全部类型' },
  { key: 'stock', label: '入库' },
  { key: 'take', label: '取用' },
  { key: 'discard', label: '报废' },
]

const typeLabels = {
  stock: { label: '入库', badge: 'badge-success' },
  take: { label: '取用', badge: 'badge-primary' },
  discard: { label: '报废', badge: 'badge-danger' },
}

export default function TransactionList() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [limit, setLimit] = useState('50')

  useEffect(() => {
    loadTransactions()
  }, [typeFilter, limit])

  async function loadTransactions() {
    try {
      setLoading(true)
      const params = {}
      if (typeFilter) params.type = typeFilter
      if (limit) params.limit = limit
      const data = await getTransactions(params)
      setTransactions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>加载中...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>流水记录</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="filter-group">
          {typeOptions.map((opt) => (
            <button
              key={opt.key || 'all'}
              className={`filter-btn ${typeFilter === opt.key ? 'active' : ''}`}
              onClick={() => setTypeFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <select
            className="filter-btn"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="20">最近 20 条</option>
            <option value="50">最近 50 条</option>
            <option value="100">最近 100 条</option>
            <option value="">全部</option>
          </select>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>暂无流水记录</p>
        </div>
      ) : (
        <table>
          <thead>
          <tr>
            <th>时间</th>
            <th>药品名称</th>
            <th>类型</th>
            <th>数量</th>
            <th>备注</th>
          </tr>
          </thead>
          <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{formatDate(tx.createdAt)}</td>
              <td style={{ fontWeight: 500 }}>{tx.medicineName}</td>
              <td>
                <span className={`badge ${typeLabels[tx.type]?.badge || 'badge-secondary'}`}>
                  {typeLabels[tx.type]?.label || tx.type}
                </span>
              </td>
              <td style={{ fontWeight: 600 }}>{tx.quantity}</td>
              <td style={{ color: '#718096' }}>{tx.note || '-'}</td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
