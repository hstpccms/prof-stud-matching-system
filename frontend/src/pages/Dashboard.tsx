import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Alert, Button, Typography,
  Tag, Space, Flex, Spin, Empty, Tooltip, Divider,
  Table, Badge, Popconfirm,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  ArrowRightOutlined, ExclamationCircleOutlined,
  WarningOutlined, HistoryOutlined,
  UserOutlined, TeamOutlined, FormOutlined, KeyOutlined, LockOutlined, DashboardOutlined,
} from '@ant-design/icons'
import { getDashboard, getRecentRuns, getRoundStatus, openRound, generateAnonymousCodes, getRosterCheck, closeRound, reopenRound } from '../api/client'
import { useProgram } from '../ProgramContext'

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
  form1_submitted?: boolean
  form3_submitted?: boolean
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
  is_closed: boolean
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
  const [rosterCheck, setRosterCheck] = useState<any>(null)
  const [opening, setOpening] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [closing, setClosing] = useState(false)
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
      getRoundStatus(program)
        .then(r => { if (isMounted) setWebhookStatus(r.data) })
        .catch(() => {})
      getRosterCheck(program)
        .then(r => { if (isMounted) setRosterCheck(r.data) })
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

  const refreshStatus = () => {
    getRoundStatus(program).then(r => setWebhookStatus(r.data)).catch(() => {})
    getRosterCheck(program).then(r => setRosterCheck(r.data)).catch(() => {})
  }

  const handleOpenRound = async () => {
    setOpening(true)
    try {
      await openRound(program)
      refreshStatus()
    } catch { /* ignore */ }
    setOpening(false)
  }

  const handleGenerateCodes = async () => {
    setGenerating(true)
    try {
      await generateAnonymousCodes(program)
      refreshStatus()
    } catch { /* ignore */ }
    setGenerating(false)
  }

  const handleCloseRound = async () => {
    setClosing(true)
    try {
      await closeRound(program)
      refreshStatus()
    } catch { /* ignore */ }
    setClosing(false)
  }

  const handleReopenRound = async () => {
    setClosing(true)
    try {
      await reopenRound(program)
      refreshStatus()
    } catch { /* ignore */ }
    setClosing(false)
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
    if (rosterCheck?.unknown_ids?.length > 0) {
      list.push({
        key: 'unknown',
        type: 'warning',
        message: `พบรหัสที่กรอกมาแต่ไม่ตรงกับบัญชีในระบบ: ${rosterCheck.unknown_ids.join(', ')}`,
        actionLabel: 'ไปหน้าจัดการข้อมูล',
        actionPath: '/data',
      })
    }
    return list
  }, [safeData, run, rosterCheck])

  // ── Codes generated helpers ───────────────────────────────────────────────
  const codesGenerated = webhookStatus?.codes_generated ?? false
  const roundClosed = webhookStatus?.is_closed ?? false
  const matchingRan = !!run   // มี matching run แล้ว → เปิดรอบซ้ำไม่ได้
  const numGroupsWithCodes = webhookStatus?.group_codes?.length ?? groupsList.length
  const numProfsWithCodes = webhookStatus?.prof_codes?.length ?? profsList.length

  // ── Readiness (roster-based) ──────────────────────────────────────────────
  const studentsComplete = !!(rosterCheck && rosterCheck.expected_count > 0 && rosterCheck.covered_count >= rosterCheck.expected_count)
  const profsComplete = !!(rosterCheck && rosterCheck.prof_expected_count > 0 && rosterCheck.prof_form2_count >= rosterCheck.prof_expected_count)
  const canGenerateCodes = (webhookStatus?.is_active ?? false) && !codesGenerated && studentsComplete && profsComplete

  // ── Pipeline steps (6 ขั้นตามลำดับจริง อิง roster) ──────────────────────────
  const pipelineSteps = useMemo(() => {
    const covered = rosterCheck?.covered_count ?? 0
    const expected = rosterCheck?.expected_count ?? 0
    const pf2 = rosterCheck?.prof_form2_count ?? 0
    const pfExp = rosterCheck?.prof_expected_count ?? 0
    return [
      {
        key: 'form1',
        title: 'ฟอร์ม 1 — ข้อมูลกลุ่มนักศึกษา',
        value: expected > 0 ? `${covered}/${expected} คน` : '',
        description: expected > 0
          ? (covered >= expected ? 'นักศึกษากรอกครบทุกคนแล้ว' : `กรอกแล้ว ${covered} จาก ${expected} คน`)
          : 'ยังไม่มีบัญชีนักศึกษาในหลักสูตรนี้',
        done: expected > 0 && covered >= expected,
        incomplete: [] as string[],
        trackPath: '/data',
      },
      {
        key: 'form2',
        title: 'ฟอร์ม 2 — ข้อมูลอาจารย์',
        value: pfExp > 0 ? `${pf2}/${pfExp} ท่าน` : '',
        description: pfExp > 0
          ? (pf2 >= pfExp
              ? (safeData.quota_sufficient ? 'อาจารย์ส่งครบและ Quota เพียงพอ' : 'อาจารย์ส่งครบแล้ว แต่ Quota ไม่พอ')
              : `ส่งแล้ว ${pf2} จาก ${pfExp} ท่าน`)
          : 'ยังไม่มีบัญชีอาจารย์ในหลักสูตรนี้',
        done: pfExp > 0 && pf2 >= pfExp && safeData.quota_sufficient,
        incomplete: [] as string[],
        trackPath: '/data',
      },
      {
        key: 'codes',
        title: 'สร้างรหัสนิรนาม (Anonymous Code)',
        value: '',
        description: codesGenerated ? 'สร้างรหัสแล้ว' : 'รอให้ฟอร์ม 1 และ 2 ครบก่อน แล้วกดสร้างรหัสที่การ์ด "ควบคุมรอบ"',
        done: codesGenerated,
        incomplete: [] as string[],
        trackPath: '',
      },
      {
        key: 'form3',
        title: 'ฟอร์ม 3 — จัดอันดับอาจารย์',
        value: codesGenerated ? `${safeData.pct_groups_ranked}%` : '',
        description: codesGenerated
          ? (safeData.pct_groups_ranked >= 100
              ? 'ทุกกลุ่มจัดอันดับครบแล้ว'
              : `${numGroupsWithCodes - safeData.incomplete_groups.length} / ${numGroupsWithCodes} กลุ่มจัดอันดับครบ`)
          : 'รอสร้างรหัสนิรนามก่อน',
        done: codesGenerated && safeData.pct_groups_ranked >= 100,
        incomplete: codesGenerated ? safeData.incomplete_groups : [],
        trackPath: '/data',
      },
      {
        key: 'form4',
        title: 'ฟอร์ม 4 — ให้คะแนนกลุ่ม',
        value: codesGenerated ? `${safeData.pct_profs_scored}%` : '',
        description: codesGenerated
          ? (safeData.pct_profs_scored >= 100
              ? 'ทุกอาจารย์ให้คะแนนครบแล้ว'
              : `${numProfsWithCodes - safeData.incomplete_profs.length} / ${numProfsWithCodes} อาจารย์ให้คะแนนครบ`)
          : 'รอสร้างรหัสนิรนามก่อน',
        done: codesGenerated && safeData.pct_profs_scored >= 100,
        incomplete: codesGenerated ? safeData.incomplete_profs : [],
        trackPath: '/data',
      },
      {
        key: 'matching',
        title: 'รัน Matching',
        value: '',
        description: !run
          ? 'ยังไม่เคยรัน'
          : run.status === 'running'
          ? 'กำลังรัน...'
          : run.status === 'success'
          ? `สำเร็จ — ${formatDateFull(run.run_at)}`
          : 'ล้มเหลว',
        done: run?.status === 'success',
        incomplete: [] as string[],
        trackPath: run?.status === 'success' ? '/results' : '/run',
      },
    ]
  }, [rosterCheck, safeData, codesGenerated, numGroupsWithCodes, numProfsWithCodes, run])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DashboardOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <DashboardOutlined style={{ fontSize: 22, color: '#1677ff' }} />
              <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
            </div>
            <Text type="secondary">ภาพรวมสถานะระบบจับคู่อาจารย์ที่ปรึกษา</Text>
          </div>
        </Flex>
        <Card>
          <Empty
            image={<FormOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
            description={
              <Flex vertical gap={4}>
                <Text>ยังไม่มีข้อมูลในรอบนี้</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {webhookStatus?.is_active
                    ? 'รอให้นักศึกษาและอาจารย์เข้ามากรอกฟอร์มในเว็บ'
                    : 'เปิดรอบรับฟอร์มเพื่อเริ่มต้นให้นักศึกษาและอาจารย์กรอกข้อมูล'}
                </Text>
              </Flex>
            }
          >
            {!webhookStatus?.is_active && (
              <Popconfirm
                title={`เปิดรอบรับฟอร์มของ "${program}"?`}
                description="หากหลักสูตรนี้มีข้อมูลเดิมอยู่ จะถูกล้างเพื่อเริ่มรอบใหม่ (หลักสูตรอื่นไม่กระทบ)"
                onConfirm={handleOpenRound}
                okText="เปิดรอบ" cancelText="ยกเลิก"
              >
                <Button type="primary" icon={<FormOutlined />} loading={opening}>
                  เปิดรอบรับฟอร์ม
                </Button>
              </Popconfirm>
            )}
          </Empty>
        </Card>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <DashboardOutlined style={{ fontSize: 22, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
          </div>
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

      {/* ── แถว 1: Pipeline + ควบคุมรอบ ───────────────────────────────── */}
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
                            {!step.done && step.incomplete.length > 0 && (
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
                          {!step.done && step.trackPath && (
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

        {/* ขวา: ควบคุมรอบ + สถานะการรัน (รวมเป็นคอลัมน์เดียวข้าง Pipeline) */}
        <Col xs={24} lg={8}>
          <Flex vertical gap={16} style={{ width: '100%' }}>
          <Card
            style={{ borderRadius: 10 }}
            title={<Flex align="center" gap={8}><FormOutlined style={{ color: '#1677ff' }} /><span style={{ fontWeight: 600 }}>ควบคุมรอบรับฟอร์ม</span></Flex>}
          >
            <Flex vertical gap={12}>
              <Flex align="center" gap={8}>
                <Text type="secondary">สถานะรอบ:</Text>
                {!webhookStatus?.is_active
                  ? <Badge status="default" text="ยังไม่เปิดรอบ" />
                  : matchingRan
                    ? <Badge status="success" text="ประมวลผลแล้ว (ปิดรับ)" />
                    : roundClosed
                      ? <Badge status="warning" text="ปิดรับฟอร์มแล้ว" />
                      : <Badge status="processing" text="เปิดรับฟอร์มอยู่" />}
              </Flex>
              <Flex align="center" gap={8}>
                <Text type="secondary">รหัสนิรนาม:</Text>
                {codesGenerated
                  ? <Tag color="success" icon={<CheckCircleOutlined />}>สร้างแล้ว</Tag>
                  : <Tag color="default">ยังไม่สร้าง</Tag>}
              </Flex>
              <Space wrap>
                <Popconfirm
                  title="เปิดรอบรับฟอร์มใหม่?"
                  description="ระบบจะปิดรอบเดิม (ถ้ามี) แล้วเริ่มรอบใหม่"
                  onConfirm={handleOpenRound}
                  okText="เปิดรอบ" cancelText="ยกเลิก"
                >
                  <Button type={webhookStatus?.is_active ? 'default' : 'primary'} icon={<FormOutlined />} loading={opening}>
                    {webhookStatus?.is_active ? 'เปิดรอบใหม่' : 'เปิดรอบรับฟอร์ม'}
                  </Button>
                </Popconfirm>
                <Button
                  type="primary" icon={<KeyOutlined />} loading={generating}
                  disabled={!canGenerateCodes}
                  onClick={handleGenerateCodes}
                >
                  สร้าง Anonymous Code
                </Button>
                {webhookStatus?.is_active && !matchingRan && (
                  roundClosed ? (
                    <Popconfirm
                      title={`เปิดรับฟอร์มของ "${program}" อีกครั้ง?`}
                      description="นักศึกษาและอาจารย์ในหลักสูตรนี้จะกลับมาส่ง/แก้ไขฟอร์มได้"
                      onConfirm={handleReopenRound}
                      okText="เปิดอีกครั้ง" cancelText="ยกเลิก"
                    >
                      <Button icon={<FormOutlined />} loading={closing}>เปิดรอบอีกครั้ง</Button>
                    </Popconfirm>
                  ) : (
                    <Popconfirm
                      title={`ปิดรับฟอร์มของ "${program}"?`}
                      description="เฉพาะหลักสูตรนี้จะส่ง/แก้ไขฟอร์มไม่ได้จนกว่าจะเปิดอีกครั้ง (หลักสูตรอื่นไม่กระทบ)"
                      onConfirm={handleCloseRound}
                      okText="ปิดรอบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
                    >
                      <Button danger icon={<LockOutlined />} loading={closing}>ปิดรับฟอร์ม</Button>
                    </Popconfirm>
                  )
                )}
              </Space>
              {webhookStatus?.is_active && !codesGenerated && !(studentsComplete && profsComplete) && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  * ต้องให้นักศึกษากรอกฟอร์ม 1 ครบทุกคน และอาจารย์กรอกฟอร์ม 2 ครบทุกท่านก่อน จึงจะสร้างรหัสได้
                </Text>
              )}
            </Flex>
          </Card>
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
                    title: 'GroupID',
                    key: 'group_id',
                    align: 'center',
                    render: (_, r, i) => r.anonymous_code
                      ? <Tag color="blue" style={{ fontWeight: 600 }}>{r.anonymous_code}</Tag>
                      : <Text>{i + 1}</Text>,
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
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>👥 ตารางติดตามรายชื่อนักศึกษาทั้งหมด</span>}
            >
              <Table
                dataSource={studentsList}
                rowKey={r => r.student_id || String(Math.random())}
                size="small"
                pagination={{ pageSize: 8, size: 'small', showTotal: total => `รวม ${total} คน` }}
                columns={[
                  {
                    title: 'ลำดับ',
                    key: 'index',
                    width: 50,
                    align: 'center',
                    render: (_, __, i) => i + 1,
                  },
                  {
                    title: 'รหัสนักศึกษา',
                    dataIndex: 'student_id',
                    key: 'student_id',
                    width: 110,
                    render: v => <Text strong>{v}</Text>,
                  },
                  {
                    title: 'ชื่อ-นามสกุล',
                    dataIndex: 'full_name',
                    key: 'full_name',
                    render: v => <Text>{v || '—'}</Text>,
                  },
                  {
                    title: 'กลุ่ม',
                    dataIndex: 'group_id',
                    key: 'group_id',
                    width: 90,
                    align: 'center',
                    render: v => <Tag color="geekblue">{v || '—'}</Tag>,
                  },
                  {
                    title: 'ฟอร์ม 1',
                    key: 'form1',
                    width: 90,
                    align: 'center',
                    render: (_, r) =>
                      (r.form1_submitted ?? r.form_submitted) ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>ส่งแล้ว</Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>ยังไม่ส่ง</Tag>
                      ),
                  },
                  {
                    title: 'ฟอร์ม 3',
                    key: 'form3',
                    width: 90,
                    align: 'center',
                    render: (_, r) =>
                      r.form3_submitted ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>ส่งแล้ว</Tag>
                      ) : (
                        <Tag color="default">ยังไม่ส่ง</Tag>
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
                    title: 'ProfID',
                    key: 'prof_id',
                    align: 'center',
                    render: (_, r, i) => r.anonymous_code
                      ? <Tag color="purple" style={{ fontWeight: 600 }}>{r.anonymous_code}</Tag>
                      : <Text>{i + 1}</Text>,
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
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>👨‍🏫 ตารางติดตามรายชื่ออาจารย์ทั้งหมด</span>}
            >
              <Table
                dataSource={profsList}
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
                    render: v => <Text strong>{v || '—'}</Text>,
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
                    title: 'ฟอร์ม 2',
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
                    title: 'ฟอร์ม 4',
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

    </div>
  )
}
