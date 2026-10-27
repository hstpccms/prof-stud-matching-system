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
    // ไม่ redirect ถ้าเป็น request ล็อกอินเอง (ให้หน้า Login แสดง error ได้)
    const isLoginReq = (err.config?.url || '').includes('/auth/login')
    if (err.response?.status === 401 && !isLoginReq) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password })

export const getMe = () => api.get('/auth/me')

// ── Admin: user accounts ────────────────────────────────────────────────────────
export const listUsers = (params?: { role?: string; program?: string }) =>
  api.get('/admin/users', { params })
export const createUser = (body: {
  username: string; password: string; role: string;
  full_name?: string; student_id?: string; program?: string;
}) => api.post('/admin/users', body)
export const createUsersBulk = (users: any[]) => api.post('/admin/users/bulk', { users })
export const resetUserPassword = (id: number, new_password: string) =>
  api.post(`/admin/users/${id}/reset-password`, { new_password })
export const deleteUser = (id: number) => api.delete(`/admin/users/${id}`)

// ── Student portal ──────────────────────────────────────────────────────────────
export const getStudentMe = () => api.get('/student/me')
export const getStudentRoster = () => api.get('/student/roster')
export const submitStudentForm1 = (body: any) => api.post('/student/form1', body)
export const getProfessorsForRanking = () => api.get('/student/form3/professors')
export const submitStudentForm3 = (rankings: { prof_anonymous_code: string; rank: number }[]) =>
  api.post('/student/form3', { rankings })

// ── Professor portal ────────────────────────────────────────────────────────────
export const getProfessorMe = () => api.get('/professor/me')
export const submitProfessorForm2 = (expertise: string, quota: number) =>
  api.post('/professor/form2', { expertise, quota })
export const getGroupsForScoring = () => api.get('/professor/form4/groups')
export const submitProfessorForm4 = (scores: { group_anonymous_code: string; score_a: number; score_b: number }[]) =>
  api.post('/professor/form4', { scores })

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = (program?: string) => api.get('/data/sessions/latest/dashboard', { params: program ? { program } : undefined })

// ── Data ──────────────────────────────────────────────────────────────────────
export const listSessions = (program?: string) => api.get('/data/sessions', { params: program ? { program } : undefined })
export const getGroups = (sid: number, program?: string) => api.get(`/data/sessions/${sid}/groups`, { params: program ? { program } : undefined })
export const getProfessors = (sid: number, program?: string) => api.get(`/data/sessions/${sid}/professors`, { params: program ? { program } : undefined })
export const getRankings = (sid: number, program?: string) => api.get(`/data/sessions/${sid}/rankings`, { params: program ? { program } : undefined })
export const getScores = (sid: number, program?: string) => api.get(`/data/sessions/${sid}/scores`, { params: program ? { program } : undefined })
export const validateSession = (sid: number, program?: string) => api.post(`/data/sessions/${sid}/validate`, null, { params: program ? { program } : undefined })

// ── Matching ──────────────────────────────────────────────────────────────────
export const runMatching = (session_id: number, seed: number, program: string) =>
  api.post('/matching/run', { session_id, seed, program })

export const listRuns = (program?: string) => api.get('/matching/runs', { params: program ? { program } : undefined })
export const getRecentRuns = (program?: string) => api.get('/matching/runs/recent', { params: program ? { program } : undefined })
export const getRun = (runId: number) => api.get(`/matching/runs/${runId}`)
export const getResults = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/results`, { params: mode ? { mode } : undefined })
export const getProfSummary = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/professor-summary`, { params: mode ? { mode } : undefined })
export const getStats = (runId: number, mode?: 'student' | 'professor') =>
  api.get(`/matching/runs/${runId}/stats`, { params: mode ? { mode } : undefined })

// ── Download ──────────────────────────────────────────────────────────────────
export const downloadUpload = (sid: number, program?: string) =>
  `/api/download/upload/${sid}${program ? `?program=${encodeURIComponent(program)}` : ''}`

export const downloadResult = (runId: number) =>
  `/api/download/result/${runId}`

// ── Round management (admin) ─────────────────────────────────────────────────
export const getRoundStatus = (program?: string) => api.get('/round/status', { params: program ? { program } : undefined })
export const openRound = (program: string, expected_counts: any = {}) =>
  api.post('/round/open', { program, expected_counts })
export const generateAnonymousCodes = (program: string) => api.post('/round/generate-codes', { program })
export const closeRound = (program: string) => api.post('/round/close', { program })
export const reopenRound = (program: string) => api.post('/round/reopen', { program })
export const getRosterCheck = (program?: string) => api.get('/round/roster-check', { params: program ? { program } : undefined })

export default api
