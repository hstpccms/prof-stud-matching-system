import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Alert, Button, Typography,
  Tag, Space, Flex, Spin, Empty, Tooltip, Divider,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  UploadOutlined, ArrowRightOutlined, ExclamationCircleOutlined,
  WarningOutlined, HistoryOutlined, ThunderboltOutlined,
  UserOutlined, TeamOutlined,
} from '@ant-design/icons'
import { getDashboard, getRecentRuns } from '../api/client'

const { Title, Text } = Typography

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

  useEffect(() => {
    const fetch = () => {
      getDashboard()
        .then(r => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
      getRecentRuns()
        .then(r => setRecentRuns(r.data))
        .catch(() => {})
    }
    fetch()
    const t = setInterval(fetch, 6000)
    return () => clearInterval(t)
  }, [])

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

  // ── Pipeline steps ────────────────────────────────────────────────────────
  const pipelineSteps = data
    ? [
        {
          key: 'groups',
          title: 'กลุ่มนักศึกษา',
          value: `${data.num_groups} กลุ่ม`,
          description: data.num_groups > 0 ? 'ลงทะเบียนในระบบแล้ว' : 'ยังไม่มีข้อมูลกลุ่ม',
          done: data.num_groups > 0,
          incomplete: [] as string[],
          trackPath: '/data',
        },
        {
          key: 'professors',
          title: 'อาจารย์',
          value: `${data.num_professors} ท่าน`,
          description: data.quota_sufficient
            ? `Quota รวม ${data.total_quota} — เพียงพอ`
            : `Quota รวม ${data.total_quota} — ไม่เพียงพอ`,
          done: data.num_professors > 0 && data.quota_sufficient,
          incomplete: data.quota_sufficient ? [] : ['Quota ไม่เพียงพอ'],
          trackPath: '/data',
        },
        {
          key: 'rankings',
          title: 'Student Rankings',
          value: `${data.pct_groups_ranked}%`,
          description:
            data.pct_groups_ranked >= 100
              ? 'ทุกกลุ่มจัดอันดับครบแล้ว'
              : `${data.num_groups - data.incomplete_groups.length} / ${data.num_groups} กลุ่มจัดอันดับครบ`,
          done: data.pct_groups_ranked >= 100,
          incomplete: data.incomplete_groups,
          trackPath: '/data',
        },
        {
          key: 'scores',
          title: 'Professor Scores',
          value: `${data.pct_profs_scored}%`,
          description:
            data.pct_profs_scored >= 100
              ? 'ทุกอาจารย์ให้คะแนนครบแล้ว'
              : `${data.num_professors - data.incomplete_profs.length} / ${data.num_professors} อาจารย์ให้คะแนนครบ`,
          done: data.pct_profs_scored >= 100,
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
  if (!data || data.num_groups === 0) {
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
                <Text type="secondary" style={{ fontSize: 13 }}>เริ่มต้นด้วยการอัปโหลดไฟล์ Excel</Text>
              </Flex>
            }
          >
            <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/data')}>
              อัปโหลดข้อมูล
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  // ── Matched card colors ───────────────────────────────────────────────────
  const matchedTotal = data.num_groups
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
          <Card
            style={{
              borderRadius: 10,
              ...(!data.quota_sufficient ? { border: '1px solid #ffccc7', background: '#fff2f0' } : {}),
            }}
          >
            <Statistic
              title={<Space><UserOutlined />อาจารย์ / Quota รวม</Space>}
              value={data.num_professors}
              suffix={
                <span style={{ fontWeight: 400, fontSize: 14, color: !data.quota_sufficient ? '#ff4d4f' : '#595959' }}>
                  {' '}ท่าน •{' '}
                  <span style={{ fontWeight: 600 }}>{data.total_quota}</span>
                </span>
              }
              valueStyle={!data.quota_sufficient ? { color: '#ff4d4f' } : undefined}
              prefix={!data.quota_sufficient ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : undefined}
            />
            {!data.quota_sufficient && (
              <Text type="danger" style={{ fontSize: 11 }}>Quota ไม่เพียงพอ</Text>
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
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={<Space><ThunderboltOutlined />โหมดล่าสุด</Space>}
              value={run ? MODE_LABELS[run.mode] || run.mode : '—'}
              valueStyle={{ fontSize: run ? (run.mode === 'both' ? 15 : 16) : 20 }}
            />
            {run?.status === 'success' && run.mode === 'both' && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => navigate('/results')}
              >
                ดูเปรียบเทียบ →
              </Button>
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
            {/* Quick actions */}
            <Card title="การดำเนินการ" size="small" style={{ borderRadius: 10 }}>
              <Flex vertical style={{ width: '100%' }} gap={8}>
                {[
                  { label: 'อัปโหลด / จัดการข้อมูล', sub: 'เพิ่มหรืออัปเดต Excel', path: '/data' },
                  { label: 'รัน Matching', sub: 'เริ่มกระบวนการจับคู่', path: '/run' },
                  ...(run?.status === 'success'
                    ? [
                        { label: 'ดูผลลัพธ์', sub: 'ตาราง, สถิติ, TieBreak', path: '/results' },
                        { label: 'ดาวน์โหลดไฟล์', sub: 'Excel ผลลัพธ์', path: '/downloads' },
                      ]
                    : []),
                ].map(({ label, sub, path }) => (
                  <Button
                    key={path}
                    block
                    onClick={() => navigate(path)}
                    icon={<ArrowRightOutlined />}
                    style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>{sub}</div>
                    </div>
                  </Button>
                ))}
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
    </div>
  )
}
