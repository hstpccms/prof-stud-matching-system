import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Alert, Button, Typography,
  Tag, Space, Flex, Spin, Empty, Tooltip, Divider,
  Progress, Modal, InputNumber, Form, Table, Badge, Input,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  UploadOutlined, ArrowRightOutlined, ExclamationCircleOutlined,
  WarningOutlined, HistoryOutlined,
  UserOutlined, TeamOutlined, FormOutlined, KeyOutlined, SyncOutlined,
} from '@ant-design/icons'
import { getDashboard, getRecentRuns, getWebhookStatus, activateWebhookSession, generateAnonymousCodes } from '../api/client'
import { useProgram } from '../ProgramContext'
import { PROGRAMS } from '../constants'

const { Title, Text } = Typography

interface StudentMember {
  student_id: string
  full_name: string
}

interface StudentTrackingItem {
  id?: number
  student_id: string
  full_name: string
  group_id: string
  form_submitted: boolean
  status: string
}

interface SubmittedGroupItem {
  group_id: string | number
  anonymous_code?: string | null
  representative?: string | null
  member_count: number
  members?: StudentMember[]
}

interface SubmittedProfItem {
  prof_id: string
  anonymous_code?: string | null
  full_name: string
  expertise?: string | null
  quota: number
  form2_submitted: boolean
  form4_submitted: boolean
  scores_count: number
  total_groups_to_score?: number
}

interface WebhookStatus {
  session_id: number | null
  is_active: boolean
  source: string
  codes_generated: boolean
  expected_student_count: number | null
  received_student_count: number
  received_group_count: number
  form1_ready: boolean
  expected_prof_count: number | null
  received_prof_count: number
  form2_ready: boolean
  ranked_group_count: number
  scored_prof_count: number
  pct_groups_ranked: number
  pct_profs_scored: number
  group_codes: { group_id: number; anonymous_code: string; member_count: number; members: { student_id: string; full_name: string }[] }[]
  prof_codes: { prof_id: number; anonymous_code: string; full_name: string }[]
  submitted_groups: SubmittedGroupItem[]
  submitted_professors?: SubmittedProfItem[]
  students?: StudentTrackingItem[]
}

interface DashboardData {
  latest_session: {
    id: number
    uploaded_at: string
    filename?: string
    status: string
  } | null
  num_groups: number
  num_professors: number
  total_quota: number
  quota_sufficient: boolean
  pct_groups_ranked: number
  pct_profs_scored: number
  incomplete_groups: string[]
  incomplete_profs: string[]
  data_stale: boolean
  groups?: SubmittedGroupItem[]
  professors?: SubmittedProfItem[]
  students?: StudentTrackingItem[]
  latest_run: {
    id: number
    run_at: string
    seed: number
    mode: string
    status: string
    num_matched: number
    num_unmatched: number
    num_ties: number
    num_matched_student: number
    num_unmatched_student: number
    num_matched_professor: number
    num_unmatched_professor: number
    session_id: number
  } | null
}

interface RecentRun {
  id: number
  run_at: string
  seed: number
  mode: string
  status: string
  num_matched: number
  num_unmatched: number
  num_groups: number
}

const MODE_LABELS: Record<string, string> = {
  both: 'Student + Professor',
  student: 'Student-Proposing',
  professor: 'Professor-Proposing',
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleString('th-TH')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null)
  const [activateModalOpen, setActivateModalOpen] = useState(false)
  const [activating, setActivating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [profSearch, setProfSearch] = useState('')
  const [form] = Form.useForm()
  const { program } = useProgram()

  useEffect(() => {
    let isMounted = true
    const fetch = () => {
      getDashboard(program)
        .then(r => { if (isMounted) setData(r.data) })
        .catch(() => {})
        .finally(() => { if (isMounted) setLoading(false) })
      getRecentRuns(program)
        .then(r => { if (isMounted) setRecentRuns(r.data) })
        .catch(() => {})
      getWebhookStatus(program)
        .then(r => { if (isMounted) setWebhookStatus(r.data) })
        .catch(() => {})
    }
    fetch()
    const t = setInterval(fetch, 6000)
    return () => {
      isMounted = false
      clearInterval(t)
    }
  }, [program])

  // ── Consolidated Data Lists (Hooks called unconditionally at top) ──────────
  const groupsList = useMemo<SubmittedGroupItem[]>(() => {
    if (webhookStatus?.submitted_groups && webhookStatus.submitted_groups.length > 0) {
      return webhookStatus.submitted_groups
    }
    if (data?.groups && data.groups.length > 0) {
      return data.groups
    }
    return []
  }, [webhookStatus?.submitted_groups, data?.groups])

  const studentsList = useMemo<StudentTrackingItem[]>(() => {
    if (webhookStatus?.students && webhookStatus.students.length > 0) {
      return webhookStatus.students
    }
    if (data?.students && data.students.length > 0) {
      return data.students
    }
    const list: StudentTrackingItem[] = []
    groupsList.forEach((g, idx) => {
      const gCode = (g.anonymous_code || g.group_id || `กลุ่ม #${idx + 1}`).toString()
      if (g.members && g.members.length > 0) {
        g.members.forEach(m => {
          list.push({
            student_id: m.student_id,
            full_name: m.full_name || '—',
            group_id: gCode,
            form_submitted: true,
            status: 'ส่งแล้ว',
          })
        })
      } else if (g.representative) {
        list.push({
          student_id: (g.group_id || g.anonymous_code || `STD-${idx + 1}`).toString(),
          full_name: g.representative,
          group_id: gCode,
          form_submitted: true,
          status: 'ส่งแล้ว',
        })
      }
    })
    return list
  }, [webhookStatus?.students, data?.students, groupsList])

  const profsList = useMemo<SubmittedProfItem[]>(() => {
    if (webhookStatus?.submitted_professors && webhookStatus.submitted_professors.length > 0) {
      return webhookStatus.submitted_professors
    }
    if (data?.professors && data.professors.length > 0) {
      return data.professors
    }
    return []
  }, [webhookStatus?.submitted_professors, data?.professors])

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsList
    const q = studentSearch.toLowerCase().trim()
    return studentsList.filter(
      s =>
        s.student_id.toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q) ||
        s.group_id.toLowerCase().includes(q)
    )
  }, [studentsList, studentSearch])

  const filteredProfs = useMemo(() => {
    if (!profSearch.trim()) return profsList
    const q = profSearch.toLowerCase().trim()
    return profsList.filter(
      p =>
        p.full_name.toLowerCase().includes(q) ||
        p.prof_id.toLowerCase().includes(q) ||
        (p.expertise && p.expertise.toLowerCase().includes(q))
    )
  }, [profsList, profSearch])

  const safeData: DashboardData = useMemo(() => {
    const totalProfQuota = profsList.reduce((acc, p) => acc + (p.quota || 0), 0)
    const numGroups = data?.num_groups ?? groupsList.length
    const numProfs = data?.num_professors ?? profsList.length
    const totalQuota = data?.total_quota ?? totalProfQuota
    return {
      latest_session: data?.latest_session ?? null,
      num_groups: numGroups,
      num_professors: numProfs,
      total_quota: totalQuota,
      quota_sufficient: data?.quota_sufficient ?? (numGroups === 0 || totalQuota >= numGroups),
      pct_groups_ranked: data?.pct_groups_ranked ?? (webhookStatus?.pct_groups_ranked || 0),
      pct_profs_scored: data?.pct_profs_scored ?? (webhookStatus?.pct_profs_scored || 0),
      incomplete_groups: data?.incomplete_groups ?? [],
      incomplete_profs: data?.incomplete_profs ?? [],
      data_stale: data?.data_stale ?? false,
      groups: groupsList,
      professors: profsList,
      students: studentsList,
      latest_run: data?.latest_run ?? null,
    }
  }, [data, groupsList, profsList, studentsList, webhookStatus])

  const run = safeData.latest_run

  const handleActivate = async (values: any) => {
    setActivating(true)
    try {
      const expected_counts: any = {}
      PROGRAMS.forEach(p => {
        expected_counts[p] = {
          students: values[`students_${p}`] || 0,
          profs: values[`profs_${p}`] || 0,
        }
      })
      await activateWebhookSession(expected_counts)
      setActivateModalOpen(false)
      form.resetFields()
      getWebhookStatus(program).then(r => setWebhookStatus(r.data)).catch(() => {})
    } catch { /* ignore */ }
    setActivating(false)
  }

  const handleGenerateCodes = async () => {
    setGenerating(true)
    try {
      await generateAnonymousCodes()
      getWebhookStatus(program).then(r => setWebhookStatus(r.data)).catch(() => {})
    } catch { /* ignore */ }
    setGenerating(false)
  }

  // ── Alert Banners ─────────────────────────────────────────────────────────
  const banners = useMemo(() => {
    const list: Array<{
      key: string
      type: 'error' | 'warning'
      message: string
      actionLabel?: string
      actionPath?: string
    }> = []

    if (!safeData.quota_sufficient && safeData.num_groups > 0) {
      list.push({
        key: 'quota',
        type: 'error',
        message: `Quota รวมของอาจารย์ (${safeData.total_quota}) น้อยกว่าจำนวนกลุ่มนักศึกษา (${safeData.num_groups}) — ไม่สามารถรัน Matching ได้ กรุณาเพิ่ม Quota`,
        actionLabel: 'ไปหน้าจัดการข้อมูล',
        actionPath: '/data',
      })
    }
    if (run?.status === 'success' && run.num_unmatched > 0) {
      list.push({
        key: 'unmatched',
        type: 'warning',
        message: `การรันล่าสุดมี ${run.num_unmatched} กลุ่มที่ยังไม่ได้จับคู่ (Unmatched)`,
        actionLabel: 'ดูรายละเอียด',
        actionPath: '/results',
      })
    }
    if (safeData.data_stale && safeData.latest_session && run) {
      list.push({
        key: 'stale',
        type: 'warning',
        message: `ข้อมูลมีการอัปเดตหลังรันล่าสุด — "${safeData.latest_session.filename || `Session #${safeData.latest_session.id}`}" อัปโหลดเมื่อ ${formatDateFull(safeData.latest_session.uploaded_at)} แต่รันล่าสุดคือ ${formatDateFull(run.run_at)} ควรรันใหม่`,
        actionLabel: 'รันใหม่',
        actionPath: '/run',
      })
    }
    return list
  }, [safeData, run])

  // ── Codes generated helpers ───────────────────────────────────────────────
  const codesGenerated = webhookStatus?.codes_generated ?? false
  const numGroupsWithCodes = webhookStatus?.group_codes?.length ?? groupsList.length
  const numProfsWithCodes = webhookStatus?.prof_codes?.length ?? profsList.length

  // ── Pipeline steps ────────────────────────────────────────────────────────
  const pipelineSteps = useMemo(() => {
    return [
      {
        key: 'groups',
        title: 'กลุ่มนักศึกษา',
        value: '',
        description: webhookStatus?.is_active
          ? (webhookStatus.form1_ready ? 'ได้รับข้อมูลครบแล้ว' : `กำลังรอข้อมูลจากนักศึกษา (${webhookStatus.received_group_count} กลุ่ม / ${webhookStatus.received_student_count} คน)`)
          : (safeData.num_groups > 0 ? 'ลงทะเบียนในระบบแล้ว' : 'ยังไม่มีข้อมูลกลุ่ม'),
        done: webhookStatus?.is_active
          ? (webhookStatus?.form1_ready ?? false)
          : safeData.num_groups > 0,
        incomplete: [] as string[],
        trackPath: '/data',
      },
      {
        key: 'professors',
        title: 'อาจารย์',
        value: '',
        description: webhookStatus?.is_active
          ? (webhookStatus.form2_ready ? 'ได้รับข้อมูลครบแล้ว' : `กำลังรอข้อมูลจากอาจารย์ (${webhookStatus.received_prof_count} ท่าน)`)
          : (safeData.quota_sufficient
              ? `Quota รวม ${safeData.total_quota} — เพียงพอ`
              : `Quota รวม ${safeData.total_quota} — ไม่เพียงพอ`),
        done: webhookStatus?.is_active
          ? ((webhookStatus?.form2_ready ?? false) && safeData.quota_sufficient)
          : safeData.num_professors > 0 && safeData.quota_sufficient,
        incomplete: safeData.quota_sufficient ? [] : ['Quota ไม่เพียงพอ'],
        trackPath: '/data',
      },
      {
        key: 'rankings',
        title: 'Student Rankings',
        value: codesGenerated ? `${safeData.pct_groups_ranked}%` : '',
        description: codesGenerated
          ? (safeData.pct_groups_ranked >= 100
              ? 'ทุกกลุ่มจัดอันดับครบแล้ว'
              : `${numGroupsWithCodes - safeData.incomplete_groups.length} / ${numGroupsWithCodes} กลุ่มจัดอันดับครบ`)
          : (safeData.num_groups > 0 ? 'รอสร้าง Anonymous Code ก่อน' : 'ยังไม่มีข้อมูล'),
        done: codesGenerated && safeData.pct_groups_ranked >= 100,
        incomplete: safeData.incomplete_groups,
        trackPath: '/data',
      },
      {
        key: 'scores',
        title: 'Professor Scores',
        value: codesGenerated ? `${safeData.pct_profs_scored}%` : '',
        description: codesGenerated
          ? (safeData.pct_profs_scored >= 100
              ? 'ทุกอาจารย์ให้คะแนนครบแล้ว'
              : `${numProfsWithCodes - safeData.incomplete_profs.length} / ${numProfsWithCodes} อาจารย์ให้คะแนนครบ`)
          : (safeData.num_professors > 0 ? 'รอสร้าง Anonymous Code ก่อน' : 'ยังไม่มีข้อมูล'),
        done: codesGenerated && safeData.pct_profs_scored >= 100,
        incomplete: safeData.incomplete_profs,
        trackPath: '/data',
      },
      {
        key: 'algorithm',
        title: 'Matching Algorithm',
        value: '',
        description: !run
          ? 'ยังไม่เคยรัน'
          : run.status === 'running'
          ? 'กำลังรัน...'
          : run.status === 'success'
          ? `สำเร็จ — ${formatDateFull(run.run_at)}`
          : 'ล้มเหลว',
        done: run?.status === 'success',
        incomplete: [],
        trackPath: run?.status === 'success' ? '/results' : '/run',
      },
    ]
  }, [webhookStatus, safeData, codesGenerated, numGroupsWithCodes, numProfsWithCodes, run])

  // ── Matched card colors ───────────────────────────────────────────────────
  const matchedTotal = safeData.num_groups
  const matchedNum = run?.status === 'success' ? run.num_matched : null
  const matchRatio = matchedNum !== null && matchedTotal > 0 ? matchedNum / matchedTotal : null
  const matchCardStyle: React.CSSProperties =
    matchRatio === null
      ? {}
      : matchRatio >= 1
      ? { background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }
      : matchRatio >= 0.8
      ? { background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }
      : { background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8 }
  const matchValueColor =
    matchRatio === null ? '#1677ff'
    : matchRatio >= 1 ? '#52c41a'
    : matchRatio >= 0.8 ? '#fa8c16'
    : '#ff4d4f'

  const hasAnyData =
    groupsList.length > 0 ||
    profsList.length > 0 ||
    safeData.num_groups > 0 ||
    safeData.num_professors > 0 ||
    (webhookStatus?.is_active ?? false)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <Title level={4}>Dashboard</Title>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!hasAnyData) {
    return (
      <div style={{ padding: 32 }}>
        <Flex justify="space-between" align="flex-start" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>Dashboard</Title>
            <Text type="secondary">ภาพรวมสถานะระบบจับคู่อาจารย์ที่ปรึกษา</Text>
          </div>
        </Flex>
        <Card>
          <Empty
            image={<UploadOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
            description={
              <Flex vertical gap={4}>
                <Text>ยังไม่มีข้อมูลในระบบ</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>เริ่มต้นด้วยการอัปโหลดไฟล์ Excel หรือเปิดรอบรับฟอร์ม MS Forms</Text>
              </Flex>
            }
          >
            <Space>
              <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/data')}>
                อัปโหลดข้อมูล
              </Button>
              <Button icon={<FormOutlined />} onClick={() => setActivateModalOpen(true)}>
                เปิดรอบรับฟอร์มใหม่
              </Button>
            </Space>
          </Empty>
        </Card>

        {/* Modal เปิดรอบรับฟอร์ม */}
        <Modal
          title="เปิดรอบรับฟอร์มใหม่"
          open={activateModalOpen}
          onCancel={() => setActivateModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleActivate}>
            {PROGRAMS.map(p => (
              <div key={p} style={{ marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>หลักสูตร: {p}</Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={`students_${p}`} label="นศ. ที่คาดหวัง" rules={[{ required: true }]}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={`profs_${p}`} label="อ. ที่คาดหวัง" rules={[{ required: true }]}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ))}
            <Button type="primary" htmlType="submit" loading={activating} block>
              ยืนยันเปิดรอบรับฟอร์ม
            </Button>
          </Form>
        </Modal>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>Dashboard</Title>
          <Text type="secondary">ภาพรวมสถานะระบบจับคู่อาจารย์ที่ปรึกษา</Text>
        </div>
      </Flex>

      {/* ── Alert Banners ─────────────────────────────────────────────────── */}
      {banners.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {banners.map(b => (
            <Alert
              key={b.key}
              type={b.type}
              showIcon
              icon={b.type === 'error' ? <CloseCircleOutlined /> : <WarningOutlined />}
              message={
                <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                  <span style={{ flex: 1 }}>{b.message}</span>
                  {b.actionLabel && b.actionPath && (
                    <Button
                      size="small"
                      type={b.type === 'error' ? 'primary' : 'default'}
                      danger={b.type === 'error'}
                      onClick={() => navigate(b.actionPath!)}
                      icon={<ArrowRightOutlined />}
                    >
                      {b.actionLabel}
                    </Button>
                  )}
                </Flex>
              }
              style={{ borderRadius: 8 }}
            />
          ))}
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={<Space><TeamOutlined />กลุ่มนักศึกษา</Space>}
              value={safeData.num_groups}
              suffix="กลุ่ม"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={<Space><UserOutlined />อาจารย์</Space>}
              value={safeData.num_professors}
              suffix="ท่าน"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 10,
              ...(!safeData.quota_sufficient && safeData.num_groups > 0 ? { border: '1px solid #ffccc7', background: '#fff2f0' } : {}),
            }}
          >
            <Statistic
              title="Quota รวม"
              value={safeData.total_quota}
              suffix="ที่นั่ง"
              valueStyle={!safeData.quota_sufficient && safeData.num_groups > 0 ? { color: '#ff4d4f' } : undefined}
              prefix={!safeData.quota_sufficient && safeData.num_groups > 0 ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : undefined}
            />
            {!safeData.quota_sufficient && safeData.num_groups > 0 && (
              <Text type="danger" style={{ fontSize: 11 }}>น้อยกว่าจำนวนกลุ่ม ({safeData.num_groups})</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10, ...matchCardStyle }}>
            <Statistic
              title="จับคู่ล่าสุด"
              value={matchedNum !== null ? `${matchedNum} / ${matchedTotal}` : '—'}
              valueStyle={{ color: matchValueColor, fontSize: 28 }}
            />
            {run?.status === 'success' && run.num_unmatched > 0 && (
              <Text style={{ fontSize: 11, color: '#fa8c16' }}>
                เหลือ {run.num_unmatched} กลุ่มที่ยังไม่ได้จับคู่
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Main Row: Pipeline & Recent Runs ─────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Pipeline */}
        <Col xs={24} lg={16}>
          <Card title="Pipeline" style={{ borderRadius: 10 }}>
            <Flex vertical gap={0}>
              {pipelineSteps.map((step, idx) => {
                const isLast = idx === pipelineSteps.length - 1
                const isWarn = !step.done && step.incomplete.length > 0
                const icon = step.done
                  ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  : isWarn
                  ? <WarningOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                  : <ExclamationCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />

                const incomplete = step.incomplete.slice(0, 6)
                const more = step.incomplete.length - 6

                return (
                  <div key={step.key}>
                    <Flex gap={12} align="flex-start" style={{ padding: '10px 0' }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Flex justify="space-between" align="flex-start" gap={8} wrap="wrap">
                          <div>
                            <Text strong style={{ fontSize: 13 }}>{step.title}</Text>
                            {step.value && (
                              <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                                — {step.value}
                              </Text>
                            )}
                            <br />
                            <Text
                              type={step.done ? 'secondary' : isWarn ? 'warning' : 'secondary'}
                              style={{ fontSize: 12 }}
                            >
                              {step.description}
                            </Text>
                            {!step.done && step.key !== 'algorithm' && step.key !== 'professors' && step.incomplete.length > 0 && (
                              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {incomplete.map(code => (
                                  <Tag key={code} color="orange" style={{ fontSize: 11, margin: 0 }}>{code}</Tag>
                                ))}
                                {more > 0 && (
                                  <Tag color="default" style={{ fontSize: 11, margin: 0 }}>+{more} รายการ</Tag>
                                )}
                              </div>
                            )}
                          </div>
                          {!step.done && (
                            <Button
                              size="small"
                              type="link"
                              icon={<ArrowRightOutlined />}
                              onClick={() => navigate(step.trackPath)}
                              style={{ fontSize: 12, flexShrink: 0, color: '#fa8c16', paddingRight: 0 }}
                            >
                              ติดตาม
                            </Button>
                          )}
                        </Flex>
                      </div>
                    </Flex>
                    {!isLast && <Divider style={{ margin: 0 }} />}
                  </div>
                )
              })}
            </Flex>
          </Card>
        </Col>

        {/* Right column */}
        <Col xs={24} lg={8}>
          <Flex vertical gap={12} style={{ width: '100%' }}>
            {/* Latest run details */}
            {run && (
              <Card size="small" style={{ borderRadius: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                  การรันล่าสุด
                </Text>
                <Flex gap={8} align="center" style={{ marginBottom: 8 }}>
                  {run.status === 'success' && <Tag color="success">สำเร็จ</Tag>}
                  {run.status === 'running' && <Tag color="processing">กำลังรัน</Tag>}
                  {run.status === 'failed' && <Tag color="error">ล้มเหลว</Tag>}
                  <Text style={{ fontSize: 12 }}>{formatDateFull(run.run_at)}</Text>
                </Flex>
                <Flex gap={20} align="center">
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Seed</Text>
                    <Text strong style={{ fontSize: 13 }}>{run.seed}</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>โหมด</Text>
                    <Text strong style={{ fontSize: 12 }}>{MODE_LABELS[run.mode] || run.mode}</Text>
                  </div>
                  {run.status === 'success' && (
                    <div style={{ marginLeft: 'auto' }}>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => navigate('/results')}
                      >
                        ดูผล →
                      </Button>
                    </div>
                  )}
                </Flex>
              </Card>
            )}

            {/* Recent run history */}
            {recentRuns.length > 0 && (
              <Card
                size="small"
                style={{ borderRadius: 10 }}
                title={
                  <Space>
                    <HistoryOutlined />
                    <span style={{ fontSize: 13 }}>ประวัติการรัน 3 ครั้งล่าสุด</span>
                  </Space>
                }
              >
                <Flex vertical gap={0}>
                  {recentRuns.map((r, idx) => {
                    const isLast = idx === recentRuns.length - 1
                    const ratio = r.num_groups > 0 ? r.num_matched / r.num_groups : 0
                    const ratioColor =
                      r.status !== 'success' ? '#8c8c8c'
                      : ratio >= 1 ? '#52c41a'
                      : ratio >= 0.8 ? '#fa8c16'
                      : '#ff4d4f'

                    return (
                      <div key={r.id}>
                        <Tooltip title={`Seed: ${r.seed} | คลิกเพื่อดูประวัติ`}>
                          <div
                            onClick={() => navigate('/history')}
                            style={{ cursor: 'pointer', padding: '8px 0', borderRadius: 6, transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Flex justify="space-between" align="center">
                              <div>
                                <Text style={{ fontSize: 12 }}>{formatDateShort(r.run_at)}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {MODE_LABELS[r.mode] || r.mode}
                                </Text>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                {r.status === 'success' ? (
                                  <Text strong style={{ fontSize: 13, color: ratioColor }}>
                                    {r.num_matched} / {r.num_groups}
                                  </Text>
                                ) : (
                                  <Tag
                                    color={r.status === 'running' ? 'processing' : 'error'}
                                    style={{ fontSize: 11 }}
                                  >
                                    {r.status === 'running' ? 'กำลังรัน' : 'ล้มเหลว'}
                                  </Tag>
                                )}
                              </div>
                            </Flex>
                          </div>
                        </Tooltip>
                        {!isLast && <Divider style={{ margin: '2px 0' }} />}
                      </div>
                    )
                  })}
                </Flex>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 12, marginTop: 6 }}
                  onClick={() => navigate('/history')}
                >
                  ดูประวัติทั้งหมด →
                </Button>
              </Card>
            )}
          </Flex>
        </Col>
      </Row>

      {/* ── 1. ส่วนกลุ่มนักศึกษา (Student Groups Section) ───────────────── */}
      <Card
        style={{ borderRadius: 10, marginTop: 20 }}
        title={
          <Flex align="center" gap={8}>
            <TeamOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>ส่วนกลุ่มนักศึกษา</span>
            <Badge count={groupsList.length} style={{ backgroundColor: '#1677ff' }} />
          </Flex>
        }
      >
        <Row gutter={[16, 16]}>
          {/* ตารางสรุปกลุ่ม */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #f0f0f0' }}
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>📊 ตารางสรุปกลุ่ม</span>}
            >
              <Table
                dataSource={groupsList}
                rowKey={r => String(r.group_id || r.anonymous_code || Math.random())}
                size="small"
                pagination={{ pageSize: 8, size: 'small', showTotal: total => `รวม ${total} กลุ่ม` }}
                columns={[
                  {
                    title: 'กลุ่มที่',
                    key: 'group_no',
                    width: 70,
                    align: 'center',
                    render: (_, __, i) => i + 1,
                  },
                  {
                    title: 'GroupID',
                    key: 'group_id',
                    align: 'center',
                    render: (_, r) => (
                      <Tag color="blue" style={{ fontWeight: 600 }}>
                        {r.group_id || r.anonymous_code || '-'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'จำนวนสมาชิก',
                    key: 'member_count',
                    align: 'center',
                    render: (_, r) => `${r.member_count ?? (r.members?.length || 0)} คน`,
                  },
                ]}
              />
            </Card>
          </Col>

          {/* ตารางติดตามรายชื่อนักศึกษาทั้งหมด (ใหม่) */}
          <Col xs={24} lg={16}>
            <Card
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #f0f0f0' }}
              title={
                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>👥 ตารางติดตามรายชื่อนักศึกษาทั้งหมด</span>
                  <Input.Search
                    placeholder="ค้นหารหัส / ชื่อ / กลุ่ม..."
                    allowClear
                    size="small"
                    style={{ width: 220 }}
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                </Flex>
              }
            >
              <Table
                dataSource={filteredStudents}
                rowKey={r => r.student_id || String(Math.random())}
                size="small"
                pagination={{ pageSize: 8, size: 'small', showTotal: total => `รวม ${total} คน` }}
                columns={[
                  {
                    title: 'ลำดับ',
                    key: 'index',
                    width: 60,
                    align: 'center',
                    render: (_, __, i) => i + 1,
                  },
                  {
                    title: 'รหัสนักศึกษา',
                    dataIndex: 'student_id',
                    key: 'student_id',
                    width: 120,
                    render: v => <Text strong>{v}</Text>,
                  },
                  {
                    title: 'ชื่อ-นามสกุล',
                    dataIndex: 'full_name',
                    key: 'full_name',
                    render: v => <Text>{v || '—'}</Text>,
                  },
                  {
                    title: 'กลุ่มที่สังกัด',
                    dataIndex: 'group_id',
                    key: 'group_id',
                    width: 110,
                    align: 'center',
                    render: v => <Tag color="geekblue">{v || '—'}</Tag>,
                  },
                  {
                    title: 'สถานะส่งฟอร์ม',
                    key: 'status',
                    width: 120,
                    align: 'center',
                    render: (_, r) =>
                      r.form_submitted || r.status === 'ส่งแล้ว' ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          ส่งแล้ว
                        </Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>
                          ยังไม่ส่ง
                        </Tag>
                      ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ── 2. ส่วนอาจารย์ (Professors Section) ───────────────────────── */}
      <Card
        style={{ borderRadius: 10, marginTop: 16 }}
        title={
          <Flex align="center" gap={8}>
            <UserOutlined style={{ color: '#722ed1', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>ส่วนอาจารย์</span>
            <Badge count={profsList.length} style={{ backgroundColor: '#722ed1' }} />
          </Flex>
        }
      >
        <Row gutter={[16, 16]}>
          {/* ตารางสรุปโควต้าอาจารย์ */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #f0f0f0' }}
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>📊 ตารางสรุปโควต้าอาจารย์</span>}
            >
              <Table
                dataSource={profsList}
                rowKey={r => String(r.prof_id || r.anonymous_code || Math.random())}
                size="small"
                pagination={{ pageSize: 8, size: 'small', showTotal: total => `รวม ${total} ท่าน` }}
                columns={[
                  {
                    title: 'คนที่',
                    key: 'prof_no',
                    width: 70,
                    align: 'center',
                    render: (_, __, i) => i + 1,
                  },
                  {
                    title: 'ProfID',
                    key: 'prof_id',
                    align: 'center',
                    render: (_, r) => (
                      <Tag color="purple" style={{ fontWeight: 600 }}>
                        {r.prof_id || r.anonymous_code || '-'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'โควต้ากลุ่ม',
                    dataIndex: 'quota',
                    key: 'quota',
                    align: 'center',
                    render: v => (
                      <Text strong style={{ color: '#1677ff', fontSize: 13 }}>
                        {v ?? 0} กลุ่ม
                      </Text>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* ตารางติดตามรายชื่ออาจารย์ทั้งหมด (ใหม่) */}
          <Col xs={24} lg={16}>
            <Card
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #f0f0f0' }}
              title={
                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>👨‍🏫 ตารางติดตามรายชื่ออาจารย์ทั้งหมด</span>
                  <Input.Search
                    placeholder="ค้นหาชื่ออาจารย์ / ความเชี่ยวชาญ..."
                    allowClear
                    size="small"
                    style={{ width: 240 }}
                    value={profSearch}
                    onChange={e => setProfSearch(e.target.value)}
                  />
                </Flex>
              }
            >
              <Table
                dataSource={filteredProfs}
                rowKey={r => String(r.prof_id || r.anonymous_code || Math.random())}
                size="small"
                pagination={{ pageSize: 8, size: 'small', showTotal: total => `รวม ${total} ท่าน` }}
                columns={[
                  {
                    title: 'ลำดับ',
                    key: 'index',
                    width: 60,
                    align: 'center',
                    render: (_, __, i) => i + 1,
                  },
                  {
                    title: 'ชื่อ-นามสกุล',
                    dataIndex: 'full_name',
                    key: 'full_name',
                    width: 170,
                    render: v => <Text strong>{v || '—'}</Text>,
                  },
                  {
                    title: 'ความเชี่ยวชาญ',
                    dataIndex: 'expertise',
                    key: 'expertise',
                    render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text>,
                  },
                  {
                    title: 'โควต้า',
                    dataIndex: 'quota',
                    key: 'quota',
                    width: 90,
                    align: 'center',
                    render: v => <Tag color="cyan">{v ?? 0} กลุ่ม</Tag>,
                  },
                  {
                    title: 'สถานะ Form 2',
                    key: 'form2',
                    width: 110,
                    align: 'center',
                    render: (_, r) =>
                      r.form2_submitted ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          ส่งแล้ว
                        </Tag>
                      ) : (
                        <Tag color="error">ยังไม่ส่ง</Tag>
                      ),
                  },
                  {
                    title: 'สถานะ Form 4 (ให้คะแนน)',
                    key: 'form4',
                    width: 170,
                    align: 'center',
                    render: (_, r) => {
                      const scored = r.scores_count || 0
                      const total = r.total_groups_to_score || numGroupsWithCodes || safeData.num_groups
                      if (r.form4_submitted || (total > 0 && scored >= total)) {
                        return (
                          <Tag color="success" icon={<CheckCircleOutlined />}>
                            ให้คะแนนแล้ว ({scored}/{total})
                          </Tag>
                        )
                      }
                      if (scored > 0) {
                        return (
                          <Tag color="processing" icon={<LoadingOutlined />}>
                            กำลังให้คะแนน ({scored}/{total})
                          </Tag>
                        )
                      }
                      if (codesGenerated || safeData.pct_profs_scored > 0) {
                        return <Tag color="warning">ยังไม่ส่ง</Tag>
                      }
                      return <Tag color="default">รอให้คะแนน</Tag>
                    },
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ── 3. MS Forms Status Section ─────────────────────────────────── */}
      <Card
        style={{ borderRadius: 10, marginTop: 16 }}
        title={
          <Flex align="center" gap={8}>
            <FormOutlined style={{ color: '#1677ff' }} />
            <span>สถานะการรับข้อมูลจาก MS Forms</span>
            {webhookStatus?.is_active
              ? <Badge status="processing" text={<Text style={{ fontSize: 12 }} type="secondary">กำลังรับอยู่</Text>} />
              : <Badge status="default" text={<Text style={{ fontSize: 12 }} type="secondary">ปิดอยู่</Text>} />}
          </Flex>
        }
        extra={
          <Button
            size="small"
            type="primary"
            icon={<SyncOutlined />}
            onClick={() => setActivateModalOpen(true)}
          >
            เปิดรอบรับฟอร์มใหม่
          </Button>
        }
      >
        {!webhookStatus?.is_active ? (
          <Empty
            description={
              <Text type="secondary" style={{ fontSize: 13 }}>
                ยังไม่มีรอบรับฟอร์มที่เปิดอยู่ — กดปุ่ม "เปิดรอบรับฟอร์มใหม่" เพื่อเริ่มต้น
              </Text>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Flex justify="space-between" align="flex-start">
                  <div>
                    <Text strong style={{ fontSize: 13 }}>📋 ฟอร์ม 1: ข้อมูลกลุ่มนักศึกษา</Text><br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {webhookStatus.received_group_count} กลุ่ม / {webhookStatus.received_student_count} คน
                      {webhookStatus.expected_student_count
                        ? ` (เป้าหมาย ${webhookStatus.expected_student_count} คน)`
                        : ''}
                    </Text>
                  </div>
                  {webhookStatus.form1_ready
                    ? <Tag color="success">ครบแล้ว</Tag>
                    : <Tag color="processing">รอข้อมูล</Tag>}
                </Flex>
                {webhookStatus.expected_student_count && (
                  <Progress
                    percent={Math.min(100, Math.round(
                      webhookStatus.received_student_count / webhookStatus.expected_student_count * 100
                    ))}
                    size="small"
                    style={{ marginTop: 8 }}
                    status={webhookStatus.form1_ready ? 'success' : 'active'}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Flex justify="space-between" align="flex-start">
                  <div>
                    <Text strong style={{ fontSize: 13 }}>📋 ฟอร์ม 2: ข้อมูลอาจารย์</Text><br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {webhookStatus.received_prof_count} ท่าน
                      {webhookStatus.expected_prof_count
                        ? ` / เป้าหมาย ${webhookStatus.expected_prof_count} ท่าน`
                        : ''}
                    </Text>
                  </div>
                  {webhookStatus.form2_ready
                    ? <Tag color="success">ครบแล้ว</Tag>
                    : <Tag color="processing">รอข้อมูล</Tag>}
                </Flex>
                {webhookStatus.expected_prof_count && (
                  <Progress
                    percent={Math.min(100, Math.round(
                      webhookStatus.received_prof_count / webhookStatus.expected_prof_count * 100
                    ))}
                    size="small"
                    style={{ marginTop: 8 }}
                    status={webhookStatus.form2_ready ? 'success' : 'active'}
                  />
                )}
              </Card>
            </Col>
            {!webhookStatus.codes_generated && (
              <Col xs={24}>
                <Alert
                  type={webhookStatus.form1_ready && webhookStatus.form2_ready ? 'success' : 'info'}
                  showIcon
                  message={
                    <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                      <span style={{ fontSize: 13 }}>
                        {webhookStatus.form1_ready && webhookStatus.form2_ready
                          ? '✅ ข้อมูลครบแล้ว — พร้อมสร้าง Anonymous Code ได้เลย'
                          : '⏳ รอข้อมูลจากฟอร์ม 1 และ 2 ให้ครบก่อน แล้วค่อยสร้าง Anonymous Code'}
                      </span>
                      <Button
                        type="primary"
                        icon={<KeyOutlined />}
                        size="small"
                        disabled={!webhookStatus.form1_ready || !webhookStatus.form2_ready}
                        loading={generating}
                        onClick={handleGenerateCodes}
                      >
                        สร้าง Anonymous Code
                      </Button>
                    </Flex>
                  }
                  style={{ borderRadius: 8 }}
                />
              </Col>
            )}
            {webhookStatus.codes_generated && (
              <Col xs={24}>
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message="สร้าง Anonymous Code สำหรับกลุ่มนักศึกษาและอาจารย์เรียบร้อยแล้ว"
                />
              </Col>
            )}
          </Row>
        )}
      </Card>
      
      {/* Modal เปิดรอบรับฟอร์ม */}
      <Modal
        title="เปิดรอบรับฟอร์มใหม่"
        open={activateModalOpen}
        onCancel={() => setActivateModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleActivate}>
          {PROGRAMS.map(p => (
            <div key={p} style={{ marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>หลักสูตร: {p}</Text>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name={`students_${p}`} label="นศ. ที่คาดหวัง" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={`profs_${p}`} label="อ. ที่คาดหวัง" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          ))}
          <Button type="primary" htmlType="submit" loading={activating} block>
            ยืนยันเปิดรอบรับฟอร์ม
          </Button>
        </Form>
      </Modal>
    </div>
  )
}
