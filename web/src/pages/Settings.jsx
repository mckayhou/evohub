import { useState, useEffect } from 'react'
import { Key, Server, Database, Save, CheckCircle } from 'lucide-react'

function Settings() {
  const [settings, setSettings] = useState({
    apiUrl: 'http://localhost:3000',
    token: '',
    nodeId: ''
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load settings from localStorage
    const token = localStorage.getItem('evohub_token') || ''
    const nodeId = localStorage.getItem('evohub_node_id') || ''
    setSettings(prev => ({ ...prev, token, nodeId }))
  }, [])

  const handleSave = () => {
    localStorage.setItem('evohub_token', settings.token)
    localStorage.setItem('evohub_node_id', settings.nodeId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRegister = async () => {
    try {
      const res = await fetch(`${settings.apiUrl}/a2a/hello`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: 'gep-a2a',
          protocol_version: '1.0.0'
        })
      })
      const data = await res.json()
      
      if (data.token) {
        setSettings({
          ...settings,
          token: data.token,
          nodeId: data.node_id
        })
        localStorage.setItem('evohub_token', data.token)
        localStorage.setItem('evohub_node_id', data.node_id)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      alert('注册失败: ' + error.message)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>设置</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          配置 EvoHub Web 面板
        </p>
      </div>

      <div style={{ maxWidth: 600 }}>
        {/* Connection Settings */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Server size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
              连接设置
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">API 地址</label>
            <input
              type="text"
              className="form-input"
              value={settings.apiUrl}
              onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
              placeholder="http://localhost:3000"
            />
          </div>

          <div style={{ 
            background: 'var(--bg-tertiary)', 
            padding: '1rem', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem'
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              还没有节点？点击注册获取 Token
            </p>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={handleRegister}
            >
              注册新节点
            </button>
          </div>
        </div>

        {/* Authentication */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Key size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
              认证信息
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">节点 ID</label>
            <input
              type="text"
              className="form-input"
              value={settings.nodeId}
              onChange={(e) => setSettings({ ...settings, nodeId: e.target.value })}
              placeholder="node_xxxxx"
              readOnly
            />
          </div>

          <div className="form-group">
            <label className="form-label">JWT Token</label>
            <textarea
              className="form-textarea"
              value={settings.token}
              onChange={(e) => setSettings({ ...settings, token: e.target.value })}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              rows={3}
              style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Token 用于认证 API 请求，请勿泄露给他人
            </p>
          </div>
        </div>

        {/* System Info */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Database size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
              系统信息
            </h3>
          </div>

          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Web 面板版本</span>
              <span>2.5.0</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>GEP-A2A 协议</span>
              <span>v1.0.0</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>React 版本</span>
              <span>18.2.0</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? (
              <>
                <CheckCircle size={18} />
                已保存
              </>
            ) : (
              <>
                <Save size={18} />
                保存设置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
