import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Alert, Button, Typography,
  Steps, Tag, Space, Flex, Spin, Empty,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  UploadOutlined, ArrowRightOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { getDashboard } from '../api/client'

const { Title, Text } = Typography

interface DashboardData {
  latest_session: any | null
  num_groups: number
  num_professors: number
  total_quota: number
  quota_sufficient: boolean
  pct_groups_ranked: number
  pct_profs_scored: number
  latest_run: any | null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = () =>
      getDashboard()
        .then(r => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    fetch()
    const t = setInterval(fetch, 6000)
    return () => clearInterval(t)
  }, [])

  const run = data?.latest_run

  const pipelineSteps = data
    ? [
        {
          title: `กลุ่มนักศึกษา — ${data.num_groups} กลุ่ม`,
          description: 'ลงทะเบียนในระบบแล้ว',
          status: data.num_groups > 0 ? 'finish' : 'wait',
        },
        {
          title: `อาจารย์ ${data.num_professors} ท่าน — Quota รวม ${data.total_quota}`,
          description: data.quota_sufficient ? 'Quota เพียงพอ' : 'Quota ไม่เพียงพอ',
          status: data.quota_sufficient ? 'finish' : 'error',
        },
        {
          title: 'Student Rankings',
          description: `${data.pct_groups_ranked}% จัดอันดับครบแล้ว`,
          status: data.pct_groups_ranked >= 100 ? 'finish' : data.pct_groups_ranked < 50 ? 'error' : 'process',
        },
        {
          title: 'Professor Scores',
          description: `${data.pct_profs_scored}% ให้คะแนนครบแล้ว`,
          status: data.pct_profs_scored >= 100 ? 'finish' : data.pct_profs_scored < 50 ? 'error' : 'process',
        },
        {
          title: 'Matching Algorithm',
          description: !run
            ? 'ยังไม่เคยรัน'
            : run.status === 'running'
            ? 'กำลังรัน...'
            : run.status === 'success'
            ? `สำเร็จ — ${new Date(run.run_at).toLocaleString('th-TH')}`
            : 'ล้มเหลว',
          status: !run ? 'wait' : run.status === 'running' ? 'process' : run.status === 'success' ? 'finish' : 'error',
        },
      ]
    : []

  const quickActions = data
    ? [
        { label: 'อัปโหลด / จัดการข้อมูล', sub: 'เพิ่มหรืออัปเดต Excel', path: '/data' },
        { label: 'รัน Matching', sub: 'เริ่มกระบวนการจับคู่', path: '/run' },
        ...(run?.status === 'success'
          ? [
              { label: 'ดูผลลัพธ์', sub: 'ตาราง, สถิติ, TieBreak', path: '/results' },
              { label: 'ดาวน์โหลดไฟล์', sub: 'Excel ผลลัพธ์', path: '/downloads' },
            ]
          : []),
      ]
    : []

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

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>Dashboard</Title>
          <Text type="secondary">ภาพรวมสถานะระบบจับคู่อาจารย์ที่ปรึกษา</Text>
        </div>
      </Flex>

      {/* Quota Warning */}
      {!data.quota_sufficient && (
        <Alert
          type="error"
          showIcon
          message={`Quota รวม (${data.total_quota}) น้อยกว่าจำนวนกลุ่ม (${data.num_groups}) — ไม่สามารถรัน Matching ได้`}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic title="กลุ่มนักศึกษา" value={data.num_groups} suffix="กลุ่ม" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="อาจารย์" value={data.num_professors} suffix="ท่าน" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Quota รวม"
              value={data.total_quota}
              valueStyle={!data.quota_sufficient ? { color: '#ff4d4f' } : undefined}
              prefix={!data.quota_sufficient ? <ExclamationCircleOutlined /> : undefined}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="จับคู่ล่าสุด"
              value={run?.status === 'success' ? run.num_matched : '—'}
              suffix={run?.status === 'success' ? 'กลุ่ม' : ''}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Pipeline Steps */}
        <Col span={16}>
          <Card title="Pipeline">
            <Steps
              direction="vertical"
              size="small"
              items={pipelineSteps.map(s => ({
                title: s.title,
                description: s.description,
                status: s.status as any,
                icon:
                  s.status === 'finish' ? <CheckCircleOutlined /> :
                  s.status === 'error'  ? <CloseCircleOutlined /> :
                  s.status === 'process'? <LoadingOutlined /> : undefined,
              }))}
            />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col span={8}>
          <Flex vertical gap={12} style={{ width: '100%' }}>
            <Card title="การดำเนินการ" size="small">
              <Flex vertical style={{ width: '100%' }}>
                {quickActions.map(({ label, sub, path }) => (
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

            {data.latest_session && (
              <Card size="small">
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  ข้อมูลล่าสุด
                </Text>
                <Text strong style={{ fontSize: 13, wordBreak: 'break-all' }}>
                  {data.latest_session.filename || `Session #${data.latest_session.id}`}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(data.latest_session.uploaded_at).toLocaleString('th-TH')}
                </Text>
              </Card>
            )}

            {/* Run status badge */}
            {run && (
              <Card size="small">
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  การรันล่าสุด
                </Text>
                <Space>
                  {run.status === 'success' && <Tag color="success">สำเร็จ</Tag>}
                  {run.status === 'running' && <Tag color="processing">กำลังรัน</Tag>}
                  {run.status === 'failed'  && <Tag color="error">ล้มเหลว</Tag>}
                  <Text style={{ fontSize: 12 }}>
                    {new Date(run.run_at).toLocaleString('th-TH')}
                  </Text>
                </Space>
              </Card>
            )}
          </Flex>
        </Col>
      </Row>
    </div>
  )
}
