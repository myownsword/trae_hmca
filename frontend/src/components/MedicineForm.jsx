import { useState, useEffect } from 'react'

export default function MedicineForm({ medicine, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    batchNo: '',
    quantity: '',
    expiryDate: '',
    location: '',
    note: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!medicine

  useEffect(() => {
    if (medicine) {
      setFormData({
        name: medicine.name || '',
        batchNo: medicine.batchNo || '',
        quantity: medicine.quantity?.toString() || '',
        expiryDate: medicine.expiryDate || '',
        location: medicine.location || '',
        note: medicine.note || '',
      })
    }
  }, [medicine])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const submitData = { ...formData }
      if (!isEdit) {
        submitData.quantity = parseInt(formData.quantity, 10)
      } else {
        delete submitData.quantity
        delete submitData.batchNo
      }
      await onSubmit(submitData)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? '编辑药品' : '新增药品'}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>药品名称 *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="例如：阿莫西林胶囊"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>批号 *</label>
              <input
                type="text"
                name="batchNo"
                value={formData.batchNo}
                onChange={handleChange}
                required
                disabled={isEdit}
                placeholder="例如：20240101"
              />
            </div>
            <div className="form-group">
              <label>有效期 *</label>
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {!isEdit && (
            <div className="form-group">
              <label>初始数量 *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="0"
                placeholder="0"
              />
            </div>
          )}

          <div className="form-group">
            <label>存放位置</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="例如：客厅药箱第一层"
            />
          </div>

          <div className="form-group">
            <label>备注</label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="其他需要记录的信息..."
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '保存中...' : isEdit ? '保存修改' : '添加药品'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
