import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password })

export const getMe = () => api.get('/auth/me')

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = () => api.get('/data/sessions/latest/dashboard')

// ── Data ──────────────────────────────────────────────────────────────────────
export const uploadFile = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/data/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const listSessions = () => api.get('/data/sessions')
export const getGroups = (sid: number) => api.get(`/data/sessions/${sid}/groups`)
export const getProfessors = (sid: number) => api.get(`/data/sessions/${sid}/professors`)
export const getRankings = (sid: number) => api.get(`/data/sessions/${sid}/rankings`)
export const getScores = (sid: number) => api.get(`/data/sessions/${sid}/scores`)
export const validateSession = (sid: number) => api.post(`/data/sessions/${sid}/validate`)

// ── Matching ──────────────────────────────────────────────────────────────────
export const runMatching = (session_id: number, seed: number) =>
  api.post('/matching/run', { session_id, seed })

export const listRuns = () => api.get('/matching/runs')
export const getRecentRuns = () => api.get('/matching/runs/recent')
export const getRun = (runId: number) => api.get(`/matching/runs/${runId}`)
export const getResults = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/results`, { params: mode ? { mode } : undefined })
export const getProfSummary = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/professor-summary`, { params: mode ? { mode } : undefined })
export const getStats = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/stats`, { params: mode ? { mode } : undefined })

// ── Download ──────────────────────────────────────────────────────────────────
export const downloadUpload = (sid: number) =>
  `/api/download/upload/${sid}`

export const downloadResult = (runId: number) =>
  `/api/download/result/${runId}`

// ── Webhook / MS Forms ───────────────────────────────────────────────────────
export const getWebhookStatus = () => api.get('/webhook/status')
export const activateWebhookSession = (expected_student_count: number, expected_prof_count: number) =>
  api.post('/webhook/activate', { expected_student_count, expected_prof_count })
export const generateAnonymousCodes = () => api.post('/webhook/generate-codes')

export default api
