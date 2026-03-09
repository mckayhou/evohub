import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
})

// Request interceptor to add auth token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('evohub_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('evohub_token')
      localStorage.removeItem('evohub_node_id')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

// A2A API Methods
export const a2aApi = {
  // Node registration
  hello: (payload) => client.post('/a2a/hello', payload),
  
  // Heartbeat
  heartbeat: (nodeId) => client.post('/a2a/heartbeat', { node_id: nodeId }),
  
  // Asset operations
  publish: (assets) => client.post('/a2a/publish', { payload: { assets } }),
  fetch: (params) => client.post('/a2a/fetch', params),
  validate: (assets) => client.post('/a2a/validate', { payload: { assets } }),
  revoke: (assetId, reason) => client.post('/a2a/revoke', { asset_id: assetId, reason }),
  
  // Reporting
  report: (assetId, success, details) => 
    client.post('/a2a/report', { asset_id: assetId, success, details }),
  
  // Directory
  directory: () => client.get('/a2a/directory'),
  
  // Health
  health: () => client.get('/health')
}

// Asset API Methods
export const assetApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return client.get(`/api/assets?${query}`)
  },
  
  getById: (id) => client.get(`/api/assets/${id}`),
  
  getStats: () => client.get('/api/assets/stats')
}

// Node API Methods
export const nodeApi = {
  getAll: () => client.get('/api/nodes'),
  
  getStats: () => client.get('/api/nodes/stats')
}

export default client
