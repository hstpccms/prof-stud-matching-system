import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Alert, Button, Typography,
  Tag, Space, Flex, Spin, Empty, Tooltip, Divider,
  Progress, Modal, InputNumber, Form, Table, Badge,
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
  submitted_groups: { group_id: number; anonymous_code: string | null; members: { student_id: string; full_name: string }[] }[]
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
  const [form] = Form.useForm()
  const { program } = useProgram()

  useEffect(() => {
    const fetch = () => {
      getDashboard(program)
        .then(r => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
      getRecentRuns()
        .then(r => setRecentRuns(r.data))
        .catch(() => {})
      getWebhookStatus(program)
        .then(r => setWebhookStatus(r.data))
        .catch(() => {})
    }
    fetch()
    const t = setInterval(fetch, 6000)
    return () => clearInterval(t)
  }, [program])

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

  const run = data?.latest_run

  // ── Alert Banners (sorted by severity: danger first) ─────────────────────
  const banners: Array<{
    key: string
    type: 'error' | 'warning'
    message: string
    actionLabel?: string
    actionPath?: string
  }> = []

  if (data) {
    if (!data.quota_sufficient) {
      banners.push({
        key: 'quota',
        type: 'error',
        message: `Quota รวมของอาจารย์ (${data.total_quota}) น้อยกว่าจำนวนกลุ่มนักศึกษา (${data.num_groups}) — ไม่สามารถรัน Matching ได้ กรุณาเพิ่ม Quota`,
        actionLabel: 'ไปหน้าจัดการข้อมูล',
        actionPath: '/data',
      })
    }
    if (run?.status === 'success' && run.num_unmatched > 0) {
      banners.push({
        key: 'unmatched',
        type: 'warning',
        message: `การรันล่าสุดมี ${run.num_unmatched} กลุ่มที่ยังไม่ได้จับคู่ (Unmatched)`,
        actionLabel: 'ดูรายละเอียด',
        actionPath: '/results',
      })
    }
    if (data.data_stale && data.latest_session && run) {
      banners.push({
        key: 'stale',
        type: 'warning',
        message: `ข้อมูลมีการอัปเดตหลังรันล่าสุด — "${data.latest_session.filename || `Session #${data.latest_session.id}`}" อัปโหลดเมื่อ ${formatDateFull(data.latest_session.uploaded_at)} แต่รันล่าสุดคือ ${formatDateFull(run.run_at)} ควรรันใหม่`,
        actionLabel: 'รันใหม่',
        actionPath: '/run',
      })
    }
  }

  // ── Codes generated helpers ───────────────────────────────────────────────
  const codesGenerated = webhookStatus?.codes_generated ?? false
  const numGroupsWithCodes = webhookStatus?.group_codes?.length ?? 0
  const numProfsWithCodes = webhookStatus?.prof_codes?.length ?? 0

  // ── Pipeline steps ────────────────────────────────────────────────────────
  const pipelineSteps = data
    ? [
        {
          key: 'groups',
          title: 'กลุ่มนักศึกษา',
          value: '',
          description: webhookStatus?.is_active
            ? (webhookStatus.form1_ready ? 'ได้รับข้อมูลครบแล้ว' : `กำลังรอข้อมูลจากนักศึกษา (${webhookStatus.received_group_count} กลุ่ม / ${webhookStatus.received_student_count} คน)`)
            : (data.num_groups > 0 ? 'ลงทะเบียนในระบบแล้ว' : 'ยังไม่มีข้อมูลกลุ่ม'),
          done: webhookStatus?.is_active
            ? (webhookStatus?.form1_ready ?? false)
            : data.num_groups > 0,
          incomplete: [] as string[],
          trackPath: '/data',
        },
        {
          key: 'professors',
          title: 'อาจารย์',
          value: '',
          description: webhookStatus?.is_active
            ? (webhookStatus.form2_ready ? 'ได้รับข้อมูลครบแล้ว' : `กำลังรอข้อมูลจากอาจารย์ (${webhookStatus.received_prof_count} ท่าน)`)
            : (data.quota_sufficient
                ? `Quota รวม ${data.total_quota} — เพียงพอ`
                : `Quota รวม ${data.total_quota} — ไม่เพียงพอ`),
          done: webhookStatus?.is_active
            ? ((webhookStatus?.form2_ready ?? false) && data.quota_sufficient)
            : data.num_professors > 0 && data.quota_sufficient,
          incomplete: data.quota_sufficient ? [] : ['Quota ไม่เพียงพอ'],
          trackPath: '/data',
        },
        {
          key: 'rankings',
          title: 'Student Rankings',
          value: codesGenerated ? `${data.pct_groups_ranked}%` : '',
          description: codesGenerated
            ? (data.pct_groups_ranked >= 100
                ? 'ทุกกลุ่มจัดอันดับครบแล้ว'
                : `${numGroupsWithCodes - data.incomplete_groups.length} / ${numGroupsWithCodes} กลุ่มจัดอันดับครบ`)
            : (data.num_groups > 0 ? 'รอสร้าง Anonymous Code ก่อน' : 'ยังไม่มีข้อมูล'),
          done: codesGenerated && data.pct_groups_ranked >= 100,
          incomplete: data.incomplete_groups,
          trackPath: '/data',
        },
        {
          key: 'scores',
          title: 'Professor Scores',
          value: codesGenerated ? `${data.pct_profs_scored}%` : '',
          description: codesGenerated
            ? (data.pct_profs_scored >= 100
                ? 'ทุกอาจารย์ให้คะแนนครบแล้ว'
                : `${numProfsWithCodes - data.incomplete_profs.length} / ${numProfsWithCodes} อาจารย์ให้คะแนนครบ`)
            : (data.num_professors > 0 ? 'รอสร้าง Anonymous Code ก่อน' : 'ยังไม่มีข้อมูล'),
          done: codesGenerated && data.pct_profs_scored >= 100,
          incomplete: data.incomplete_profs,
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
    : []

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
  // ข้าม empty state ถ้ากำลังรับฟอร์มอยู่ (webhookStatus.is_active)
  // เพื่อให้ส่วน MS Forms Status ยังคงแสดงอยู่แม้จะยังไม่มีกลุ่ม
  if ((!data || data.num_groups === 0) && !webhookStatus?.is_active) {
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

        {/* Modal เปิดรอบรับฟอร์ม (ต้องมีแม้ใน empty state) */}
        <Modal
          title="เปิดรอบรับฟอร์มใหม่"
          open={activateModalOpen}
          onCancel={() => setActivateModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleActivate}>
            <Form.Item name="expected_student_count" label="จำนวนนักศึกษาทั้งหมดที่คาดว่าจะตอบฟอร์ม" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="expected_prof_count" label="จำนวนอาจารย์ทั้งหมดที่คาดว่าจะตอบฟอร์ม" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={activating} block>
              ยืนยันเปิดรอบรับฟอร์ม
            </Button>
          </Form>
        </Modal>
      </div>
    )
  }
  
  if (!data) return null;

  // ── Matched card colors ───────────────────────────────────────────────────
  const matchedTotal = data?.num_groups ?? 0
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
              value={data.num_groups}
              suffix="กลุ่ม"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={<Space><UserOutlined />อาจารย์</Space>}
              value={data.num_professors}
              suffix="ท่าน"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 10,
              ...(!data.quota_sufficient && data.num_groups > 0 ? { border: '1px solid #ffccc7', background: '#fff2f0' } : {}),
            }}
          >
            <Statistic
              title="Quota รวม"
              value={data.total_quota}
              suffix="ที่นั่ง"
              valueStyle={!data.quota_sufficient && data.num_groups > 0 ? { color: '#ff4d4f' } : undefined}
              prefix={!data.quota_sufficient && data.num_groups > 0 ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : undefined}
            />
            {!data.quota_sufficient && data.num_groups > 0 && (
              <Text type="danger" style={{ fontSize: 11 }}>น้อยกว่าจำนวนกลุ่ม ({data.num_groups})</Text>
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

      {/* ── Main Row ──────────────────────────────────────────────────────── */}
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
                            {/* Incomplete code tags */}
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
                          {/* Follow-up button */}
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

      {/* ── MS Forms Status Section ─────────────────────────────────── */}
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
            <>
              <Col xs={24}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  <KeyOutlined /> ข้อมูลกลุ่มนักศึกษา (ส่งฟอร์มแล้ว)
                </Text>
                <Table
                  dataSource={webhookStatus.submitted_groups}
                  rowKey="group_id"
                  size="small"
                  pagination={{ pageSize: 15 }}
                  style={{ borderRadius: 8 }}
                  rowClassName={() => 'group-row'}
                  columns={[
                    { title: 'กลุ่มที่', key: 'index', width: 60, render: (_, __, i) => i + 1 },
                    { title: 'Code', dataIndex: 'anonymous_code', key: 'code', width: 80,
                      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">รอสร้าง</Text> },
                    { title: 'ตัวแทนกลุ่ม', dataIndex: 'representative', key: 'rep', width: 120,
                      render: v => v || '-' },
                    { title: 'จำนวน (คน)', dataIndex: 'member_count', key: 'mc', width: 90, align: 'center' },
                    { title: 'รายชื่อสมาชิก (รหัส - ชื่อ)', dataIndex: 'members', key: 'members',
                      render: (members: any[]) => (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {members?.map((m, idx) => (
                            <div
                              key={m.student_id}
                              style={{
                                padding: '4px 0',
                                borderBottom: idx === members.length - 1 ? 'none' : '1px solid #f0f0f0',
                                display: 'flex',
                                gap: 8
                              }}
                            >
                              <Text strong style={{ width: 100, fontSize: 12 }}>{m.student_id}</Text>
                              <Text style={{ fontSize: 12 }}>{m.full_name || '-'}</Text>
                            </div>
                          ))}
                        </div>
                      )
                    },
                  ]}
                />
              </Col>
            </>
            {webhookStatus.codes_generated && (
              <>
                <Col xs={24} sm={12}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                    <KeyOutlined /> Anonymous Code — อาจารย์
                  </Text>
                  <Table
                    dataSource={webhookStatus.prof_codes}
                    rowKey="prof_id"
                    size="small"
                    pagination={false}
                    style={{ borderRadius: 8 }}
                    columns={[
                      { title: 'Code', dataIndex: 'anonymous_code', key: 'code', width: 80,
                        render: (v: string) => <Tag color="purple">{v}</Tag> },
                      { title: 'ชื่ออาจารย์', dataIndex: 'full_name', key: 'name' },
                    ]}
                  />
                </Col>
              </>
            )}
          </Row>
        )}
      </Card>
      
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
