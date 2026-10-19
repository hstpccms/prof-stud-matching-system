import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Typography, Space } from 'antd'
import {
  EyeOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined, HistoryOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listRuns } from '../api/client'
import { useProgram } from '../ProgramContext'

const { Title, Text } = Typography

export default function HistoryPage() {
  const navigate = useNavigate()
  const { program } = useProgram()
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listRuns(program).then(r => setRuns(r.data)).finally(() => setLoading(false))
  }, [program])

  const statusTag = (s: string) => {
    if (s === 'success') return <Tag color="success" icon={<CheckCircleOutlined />}>สำเร็จ</Tag>
    if (s === 'running') return <Tag color="processing" icon={<SyncOutlined spin />}>รัน...</Tag>
    if (s === 'failed')  return <Tag color="error" icon={<ExclamationCircleOutlined />}>ล้มเหลว</Tag>
    return <Tag>{s}</Tag>
  }

  const columns: ColumnsType<any> = [
    {
      title: 'Run', dataIndex: 'id', key: 'id', width: 80,
      render: v => <Text strong type="secondary">#{v}</Text>,
    },
    {
      title: 'วันที่รัน', dataIndex: 'run_at', key: 'run_at',
      render: v => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
          <Text style={{ fontSize: 13 }}>{new Date(v).toLocaleString('th-TH')}</Text>
        </Space>
      ),
    },
    {
      title: 'หลักสูตร', dataIndex: 'program', key: 'program',
      render: v => <Tag color="blue">{v || '-'}</Tag>,
    },
    {
      title: 'Seed', dataIndex: 'seed', key: 'seed',
      render: v => <Text code>{v}</Text>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status',
      render: statusTag,
    },
    {
      title: 'จับคู่สำเร็จ', dataIndex: 'num_matched', key: 'num_matched', align: 'center',
      render: v => <Text strong style={{ color: '#52c41a' }}>{v}</Text>,
    },
    {
      title: 'ไม่ได้จับคู่', dataIndex: 'num_unmatched', key: 'num_unmatched', align: 'center',
      render: v => <Text style={{ color: v > 0 ? '#ff4d4f' : '#bfbfbf' }}>{v}</Text>,
    },
    {
      title: 'Tie', dataIndex: 'num_ties', key: 'num_ties', align: 'center',
      render: v => <Text style={{ color: v > 0 ? '#faad14' : '#bfbfbf' }}>{v}</Text>,
    },
    {
      title: 'Session', dataIndex: 'session_id', key: 'session_id',
      render: v => <Text type="secondary" style={{ fontSize: 13 }}>#{v}</Text>,
    },
    {
      title: '', key: 'actions',
      render: (_, r) => r.status === 'success' ? (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate('/results', { state: { runId: r.id } })}
          title="ดูผลลัพธ์"
        >
          ดูผล
        </Button>
      ) : null,
    },
  ]

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <HistoryOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>ประวัติ / Audit Log</Title>
        </div>
        <Text type="secondary">บันทึกตรวจสอบย้อนหลังการรัน Matching ทุกครั้ง (รวมรอบที่ล้มเหลว) — เก็บ Seed ไว้ reproduce ได้ · ผลลัพธ์ทุกรอบเป็น Immutable</Text>
      </div>

      <Table
        dataSource={runs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: true }}
      />
    </div>
  )
}
