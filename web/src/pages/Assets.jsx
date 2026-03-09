import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { a2aApi } from '../api/client'

function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'all',
    minGDI: 0,
    search: ''
  })
  const [sortConfig, setSortConfig] = useState({
    key: 'gdi_score',
    direction: 'desc'
  })

  useEffect(() => {
    fetchAssets()
  }, [filter])

  const fetchAssets = async () => {
    try {
      setLoading(true)
      // For now, use directory endpoint
      // In production, use a dedicated assets endpoint
      const res = await a2aApi.directory()
      
      // Mock data for demonstration
      const mockAssets = [
        {
          asset_id: 'gene_error_handling_v1',
          type: 'Gene',
          category: 'error-handling',
          gdi_score: 0.89,
          status: 'promoted',
          confidence_level: 'high',
          published_at: new Date(Date.now() - 86400000).toISOString(),
          summary: '优雅处理API错误的Gene，包含完整的错误分类和恢复策略'
        },
        {
          asset_id: 'capsule_api_optimization',
          type: 'Capsule',
          category: 'performance',
          gdi_score: 0.76,
          status: 'candidate',
          confidence_level: 'medium',
          published_at: new Date(Date.now() - 172800000).toISOString(),
          summary: 'API响应时间优化方案，实测提升40%性能'
        },
        {
          asset_id: 'gene_auth_flow',
          type: 'Gene',
          category: 'security',
          gdi_score: 0.45,
          status: 'quarantined',
          confidence_level: 'low',
          published_at: new Date(Date.now() - 259200000).toISOString(),
          summary: 'JWT认证流程实现，但缺乏完整的测试覆盖'
        },
        {
          asset_id: 'capsule_db_migration',
          type: 'Capsule',
          category: 'database',
          gdi_score: 0.92,
          status: 'promoted',
          confidence_level: 'high',
          published_at: new Date(Date.now() - 43200000).toISOString(),
          summary: '零停机数据库迁移方案，已在生产环境验证'
        },
        {
          asset_id: 'gene_logging_best_practices',
          type: 'Gene',
          category: 'observability',
          gdi_score: 0.83,
          status: 'promoted',
          confidence_level: 'high',
          published_at: new Date(Date.now() - 604800000).toISOString(),
          summary: '结构化日志最佳实践，支持ELK集成'
        }
      ]
      
      setAssets(mockAssets)
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    })
  }

  const filteredAssets = assets
    .filter(asset => {
      if (filter.status !== 'all' && asset.status !== filter.status) return false
      if (asset.gdi_score < filter.minGDI) return false
      if (filter.search && !asset.asset_id.toLowerCase().includes(filter.search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortConfig.direction === 'asc') {
        return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1
      }
      return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1
    })

  const getStatusBadge = (status) => {
    switch (status) {
      case 'promoted':
        return <span className="badge badge-promoted">Promoted</span>
      case 'candidate':
        return <span className="badge badge-candidate">Candidate</span>
      case 'quarantined':
        return <span className="badge badge-quarantined">Quarantined</span>
      default:
        return <span className="badge">{status}</span>
    }
  }

  const getConfidenceBadge = (level) => {
    switch (level) {
      case 'high':
        return <span className="badge badge-high">High</span>
      case 'medium':
        return <span className="badge badge-medium">Medium</span>
      case 'low':
        return <span className="badge badge-low">Low</span>
      default:
        return <span className="badge">{level}</span>
    }
  }

  const getGDIColor = (score) => {
    if (score >= 0.7) return 'var(--secondary)'
    if (score >= 0.5) return 'var(--warning)'
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
        <h1 style={{ marginBottom: '0.5rem' }}>资产列表</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          管理所有 Gene 和 Capsule 资产
        </p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} 
            />
            <input
              type="text"
              className="form-input"
              placeholder="搜索资产ID..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} color="var(--text-muted)" />
            <select
              className="form-select"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              style={{ width: 140 }}
            >
              <option value="all">所有状态</option>
              <option value="promoted">Promoted</option>
              <option value="candidate">Candidate</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              最小 GDI:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filter.minGDI}
              onChange={(e) => setFilter({ ...filter, minGDI: parseFloat(e.target.value) })}
              style={{ width: 100 }}
            />
            <span style={{ fontSize: '0.875rem', minWidth: 40 }}>
              {(filter.minGDI * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort('asset_id')} style={{ cursor: 'pointer' }}>
                  资产ID
                  {sortConfig.key === 'asset_id' && (
                    sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                  )}
                </th>
                <th>类型</th>
                <th>类别</th>
                <th onClick={() => handleSort('gdi_score')} style={{ cursor: 'pointer' }}>
                  GDI
                  {sortConfig.key === 'gdi_score' && (
                    sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                  )}
                </th>
                <th>状态</th>
                <th>置信度</th>
                <th>发布时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.asset_id}>
                  <td>
                    <Link 
                      to={`/assets/${asset.asset_id}`}
                      style={{ 
                        color: 'var(--primary)', 
                        textDecoration: 'none',
                        fontWeight: 500
                      }}
                    >
                      {asset.asset_id}
                    </Link>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)', 
                      marginTop: '0.25rem',
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {asset.summary}
                    </p>
                  </td>
                  <td>{asset.type}</td>
                  <td>{asset.category}</td>
                  <td>
                    <span style={{ 
                      fontWeight: 700, 
                      color: getGDIColor(asset.gdi_score),
                      fontSize: '1.125rem'
                    }}>
                      {(asset.gdi_score * 100).toFixed(0)}
                    </span>
                  </td>
                  <td>{getStatusBadge(asset.status)}</td>
                  <td>{getConfidenceBadge(asset.confidence_level)}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {new Date(asset.published_at).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAssets.length === 0 && (
          <div className="empty-state">
            <p style={{ color: 'var(--text-secondary)' }}>
              没有找到符合条件的资产
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Assets
