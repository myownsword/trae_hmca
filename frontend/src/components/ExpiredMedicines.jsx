import { useState, useEffect } from 'react'
import { getMedicines, discardExpired } from '../api.js'

export default function ExpiredMedicines() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadExpired()
  }, [])

  async function loadExpired() {
    try {
      setLoading(true)
      const data = await getMedicines({ filter: 'expired' })
      setMedicines(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function showMessage(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleDiscardOne(id, name, quantity) {
    if (!confirm(`确定要报废"${name}"的全部 ${quantity} 件过期药品吗？`)) return
    try {
      await discardExpired(id, '')
      showMessage('success', '药品已报废处理')
      loadExpired()
    } catch (err) {
      showMessage('error', err.message)
    }
  }

  async function handleDiscardAll() {
    const validMeds = medicines.filter(m => m.quantity > 0)
    if (validMeds.length === 0) {
      showMessage('error', '没有可处理的过期药品')
      return
    }
    if (!confirm(`确定要批量报废所有 ${validMeds.length} 种过期药品吗？`)) return

    try {
      setProcessing(true)
      let success = 0
      let failed = 0
      for (const med of validMeds) {
        try {
          await discardExpired(med.id, '批量过期处理')
          success++
        } catch {
          failed++
        }
      }
      showMessage('success', `处理完成：成功 ${success} 个，失败 ${failed} 个`)
      loadExpired()
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>加载中...</p>
      </div>
    )
  }

  const totalQuantity = medicines.reduce((sum, m) => sum + m.quantity, 0)

  return (
    <div>
      <div className="page-header">
        <h2>过期药品处理
        </h2>
        <button
          className="btn btn-danger"
          onClick={handleDiscardAll}
          disabled={processing || medicines.filter(m => m.quantity > 0).length === 0}
        >
          {processing ? '处理中...' : '批量报废全部'}
        </button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon bg-red">📦</div>
          <div className="stat-label">过期药品种类</div>
          <div className="stat-value">{medicines.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-orange">⚠️</div>
          <div className="stat-label">过期药品总数量</div>
          <div className="stat-value">{totalQuantity}</div>
        </div>
      </div>

      {medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <p>太好了！没有过期药品</p>
        </div>
      ) : (
        <table>
          <thead>
          <tr>
            <th>药品名称</th>
            <th>批号</th>
            <th>数量</th>
            <th>有效期</th>
            <th>已过期天数</th>
            <th>位置</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          {medicines.map((med) => (
            <tr key={med.id}>
              <td style={{ fontWeight: 600 }}>{med.name}</td>
              <td>{med.batchNo}</td>
              <td>
                {med.quantity > 0 ? med.quantity : <span style={{ color: '#718096' }}>0 (已处理)</span>}
              </td>
              <td>{med.expiryDate}</td>
              <td style={{ color: '#e53e3e', fontWeight: 600 }}>
                {Math.abs(med.daysLeft)} 天
              </td>
              <td>{med.location || '-'}</td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDiscardOne(med.id, med.name, med.quantity)}
                  disabled={med.quantity <= 0}
                >
                  报废全部
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
