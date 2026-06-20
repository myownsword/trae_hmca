import { useState, useEffect } from 'react'
import {
  getMedicines, getMedicineLocations, addMedicine, updateMedicine, deleteMedicine,
  stockMedicine, takeMedicine, discardMedicine
} from '../api.js'
import MedicineForm from './MedicineForm.jsx'

const filterOptions = [
  { key: '', label: '全部' },
  { key: 'expiring', label: '即将过期' },
  { key: 'expired', label: '已过期' },
  { key: 'lowstock', label: '库存不足' },
  { key: 'outofstock', label: '缺货' },
]

export default function MedicineList() {
  const [medicines, setMedicines] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadData()
  }, [filter, locationFilter])

  async function loadData() {
    try {
      setLoading(true)
      const params = {}
      if (filter) params.filter = filter
      if (locationFilter) params.location = locationFilter
      const [meds, locs] = await Promise.all([
        getMedicines(params), getMedicineLocations()
      ])
      setMedicines(meds)
      setLocations(locs)
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
    await addMedicine(data)
    showMessage('success', '药品添加成功')
    loadData()
  }

  async function handleUpdate(data) {
    await updateMedicine(editingMedicine.id, data)
    showMessage('success', '药品更新成功')
    loadData()
  }

  async function handleDelete(id, name) {
    if (!confirm(`确定要删除药品"${name}"吗？所有相关流水记录也会被删除。`)) return
    await deleteMedicine(id)
    showMessage('success', '药品已删除')
    loadData()
  }

  function openEdit(medicine) {
    setEditingMedicine(medicine)
    setShowForm(true)
  }

  function openAction(type, medicine) {
    setActionModal({ type, medicine, quantity: 1, note: '' })
  }

  async function handleAction() {
    const { type, medicine, quantity, note } = actionModal
    try {
      if (type === 'stock') {
        await stockMedicine(medicine.id, quantity, note)
      } else if (type === 'take') {
        await takeMedicine(medicine.id, quantity, note)
      } else if (type === 'discard') {
        await discardMedicine(medicine.id, quantity, note)
      }
      setActionModal(null)
      showMessage('success', '操作成功')
      loadData()
    } catch (err) {
        showMessage('error', err.message)
      }
  }

  function getStatusBadge(med) {
    if (med.isExpired) return <span className="badge badge-danger">已过期</span>
    if (med.daysLeft <= 30) return <span className="badge badge-warning">即将过期</span>
    if (med.quantity <= 0) return <span className="badge badge-secondary">缺货</span>
    if (med.quantity <= 5) return <span className="badge badge-info">库存不足</span>
    return <span className="badge badge-success">正常</span>
  }

  const actionLabels = {
    stock: { label: '入库', btn: 'btn-success', title: '药品入库' },
    take: { label: '取用', btn: 'btn-primary', title: '药品取用' },
    discard: { label: '报废', btn: 'btn-danger', title: '药品报废' },
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
        <h2>药品管理</h2>
        <button className="btn btn-primary" onClick={() => { setEditingMedicine(null); setShowForm(true) }}>
          + 新增药品
        </button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="filter-group">
          {filterOptions.map((opt) => (
            <button
              key={opt.key || 'all'}
              className={`filter-btn ${filter === opt.key ? 'active' : ''}`}
              onClick={() => setFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <select
            className="filter-btn"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">全部位置</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      {medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <p>暂无药品数据</p>
        </div>
      ) : (
        <table>
          <thead>
          <tr>
            <th>药品名称</th>
            <th>批号</th>
            <th>数量</th>
            <th>有效期</th>
            <th>剩余天数</th>
            <th>位置</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          {medicines.map((med) => (
            <tr key={med.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{med.name}</div>
                {med.note && <div style={{ fontSize: '0.8rem', color: '#718096' }}>{med.note}</div>}
              </td>
              <td>{med.batchNo}</td>
              <td>{med.quantity}</td>
              <td>{med.expiryDate}</td>
              <td>
                {med.isExpired
                  ? <span style={{ color: '#e53e3e', fontWeight: 600 }}>已过期 {Math.abs(med.daysLeft)} 天</span>
                  : <span>{med.daysLeft} 天</span>
                }
              </td>
              <td>{med.location || '-'}</td>
              <td>{getStatusBadge(med)}</td>
              <td>
                <div className="action-buttons">
                  <button className="btn btn-success btn-sm" onClick={() => openAction('stock', med)}>入库</button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openAction('take', med)}
                    disabled={med.quantity <= 0 || med.isExpired}
                  >取用</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => openAction('discard', med)}
                    disabled={med.quantity <= 0}
                  >报废</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(med)}>编辑</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(med.id, med.name)}>删除</button>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        )}

      {showForm && (
        <MedicineForm
          medicine={editingMedicine}
          onSubmit={editingMedicine ? handleUpdate : handleAdd}
          onClose={() => { setShowForm(false); setEditingMedicine(null) }}
        />
      )}

      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{actionLabels[actionModal.type].title} - {actionModal.medicine.name}</h3>
              <button className="close-btn" onClick={() => setActionModal(null)}>×</button>
            </div>
            <div className="form-group">
              <label>当前库存</label>
              <input type="text" value={actionModal.medicine.quantity} disabled />
            </div>
            <div className="form-group">
              <label>数量</label>
              <input
                type="number"
                min="1"
                value={actionModal.quantity}
                onChange={(e) => setActionModal({ ...actionModal, quantity: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="form-group">
              <label>备注</label>
              <textarea
                value={actionModal.note}
                onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActionModal(null)}>取消</button>
              <button className={`btn ${actionLabels[actionModal.type].btn}`} onClick={handleAction}>
                确认{actionLabels[actionModal.type].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
