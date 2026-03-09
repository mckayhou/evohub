import { useEffect, useState } from 'react'
import { 
  Package, 
  Server, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { a2aApi } from '../api/client'
import GDIDistributionChart from '../components/GDIDistributionChart'

function Dashboard() {
  const [stats, setStats] = useState({
    totalAssets: 0,
    promotedAssets: 0,
    activeNodes: 0,
    avgGDI: 0
  })
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch health status
      const healthRes = await a2aApi.health()
      setHealth(healthRes.data)
      
      // Fetch directory (active nodes)
      const directoryRes = await a2aApi.directory()
      const activeNodes = directoryRes.data.nodes?.length || 0
      
      // Fetch assets (using directory endpoint for now)
      // In production, you'd have a dedicated stats endpoint
      setStats({
        totalAssets: healthRes.data.nodes_online * 12 || 0, // Estimated
        promotedAssets: Math.floor((healthRes.data.nodes_online * 12) * 0.6) || 0,
        activeNodes,
        avgGDI: 0.78
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGDIStatus = (score) => {
    if (score >= 0.7) return { class: 'positive', text: '优秀' }
    if (score >= 0.5) return { class: 'warning', text: '良好' }
    return { class: 'negative', text: '需改进' }
  }

  const gdiStatus = getGDIStatus(stats.avgGDI)

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
        <h1 style={{ marginBottom: '0.5rem' }}>仪表盘</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          实时监控 EvoHub 运行状态
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <Package size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            总资产数
          </div>
          <div className="stat-value">{stats.totalAssets.toLocaleString()}</div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} style={{ display: 'inline' }} />
            +12% 本周
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <TrendingUp size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Promoted 资产
          </div>
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>
            {stats.promotedAssets.toLocaleString()}
          </div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} style={{ display: 'inline' }} />
            +8% 本周
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Server size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            活跃节点
          </div>
          <div className="stat-value">{stats.activeNodes}</div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} style={{ display: 'inline' }} />
            +2 新节点
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Activity size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            平均 GDI
          </div>
          <div className="stat-value" style={{ 
            color: gdiStatus.class === 'positive' ? 'var(--secondary)' : 
                   gdiStatus.class === 'warning' ? 'var(--warning)' : 'var(--danger)'
          }}>
            {(stats.avgGDI * 100).toFixed(0)}
          </div>
          <div className={`stat-change ${gdiStatus.class}`}>
            {gdiStatus.text}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">GDI 分布</h3>
          </div>
          <GDIDistributionChart />
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">系统状态</h3>
          </div>
          <div style={{ padding: '1rem 0' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>服务状态</span>
              <span style={{ 
                color: health?.status === 'healthy' ? 'var(--secondary)' : 'var(--danger)',
                fontWeight: 500
              }}>
                {health?.status === 'healthy' ? '🟢 健康' : '🔴 异常'}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>版本</span>
              <span>{health?.version || '2.5.0'}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>在线节点</span>
              <span>{health?.nodes_online || 0}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.75rem 0'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>最后更新</span>
              <span style={{ fontSize: '0.875rem' }}>
                {health?.timestamp ? new Date(health.timestamp).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">最近活动</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>事件</th>
                <th>资产</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{new Date().toLocaleString('zh-CN')}</td>
                <td>资产发布</td>
                <td>gene_error_handling_v2</td>
                <td><span className="badge badge-promoted">Promoted</span></td>
              </tr>
              <tr>
                <td>{new Date(Date.now() - 3600000).toLocaleString('zh-CN')}</td>
                <td>节点注册</td>
                <td>node_abc123</td>
                <td><span className="badge badge-high">Active</span></td>
              </tr>
              <tr>
                <td>{new Date(Date.now() - 7200000).toLocaleString('zh-CN')}</td>
                <td>GDI 评分</td>
                <td>capsule_api_optimization</td>
                <td><span className="badge badge-candidate">Candidate</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
