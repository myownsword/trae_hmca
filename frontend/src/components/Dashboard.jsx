import { useState, useEffect } from 'react'
import { getStatistics, getTodayPlans, executePlan } from '../api.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [todayPlans, setTodayPlans] = useState({ today: [], overdue: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsData, plansData] = await Promise.all([
        getStatistics(),
        getTodayPlans()
      ])
      setStats(statsData)
      setTodayPlans(plansData)
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

  function openAction(action, item) {
    setShowNoteModal({ action, item, note: '' })
  }

  async function handleAction() {
    const { action, item, note } = showNoteModal
    try {
      await executePlan(item.planId, action, item.scheduledDate, item.scheduledTime, note)
      setShowNoteModal(null)
      showMessage('success', action === 'taken' ? '已标记为服用，库存已扣减' : '已标记为跳过')
      loadData()
    } catch (err) {
      showMessage('error', err.message)
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

  function canExecute(item) {
    if (item.isExpired) return false
    if (item.currentQuantity < item.dosagePerTime) return false
    if (item.currentQuantity <= 0) return false
    return true
  }

  function getWarningText(item) {
    if (item.isExpired) return '药品已过期'
    if (item.currentQuantity <= 0) return '库存为零'
    if (item.currentQuantity < item.dosagePerTime) return `库存不足 (需${item.dosagePerTime}/现${item.currentQuantity})`
    return null
  }

  return (
    <div>
      <div className="page-header">
        <h2>概览</h2>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon bg-green">�</div>
          <div className="stat-label">今日待服用</div>
          <div className="stat-value">{todayPlans?.today?.length || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-red">⚠️</div>
          <div className="stat-label">逾期未处理</div>
          <div className="stat-value">{todayPlans?.overdue?.length || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue">💊</div>
          <div className="stat-label">药品总数</div>
          <div className="stat-value">{stats?.totalMedicines || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-purple">📊</div>
          <div className="stat-label">近30天取用次数</div>
          <div className="stat-value">{stats?.usageCountLast30Days || 0}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">今日待服用</h3>
        {todayPlans?.today?.length > 0 ? (
          <div className="expiring-list">
            {todayPlans.today.map((item) => {
              const warning = getWarningText(item)
              const canTake = canExecute(item)
              return (
                <div
                  key={`${item.planId}-${item.scheduledDate}-${item.scheduledTime}`}
                  className={`expiring-item ${item.isOverdue ? 'urgent' : 'normal'}`}
                >
                  <div className="expiring-info">
                    <div className="name">
                      {item.medicineName} - {item.memberName}
                      {item.isOverdue && <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>已逾期</span>}
                    </div>
                    <div className="meta">
                      {item.scheduledTime} · {item.dosagePerTime} 单位 · 库存: {item.currentQuantity}
                      {item.note && ` · ${item.note}`}
                    </div>
                    {warning && (
                      <div style={{ fontSize: '0.85rem', color: '#e53e3e', marginTop: '0.25rem' }}>
                        ⚠️ {warning}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => openAction('taken', item)}
                      disabled={!canTake}
                    >
                      已服用
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAction('skipped', item)}
                    >
                      跳过
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>今日暂无待服用药品</p>
          </div>
        )}
      </div>

      {todayPlans?.overdue?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title" style={{ color: '#e53e3e' }}>⚠️ 逾期未处理</h3>
          <div className="expiring-list">
            {todayPlans.overdue.map((item) => {
              const warning = getWarningText(item)
              const canTake = canExecute(item)
              return (
                <div
                  key={`${item.planId}-${item.scheduledDate}-${item.scheduledTime}`}
                  className="expiring-item urgent"
                >
                  <div className="expiring-info">
                    <div className="name">
                      {item.medicineName} - {item.memberName}
                      <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>逾期</span>
                    </div>
                    <div className="meta">
                      {item.scheduledDate} {item.scheduledTime} · {item.dosagePerTime} 单位 · 库存: {item.currentQuantity}
                      {item.note && ` · ${item.note}`}
                    </div>
                    {warning && (
                      <div style={{ fontSize: '0.85rem', color: '#e53e3e', marginTop: '0.25rem' }}>
                        ⚠️ {warning}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => openAction('taken', item)}
                      disabled={!canTake}
                    >
                      补服
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAction('skipped', item)}
                    >
                      跳过
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
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

      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {showNoteModal.action === 'taken' ? '确认服用' : '确认跳过'} - {showNoteModal.item.medicineName}
              </h3>
              <button className="close-btn" onClick={() => setShowNoteModal(null)}>×</button>
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#718096' }}>
              <div>成员: {showNoteModal.item.memberName}</div>
              <div>计划时间: {showNoteModal.item.scheduledDate} {showNoteModal.item.scheduledTime}</div>
              <div>用量: {showNoteModal.item.dosagePerTime} 单位</div>
              {showNoteModal.action === 'taken' && (
                <div style={{ color: '#38a169', marginTop: '0.5rem' }}>
                  ✓ 服用后将自动扣减库存并生成取用流水
                </div>
              )}
              {showNoteModal.action === 'skipped' && (
                <div style={{ color: '#dd6b20', marginTop: '0.5rem' }}>
                  ⊘ 跳过后仅记录日志，不扣减库存
                </div>
              )}
            </div>
            <div className="form-group">
              <label>备注（可选）</label>
              <textarea
                value={showNoteModal.note}
                onChange={(e) => setShowNoteModal({ ...showNoteModal, note: e.target.value })}
                placeholder="例如：饭后服用、感觉好转等"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoteModal(null)}>取消</button>
              <button
                className={`btn ${showNoteModal.action === 'taken' ? 'btn-success' : 'btn-warning'}`}
                onClick={handleAction}
              >
                确认{showNoteModal.action === 'taken' ? '服用' : '跳过'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
