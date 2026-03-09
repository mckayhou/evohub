import { useEffect, useState } from 'react'
import { Server, Activity, Clock, Cpu } from 'lucide-react'
import { a2aApi } from '../api/client'

function Nodes() {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNodes()
    const interval = setInterval(fetchNodes, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNodes = async () => {
    try {
      setLoading(true)
      const res = await a2aApi.directory()
      
      // Mock data for demonstration
      const mockNodes = [
        {
          node_id: 'node_abc123def456',
          reputation: 0.95,
          capabilities: { gpu: true, memory: '32GB', cpu: '16 cores' },
          last_heartbeat: new Date(Date.now() - 60000).toISOString(),
          credits: 1250,
          status: 'active'
        },
        {
          node_id: 'node_xyz789ghi012',
          reputation: 0.87,
          capabilities: { gpu: false, memory: '16GB', cpu: '8 cores' },
          last_heartbeat: new Date(Date.now() - 300000).toISOString(),
          credits: 890,
          status: 'active'
        },
        {
          node_id: 'node_mno345pqr678',
          reputation: 0.72,
          capabilities: { gpu: true, memory: '64GB', cpu: '32 cores' },
          last_heartbeat: new Date(Date.now() - 900000).toISOString(),
          credits: 2100,
          status: 'idle'
        }
      ]
      
      setNodes(mockNodes)
    } catch (error) {
      console.error('Failed to fetch nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-promoted">Active</span>
      case 'idle':
        return <span className="badge badge-candidate">Idle</span>
      case 'offline':
        return <span className="badge badge-quarantined">Offline</span>
      default:
        return <span className="badge">{status}</span>
    }
  }

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000)
    if (seconds < 60) return `${seconds}秒前`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    return `${hours}小时前`
  }

  const getReputationColor = (rep) => {
    if (rep >= 0.9) return 'var(--secondary)'
    if (rep >= 0.7) return 'var(--warning)'
    return 'var(--danger)'
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>节点管理</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          管理所有连接的 EvoHub 节点
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">
            <Server size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            总节点数
          </div>
          <div className="stat-value">{nodes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Activity size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            活跃节点
          </div>
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>
            {nodes.filter(n => n.status === 'active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Cpu size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            平均信誉
          </div>
          <div className="stat-value">
            {(nodes.reduce((acc, n) => acc + n.reputation, 0) / nodes.length * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Nodes Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '1.5rem'
      }}>
        {nodes.map((node) => (
          <div key={node.node_id} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {node.node_id.slice(0, 20)}...
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ID: {node.node_id}
                </p>
              </div>
              {getStatusBadge(node.status)}
            </div>

            <div style={{ padding: '1rem 0' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>信誉度</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: getReputationColor(node.reputation)
                }}>
                  {(node.reputation * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>信用点</span>
                <span>{node.credits.toLocaleString()}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>最后心跳</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={14} />
                  {getTimeAgo(node.last_heartbeat)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                能力
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(node.capabilities).map(([key, value]) => (
                  <span 
                    key={key} 
                    className="badge" 
                    style={{ background: 'var(--bg-tertiary)', fontSize: '0.75rem' }}
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Nodes
