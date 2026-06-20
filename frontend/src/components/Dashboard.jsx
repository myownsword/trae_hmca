import { useState, useEffect } from 'react'
import { getStatistics } from '../api.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      setLoading(true)
      const data = await getStatistics()
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  if (error) {
    return (
      <div className="alert alert-error">
        加载失败: {error}
      </div>
    )
  }

  const getUrgencyClass = (days) => {
    if (days <= 7) return 'urgent'
    if (days <= 15) return 'warning'
    return 'normal'
  }

  return (
    <div>
      <div className="page-header">
        <h2>概览</h2>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon bg-purple">📊</div>
          <div className="stat-label">近30天取用次数</div>
          <div className="stat-value">{stats?.usageCountLast30Days || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue">💊</div>
          <div className="stat-label">药品总数</div>
          <div className="stat-value">{stats?.totalMedicines || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-orange">⚠️</div>
          <div className="stat-label">库存不足</div>
          <div className="stat-value">{stats?.lowStockCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-red">⏰</div>
          <div className="stat-label">已过期</div>
          <div className="stat-value">{stats?.expiredCount || 0}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">即将过期药品</h3>
        {stats?.expiringSoon?.length > 0 ? (
          <div className="expiring-list">
            {stats.expiringSoon.map((item) => (
              <div
                key={item.id}
                className={`expiring-item ${getUrgencyClass(item.daysLeft)}`}
              >
                <div className="expiring-info">
                  <div className="name">{item.name}</div>
                  <div className="meta">
                    批号: {item.batchNo} · 有效期: {item.expiryDate} · 库存: {item.quantity}
                  </div>
                </div>
                <div className={`days-left ${getUrgencyClass(item.daysLeft)}`}>
                  <div className="num">{item.daysLeft}</div>
                  <div className="label">天后过期</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>暂无即将过期的药品</p>
          </div>
        )}
      </div>
    </div>
  )
}
