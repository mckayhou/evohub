import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Plus, X, CheckCircle, AlertCircle } from 'lucide-react'
import { a2aApi } from '../api/client'

function Publish() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    asset_id: '',
    type: 'Gene',
    version: '1.0.0',
    signals_match: [''],
    summary: '',
    preconditions: [''],
    constraints: { timeout: 5000, memory: '256MB' },
    code_diff: '',
    validate_commands: ['npm test']
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const asset = {
        ...formData,
        signals_match: formData.signals_match.filter(s => s.trim()),
        preconditions: formData.preconditions.filter(p => p.trim())
      }

      const res = await a2aApi.publish([asset])
      
      if (res.data.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/assets')
        }, 2000)
      }
    } catch (err) {
      setError(err.response?.data?.error || '发布失败')
    } finally {
      setLoading(false)
    }
  }

  const addSignal = () => {
    setFormData({
      ...formData,
      signals_match: [...formData.signals_match, '']
    })
  }

  const removeSignal = (index) => {
    setFormData({
      ...formData,
      signals_match: formData.signals_match.filter((_, i) => i !== index)
    })
  }

  const updateSignal = (index, value) => {
    const newSignals = [...formData.signals_match]
    newSignals[index] = value
    setFormData({ ...formData, signals_match: newSignals })
  }

  const addPrecondition = () => {
    setFormData({
      ...formData,
      preconditions: [...formData.preconditions, '']
    })
  }

  const removePrecondition = (index) => {
    setFormData({
      ...formData,
      preconditions: formData.preconditions.filter((_, i) => i !== index)
    })
  }

  const updatePrecondition = (index, value) => {
    const newPreconditions = [...formData.preconditions]
    newPreconditions[index] = value
    setFormData({ ...formData, preconditions: newPreconditions })
  }

  if (success) {
    return (
      <div className="empty-state">
        <CheckCircle size={64} color="var(--secondary)" style={{ marginBottom: '1rem' }} />
        <h2 className="empty-state-title">发布成功！</h2>
        <p className="empty-state-desc">
          您的资产已提交进行 GDI 评分
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/assets')}>
          查看资产列表
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>发布资产</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          创建新的 Gene 或 Capsule 资产
        </p>
      </div>

      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: 'var(--danger)'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          {/* Basic Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">基本信息</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">资产ID</label>
              <input
                type="text"
                className="form-input"
                value={formData.asset_id}
                onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                placeholder="例如: gene_error_handling_v1"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">类型</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Gene">Gene</option>
                  <option value="Capsule">Capsule</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">版本</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">摘要</label>
              <textarea
                className="form-textarea"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="简要描述这个资产的功能..."
                rows={3}
                required
              />
            </div>
          </div>

          {/* Signals & Preconditions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">信号与条件</h3>
            </div>

            <div className="form-group">
              <label className="form-label">信号标签</label>
              {formData.signals_match.map((signal, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={signal}
                    onChange={(e) => updateSignal(index, e.target.value)}
                    placeholder="例如: error-handling"
                  />
                  {formData.signals_match.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeSignal(index)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSignal}>
                <Plus size={14} />
                添加信号
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">前置条件</label>
              {formData.preconditions.map((pre, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={pre}
                    onChange={(e) => updatePrecondition(index, e.target.value)}
                    placeholder="例如: node >= 18"
                  />
                  {formData.preconditions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removePrecondition(index)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addPrecondition}>
                <Plus size={14} />
                添加条件
              </button>
            </div>
          </div>
        </div>

        {/* Code Diff */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">代码差异</h3>
          </div>
          <textarea
            className="form-textarea"
            value={formData.code_diff}
            onChange={(e) => setFormData({ ...formData, code_diff: e.target.value })}
            placeholder="粘贴您的代码差异..."
            rows={10}
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        {/* Validation Commands */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">验证命令</h3>
          </div>
          <input
            type="text"
            className="form-input"
            value={formData.validate_commands.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              validate_commands: e.target.value.split(',').map(c => c.trim()) 
            })}
            placeholder="npm test, npm run lint"
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/assets')}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                发布中...
              </>
            ) : (
              <>
                <Upload size={18} />
                发布资产
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Publish
