import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchAssetDetail()
  }, [id])

  const fetchAssetDetail = async () => {
    try {
      setLoading(true)
      // Mock data for demonstration
      const mockAsset = {
        asset_id: id,
        type: id.includes('gene') ? 'Gene' : 'Capsule',
        version: '1.0.0',
        category: 'error-handling',
        gdi_score: 0.89,
        status: 'promoted',
        confidence_level: 'high',
        published_at: new Date(Date.now() - 86400000).toISOString(),
        summary: '优雅处理API错误的Gene，包含完整的错误分类和恢复策略',
        quality_score: 0.92,
        usage_score: 0.85,
        social_score: 0.88,
        freshness_score: 0.91,
        signals_match: ['error-handling', 'api-design', 'nodejs'],
        preconditions: ['node >= 18', 'express >= 4.0'],
        constraints: { timeout: 5000, memory: '256MB' },
        code_diff: `// 错误处理中间件
app.use((err, req, res, next) => {
  // 分类错误
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details
    });
  }
  
  // 记录错误
  logger.error('Unhandled error:', err);
  
  // 返回友好响应
  res.status(500).json({
    error: 'Internal Server Error',
    requestId: req.id
  });
});`,
        validate_commands: ['npm test', 'npm run lint', 'npm run typecheck'],
        outcome: '成功将API错误处理时间从平均200ms降低到50ms',
        confidence: 0.95,
        blast_radius: ['src/middleware/', 'src/routes/', 'tests/'],
        env_fingerprint: {
          node: '18.17.0',
          os: 'linux',
          dependencies: { express: '^4.18.2' }
        }
      }
      
      setAsset(mockAsset)
    } catch (error) {
      console.error('Failed to fetch asset:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'promoted':
        return <CheckCircle size={20} color="var(--secondary)" />
      case 'candidate':
        return <AlertTriangle size={20} color="var(--warning)" />
      case 'quarantined':
        return <XCircle size={20} color="var(--danger)" />
      default:
        return null
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

  if (!asset) {
    return (
      <div className="empty-state">
        <p>资产不存在</p>
        <button className="btn btn-primary" onClick={() => navigate('/assets')}>
          返回资产列表
        </button>
      </div>
    )
  }

  return (
    <div>
      <button 
        className="btn btn-secondary" 
        onClick={() => navigate('/assets')}
        style={{ marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={18} />
        返回列表
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <h1 style={{ margin: 0 }}>{asset.asset_id}</h1>
          <span className={`badge badge-${asset.status}`}>
            {asset.status}
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>{asset.summary}</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* GDI Score Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">GDI 评分</h3>
            {getStatusIcon(asset.status)}
          </div>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div 
              className="gdi-circle" 
              style={{ 
                margin: '0 auto 1rem',
                width: 100,
                height: 100,
                fontSize: '2rem',
                background: `${getGDIColor(asset.gdi_score)}20`,
                color: getGDIColor(asset.gdi_score)
              }}
            >
              {(asset.gdi_score * 100).toFixed(0)}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              置信度: <span className={`badge badge-${asset.confidence_level}`}>
                {asset.confidence_level}
              </span>
            </p>
          </div>
        </div>

        {/* GDI Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">评分维度</h3>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {[
              { label: 'Quality', value: asset.quality_score, weight: 35 },
              { label: 'Usage', value: asset.usage_score, weight: 30 },
              { label: 'Social', value: asset.social_score, weight: 20 },
              { label: 'Freshness', value: asset.freshness_score, weight: 15 }
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '0.5rem' 
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.label} ({item.weight}%)
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {(item.value * 100).toFixed(0)}
                  </span>
                </div>
                <div style={{ 
                  height: 8, 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${item.value * 100}%`,
                    height: '100%',
                    background: getGDIColor(item.value),
                    borderRadius: 4,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">元数据</h3>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>类型</span>
              <span>{asset.type}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>版本</span>
              <span>{asset.version}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>类别</span>
              <span>{asset.category}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>发布时间</span>
              <span>{new Date(asset.published_at).toLocaleString('zh-CN')}</span>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                信号标签
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {asset.signals_match.map(signal => (
                  <span key={signal} className="badge" style={{ background: 'var(--bg-tertiary)' }}>
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Diff */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
          <h3 className="card-title">代码差异</h3>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => copyToClipboard(asset.code_diff)}
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <pre className="code-block">{asset.code_diff}</pre>
      </div>

      {/* Validation Commands */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">验证命令</h3>
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          {asset.validate_commands.map((cmd, index) => (
            <div 
              key={index}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }}
            >
              <span style={{ color: 'var(--secondary)' }}>$</span>
              <span>{cmd}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preconditions & Constraints */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem'
      }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">前置条件</h3>
          </div>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
            {asset.preconditions.map((pre, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>{pre}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">约束条件</h3>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {Object.entries(asset.constraints).map(([key, value]) => (
              <div 
                key={key}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetDetail
