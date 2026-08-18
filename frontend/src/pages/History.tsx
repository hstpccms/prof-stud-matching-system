import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Typography, Space, App as AntApp } from 'antd'
import {
  EyeOutlined, DownloadOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listRuns } from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography

export default function HistoryPage() {
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const triggerDownload = async (url: string, filename: string) => {
    try {
      const res = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: (res.headers['content-type'] as string) || 'application/octet-stream' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) message.error('Session หมดอายุ กรุณา Login ใหม่')
      else if (status === 404) message.error('ไม่พบไฟล์บนเซิร์ฟเวอร์')
      else message.error(`ดาวน์โหลดไม่สำเร็จ (${status ?? 'network error'})`)
    }
  }

  useEffect(() => {
    listRuns().then(r => setRuns(r.data)).finally(() => setLoading(false))
  }, [])

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
        <Space size={4}>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate('/results', { state: { runId: r.id } })}
            title="ดูผลลัพธ์"
          />
          <Button
            icon={<DownloadOutlined />}
            size="small"
            loading={downloadingId === r.id}
            title="ดาวน์โหลด"
            onClick={async () => {
              setDownloadingId(r.id)
              await triggerDownload(
                `/download/result/${r.id}`,
                `result_run${r.id}_seed${r.seed}.xlsx`,
              )
              setDownloadingId(null)
            }}
          />
        </Space>
      ) : null,
    },
  ]

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>ประวัติ / Audit Log</Title>
        <Text type="secondary">รายการการรัน Matching ทุกครั้ง — ผลลัพธ์ทุกรอบเป็น Immutable</Text>
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
