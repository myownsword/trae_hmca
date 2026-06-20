import { useState, useEffect } from 'react'
import { getMedicines } from '../api.js'

const weekDays = [
  { key: 0, label: '周日' },
  { key: 1, label: '周一' },
  { key: 2, label: '周二' },
  { key: 3, label: '周三' },
  { key: 4, label: '周四' },
  { key: 5, label: '周五' },
  { key: 6, label: '周六' },
]

function getTodayString() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

export default function MedicationPlanForm({ onSubmit, onClose }) {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    medicineId: '',
    memberName: '',
    dosagePerTime: 1,
    frequency: 'daily',
    frequencyDays: [0, 1, 2, 3, 4, 5, 6],
    startDate: getTodayString(),
    endDate: '',
    reminderTimes: ['08:00'],
    note: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    loadMedicines()
  }, [])

  async function loadMedicines() {
    try {
      setLoading(true)
      const meds = await getMedicines()
      const available = meds.filter(m => !m.isExpired && m.quantity > 0)
      setMedicines(available)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function handleFrequencyChange(frequency) {
    setFormData(prev => ({
      ...prev,
      frequency,
      frequencyDays: frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : []
    }))
  }

  function toggleDay(day) {
    setFormData(prev => {
      const days = prev.frequencyDays.includes(day)
        ? prev.frequencyDays.filter(d => d !== day)
        : [...prev.frequencyDays, day]
      return { ...prev, frequencyDays: days }
    })
  }

  function addReminderTime() {
    setFormData(prev => ({
      ...prev,
      reminderTimes: [...prev.reminderTimes, '12:00']
    }))
  }

  function updateReminderTime(index, value) {
    setFormData(prev => {
      const times = [...prev.reminderTimes]
      times[index] = value
      return { ...prev, reminderTimes: times }
    })
  }

  function removeReminderTime(index) {
    setFormData(prev => ({
      ...prev,
      reminderTimes: prev.reminderTimes.filter((_, i) => i !== index)
    }))
  }

  function validate() {
    const newErrors = {}
    if (!formData.medicineId) newErrors.medicineId = '请选择药品'
    if (!formData.memberName.trim()) newErrors.memberName = '请输入成员姓名'
    if (!formData.dosagePerTime || formData.dosagePerTime < 1) {
      newErrors.dosagePerTime = '每次用量必须是正整数'
    }
    if (formData.frequencyDays.length === 0) {
      newErrors.frequencyDays = '请选择服用日期'
    }
    if (!formData.startDate) newErrors.startDate = '请选择开始日期'
    if (!formData.endDate) newErrors.endDate = '请选择结束日期'
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.endDate = '结束日期不能早于开始日期'
    }
    if (formData.reminderTimes.length === 0) {
      newErrors.reminderTimes = '请至少添加一个提醒时间'
    }
    if (formData.reminderTimes.some(t => !t || !/^\d{2}:\d{2}$/.test(t))) {
      newErrors.reminderTimes = '提醒时间格式不正确'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    const selectedMedicine = medicines.find(m => m.id === formData.medicineId)
    if (selectedMedicine && formData.endDate > selectedMedicine.expiryDate) {
      setErrors(prev => ({ ...prev, endDate: '结束日期不能晚于药品有效期' }))
      return
    }

    onSubmit({
      ...formData,
      memberName: formData.memberName.trim(),
      dosagePerTime: parseInt(formData.dosagePerTime, 10),
    })
  }

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem' }}>加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  const selectedMedicine = medicines.find(m => m.id === formData.medicineId)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>创建用药计划</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>选择药品 <span style={{ color: '#e53e3e' }}>*</span></label>
            <select
              name="medicineId"
              value={formData.medicineId}
              onChange={handleChange}
              style={errors.medicineId ? { borderColor: '#e53e3e' } : {}}
            >
              <option value="">请选择药品</option>
              {medicines.map(med => (
                <option key={med.id} value={med.id}>
                  {med.name} - {med.batchNo} (库存: {med.quantity}, 有效期: {med.expiryDate})
                </option>
              ))}
            </select>
            {errors.medicineId && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.medicineId}</div>}
            {selectedMedicine && (
              <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>
                该药品有效期至 {selectedMedicine.expiryDate}，计划结束日期不能晚于此日期
              </div>
            )}
          </div>

          <div className="form-group">
            <label>成员姓名 <span style={{ color: '#e53e3e' }}>*</span></label>
            <input
              type="text"
              name="memberName"
              value={formData.memberName}
              onChange={handleChange}
              placeholder="例如：爸爸、妈妈、小明"
              style={errors.memberName ? { borderColor: '#e53e3e' } : {}}
            />
            {errors.memberName && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.memberName}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>每次用量 <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="number"
                name="dosagePerTime"
                min="1"
                value={formData.dosagePerTime}
                onChange={handleChange}
                style={errors.dosagePerTime ? { borderColor: '#e53e3e' } : {}}
              />
              {errors.dosagePerTime && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.dosagePerTime}</div>}
            </div>

            <div className="form-group">
              <label>服用频次 <span style={{ color: '#e53e3e' }}>*</span></label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${formData.frequency === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleFrequencyChange('daily')}
                  style={{ flex: 1 }}
                >
                  每日
                </button>
                <button
                  type="button"
                  className={`btn ${formData.frequency === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleFrequencyChange('weekly')}
                  style={{ flex: 1 }}
                >
                  每周
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>
              {formData.frequency === 'daily' ? '每日服用' : '每周服用日期'}
              <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {weekDays.map(day => (
                <button
                  key={day.key}
                  type="button"
                  className={`btn btn-sm ${formData.frequencyDays.includes(day.key) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleDay(day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {errors.frequencyDays && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.frequencyDays}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>开始日期 <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                style={errors.startDate ? { borderColor: '#e53e3e' } : {}}
              />
              {errors.startDate && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.startDate}</div>}
            </div>

            <div className="form-group">
              <label>结束日期 <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate}
                style={errors.endDate ? { borderColor: '#e53e3e' } : {}}
              />
              {errors.endDate && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.endDate}</div>}
            </div>
          </div>

          <div className="form-group">
            <label>提醒时间 <span style={{ color: '#e53e3e' }}>*</span></label>
            {formData.reminderTimes.map((time, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="time"
                  value={time}
                  onChange={e => updateReminderTime(index, e.target.value)}
                  style={{ flex: 1 }}
                />
                {formData.reminderTimes.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeReminderTime(index)}
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addReminderTime}
            >
              + 添加提醒时间
            </button>
            {errors.reminderTimes && <div style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.reminderTimes}</div>}
          </div>

          <div className="form-group">
            <label>备注</label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="例如：饭后服用、需要多喝水等"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">创建计划</button>
          </div>
        </form>
      </div>
    </div>
  )
}
