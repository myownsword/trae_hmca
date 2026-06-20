import { useState } from 'react'
import { importPreview, importConfirm, exportCSV } from '../api.js'

export default function ImportExport() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [dragging, setDragging] = useState(false)

  function showMessage(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(null)
      setError(null)
    }
  }

  async function handlePreview() {
    if (!file) {
      setError('请先选择文件')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await importPreview(file)
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!file) return
    if (!preview) return
    if (preview.errors > 0) {
      setError(`文件存在 ${preview.errors} 条错误记录，无法导入。请修正所有错误后重新上传。`)
      return
    }
    if (!confirm(`确定要导入吗？将新增 ${preview?.toAdd || 0} 条记录，跳过 ${preview?.skipped || 0} 条重复记录。`)) return
    try {
      setLoading(true)
      setError(null)
      const result = await importConfirm(file)
      showMessage('success', `成功导入 ${result.added} 条记录${result.skipped ? `，跳过 ${result.skipped} 条重复记录` : ''}`)
      setFile(null)
      setPreview(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    try {
      setError(null)
      await exportCSV()
      showMessage('success', '导出成功')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>导入导出</h2>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="import-export-section">
        <div className="import-area">
          <h3 className="section-title">CSV 导入</h3>
          <p style={{ marginBottom: '1rem', color: '#718096', fontSize: '0.9rem' }}>
            CSV 文件必须包含列：<code>name, batchNo, quantity, expiryDate</code>
            <br />可选列：<code>location, note</code>
          </p>

          <div
            className={`file-drop-zone ${dragging ? 'dragging' : ''}`}
            onClick={() => document.getElementById('file-input')?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e) }}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ fontSize: '2rem' }}>📁</div>
            {file ? (
              <p>已选择文件：<strong>{file.name}</strong></p>
            ) : (
              <p>点击或拖拽 CSV 文件到此处</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary" onClick={handlePreview} disabled={!file || loading}>
              {loading ? '处理中...' : '预览导入'}
            </button>
            <button
              className="btn btn-success"
              onClick={handleImport}
              disabled={!preview || loading || preview.errors > 0}
              title={preview?.errors > 0 ? '存在错误记录，请修正后重新上传' : ''}
            >
              确认导入
            </button>
          </div>

          {preview && preview.errors > 0 && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              ⚠️ 文件存在 <strong>{preview.errors}</strong> 条错误记录，无法导入。
              请修正下方列出的所有错误后，重新上传文件。
            </div>
          )}

          {preview && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>导入预览结果</h4>
              <div className="preview-stats">
                <div className="preview-stat add">
                  <div className="count">{preview.toAdd}</div>
                  <div className="label">将新增</div>
                </div>
                <div className="preview-stat skip">
                  <div className="count">{preview.skipped}</div>
                  <div className="label">跳过</div>
                </div>
                <div className="preview-stat error">
                  <div className="count">{preview.errors}</div>
                  <div className="label">报错</div>
                </div>
              </div>

              {preview.details?.toAdd?.length > 0 && (
                <details className="preview-details">
                  <summary>将新增的记录 ({preview.details.toAdd.length} 条)</summary>
                  {preview.details.toAdd.map((row, idx) => (
                    <div className="preview-row" key={idx}>
                      <span className="line">第 {row.line} 行:</span>
                      {row.data.name} - {row.data.batchNo}
                    </div>
                  ))}
                </details>
              )}

              {preview.details?.skipped?.length > 0 && (
                <details className="preview-details">
                <summary>跳过的记录 ({preview.details.skipped.length} 条)</summary>
                  {preview.details.skipped.map((row, idx) => (
                    <div className="preview-row" key={idx}>
                      <span className="line">第 {row.line} 行:</span>
                      {row.reason}
                    </div>
                  ))}
                </details>
              )}

              {preview.details?.errors?.length > 0 && (
                <details className="preview-details">
                  <summary>报错的记录 ({preview.details.errors.length} 条)</summary>
                  {preview.details.errors.map((row, idx) => (
                    <div className="preview-row" key={idx}>
                      <span className="line">第 {row.line} 行:</span>
                      {row.reason}
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>

        <div className="export-area">
          <h3 className="section-title">CSV 导出</h3>
          <p style={{ marginBottom: '1rem', color: '#718096', fontSize: '0.9rem' }}>
            导出所有药品数据，包括库存状态、有效期、剩余天数和最近操作记录等信息。
          </p>
          <button className="btn btn-success" onClick={handleExport}>
            导出 CSV
          </button>

          <div style={{ marginTop: '2rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>导出字段说明</h4>
            <ul style={{ color: '#4a5568', fontSize: '0.9rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
              <li><code>name</code> - 药品名称</li>
              <li><code>batchNo</code> - 批号</li>
              <li><code>quantity</code> - 当前库存数量</li>
              <li><code>expiryDate</code> - 有效期</li>
              <li><code>location</code> - 存放位置</li>
              <li><code>note</code> - 备注</li>
              <li><code>daysLeft</code> - 距离过期天数</li>
              <li><code>lastOperationType</code> - 最近操作类型</li>
              <li><code>lastOperationQuantity</code> - 最近操作数量</li>
              <li><code>lastOperationDate</code> - 最近操作时间</li>
              <li><code>lastOperationNote</code> - 最近操作备注</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
