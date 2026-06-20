import { useState, useEffect } from 'react'
import { getPlans, addPlan, disablePlan, getPlanLogs } from '../api.js'
import MedicationPlanForm from './MedicationPlanForm.jsx'

const weekDayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const statusFilterOptions = [
  { key: '', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'disabled', label: '已停用' },
]

export default function MedicationPlanList() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showLogs, setShowLogs] = useState(null)
  const [planLogs, setPlanLogs] = useState([])

  useEffect(() => {
    loadPlans()
  }, [statusFilter])

  async function loadPlans() {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter) params.status = statusFilter
      const data = await getPlans(params)
      setPlans(data)
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

  async function handleAdd(data) {
    try {
      await addPlan(data)
      showMessage('success', '用药计划创建成功')
      setShowForm(false)
      loadPlans()
    } catch (err) {
      showMessage('error', err.message)
    }
  }

  async function handleDisable(plan) {
    if (!confirm(`确定要停用"${plan.medicineName} - ${plan.memberName}"的用药计划吗？`)) return
    try {
      const note = prompt('请输入停用原因（可选）：', '')
      await disablePlan(plan.id, note || '')
      showMessage('success', '计划已停用')
      loadPlans()
    } catch (err) {
      showMessage('error', err.message)
    }
  }

  async function handleViewLogs(planId) {
    try {
      const logs = await getPlanLogs(planId)
      setPlanLogs(logs)
      setShowLogs(planId)
    } catch (err) {
      showMessage('error', err.message)
    }
  }

  function getStatusBadge(plan) {
    if (plan.status === 'disabled') {
      return <span className="badge badge-secondary">已停用</span>
    }
    if (plan.isExpired) {
      return <span className="badge badge-danger">药品过期</span>
    }
    if (plan.currentQuantity < plan.dosagePerTime) {
      return <span className="badge badge-warning">库存不足</span>
    }
    return <span className="badge badge-success">进行中</span>
  }

  function formatFrequency(plan) {
    if (plan.frequency === 'daily') {
      return `每日 ${plan.reminderTimes.length} 次`
    }
    const days = plan.frequencyDays.map(d => weekDayLabels[d]).join('、')
    return `${days} ${plan.reminderTimes.length} 次`
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
        <h2>用药计划</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + 新增计划
        </button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="filter-group">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.key || 'all'}
              className={`filter-btn ${statusFilter === opt.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>暂无用药计划</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>
            创建第一个用药计划
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>药品名称</th>
              <th>成员</th>
              <th>用量</th>
              <th>频次</th>
              <th>周期</th>
              <th>提醒时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{plan.medicineName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                    批号: {plan.batchNo} · 库存: {plan.currentQuantity}
                  </div>
                </td>
                <td>{plan.memberName}</td>
                <td>{plan.dosagePerTime} 单位/次</td>
                <td>{formatFrequency(plan)}</td>
                <td>
                  <div>{plan.startDate}</div>
                  <div style={{ fontSize: '0.8rem', color: '#718096' }}>至 {plan.endDate}</div>
                </td>
                <td>{plan.reminderTimes.join('、')}</td>
                <td>{getStatusBadge(plan)}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleViewLogs(plan.id)}
                    >
                      日志
                    </button>
                    {plan.status === 'active' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDisable(plan)}
                      >
                        停用
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <MedicationPlanForm
          onSubmit={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>执行日志</h3>
              <button className="close-btn" onClick={() => setShowLogs(null)}>×</button>
            </div>

            {planLogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <p>暂无执行记录</p>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {planLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #edf2f7',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {log.action === 'taken' ? (
                          <span style={{ color: '#38a169' }}>✓ 已服用</span>
                        ) : (
                          <span style={{ color: '#dd6b20' }}>⊘ 已跳过</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>
                        计划: {log.scheduledDate} {log.scheduledTime}
                        {log.quantity > 0 && ` · 用量: ${log.quantity}`}
                      </div>
                      {log.note && (
                        <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>
                          备注: {log.note}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLogs(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
