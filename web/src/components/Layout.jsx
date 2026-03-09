import { Outlet, NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Package, 
  Server, 
  Upload, 
  Settings,
  Dna
} from 'lucide-react'

function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Dna size={32} color="#6366f1" />
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>EvoHub</h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v2.5.0</p>
            </div>
          </div>
        </div>

        <nav>
          <ul className="nav">
            <li className="nav-item">
              <NavLink to="/" className="nav-link" end>
                <LayoutDashboard size={20} />
                <span>仪表盘</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/assets" className="nav-link">
                <Package size={20} />
                <span>资产列表</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/nodes" className="nav-link">
                <Server size={20} />
                <span>节点管理</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/publish" className="nav-link">
                <Upload size={20} />
                <span>发布资产</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/settings" className="nav-link">
                <Settings size={20} />
                <span>设置</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div style={{ 
          marginTop: 'auto', 
          paddingTop: '2rem',
          borderTop: '1px solid var(--border)',
          marginTop: '2rem'
        }}>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              GEP-A2A Protocol v1.0.0
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Private Mini-Hub
            </p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
