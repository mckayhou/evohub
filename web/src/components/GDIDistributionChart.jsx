import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function GDIDistributionChart() {
  const [data, setData] = useState([
    { name: 'Promoted (≥70)', value: 65, color: '#10b981' },
    { name: 'Candidate (50-70)', value: 25, color: '#f59e0b' },
    { name: 'Quarantined (<50)', value: 10, color: '#ef4444' }
  ])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem'
        }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{payload[0].name}</p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
            {payload[0].value} 个资产 ({payload[0].percent}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            wrapperStyle={{
              paddingTop: '1rem',
              fontSize: '0.875rem'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default GDIDistributionChart
