import { useEffect, useState } from 'react'
import {
  Card, Select, Tabs, Table, Tag, Typography,
  Space, Flex, Row, Col, Statistic, Button, Empty,
} from 'antd'
import {
  BarChartOutlined, DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listRuns, getResults, getProfSummary, getStats, downloadResult } from '../api/client'

const { Title, Text } = Typography

type Tab = 'matching' | 'professors' | 'stats' | 'tiebreak'

export default function Results() {
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('matching')
  const [results, setResults] = useState<any[]>([])
  const [profSummary, setProfSummary] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listRuns().then(res => {
      const ok = res.data.filter((r: any) => r.status === 'success')
      setRuns(ok); if (ok.length) setSelectedRunId(ok[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedRunId) return
    setLoading(true)
    Promise.all([getResults(selectedRunId), getProfSummary(selectedRunId), getStats(selectedRunId)])
      .then(([r, p, s]) => { setResults(r.data); setProfSummary(p.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [selectedRunId])

  const selectedRun = runs.find(r => r.id === selectedRunId)

  /* ── Columns ── */
  const matchingColumns: ColumnsType<any> = [
    { title: '#', key: 'idx', render: (_, __, i) => <Text type="secondary">{i + 1}</Text>, width: 50 },
    { title: 'กลุ่ม', dataIndex: 'group_code', render: v => <Tag>{v}</Tag> },
    {
      title: 'อาจารย์', dataIndex: 'assigned_prof',
      render: v => (!v || v === 'UNMATCHED')
        ? <Tag color="error">UNMATCHED</Tag>
        : <Text strong>{v}</Text>,
    },
    {
      title: 'อันดับที่ได้', dataIndex: 'rank_given', align: 'center',
      render: v => v
        ? <Text strong style={{ color: v === 1 ? '#52c41a' : v <= 3 ? '#1677ff' : '#595959' }}>{v}</Text>
        : '—',
    },
    {
      title: 'Main Score', dataIndex: 'main_score', align: 'center',
      render: v => <Text strong={!!v}>{v || '—'}</Text>,
    },
    {
      title: 'Sub-score', dataIndex: 'sub_score', align: 'center',
      render: v => <Text type="secondary">{v?.toFixed(2) || '—'}</Text>,
    },
  ]

  const profColumns: ColumnsType<any> = [
    { title: 'รหัส', dataIndex: 'prof_code', render: v => <Tag>{v}</Tag> },
    { title: 'ชื่อ', dataIndex: 'full_name', render: v => <Text strong>{v || '—'}</Text> },
    { title: 'Quota', dataIndex: 'quota', align: 'center' },
    {
      title: 'กลุ่มที่ได้รับ', dataIndex: 'groups_assigned',
      render: (v: string[]) => v?.length
        ? v.join(', ')
        : <Text type="danger">ไม่ได้รับกลุ่มใด</Text>,
    },
    { title: 'จำนวน', dataIndex: 'num_assigned', align: 'center', render: v => <Text strong>{v}</Text> },
    {
      title: 'คงเหลือ', dataIndex: 'quota_remaining', align: 'center',
      render: v => (
        <Tag color={v === 0 ? 'success' : v > 0 ? 'warning' : 'error'}>{v}</Tag>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'matching', label: 'Final Matching',
      children: (
        <Table
          dataSource={results}
          columns={matchingColumns}
          rowKey={(_, i) => String(i)}
          size="small"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: true }}
        />
      ),
    },
    {
      key: 'professors', label: 'Professor Summary',
      children: (
        <Table
          dataSource={profSummary}
          columns={profColumns}
          rowKey={(_, i) => String(i)}
          size="small"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'stats', label: 'สถิติ',
      children: stats ? (
        <div style={{ padding: 24 }}>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { label: 'กลุ่มทั้งหมด', value: stats.num_groups },
              { label: 'จับคู่สำเร็จ', value: stats.num_matched, color: '#52c41a' },
              { label: 'ไม่ได้จับคู่', value: stats.num_unmatched, color: stats.num_unmatched > 0 ? '#ff4d4f' : undefined },
              { label: 'Tie-break', value: stats.num_ties, color: stats.num_ties > 0 ? '#faad14' : undefined },
            ].map(({ label, value, color }) => (
              <Col span={6} key={label}>
                <Card>
                  <Statistic title={label} value={value} valueStyle={color ? { color } : undefined} />
                </Card>
              </Col>
            ))}
          </Row>
          {stats.avg_rank && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {[
                { label: 'Rank เฉลี่ย', value: stats.avg_rank, suffix: '', note: 'ยิ่งน้อยยิ่งดี' },
                { label: 'ได้อันดับ 1', value: stats.pct_rank1, suffix: '%' },
                { label: 'ได้ Top-3', value: stats.pct_top3, suffix: '%' },
              ].map(({ label, value, suffix, note }: any) => (
                <Col span={8} key={label}>
                  <Card>
                    <Statistic title={label} value={value} suffix={suffix} valueStyle={{ color: '#1677ff' }} />
                    {note && <Text type="secondary" style={{ fontSize: 12 }}>{note}</Text>}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
          <Card size="small">
            <Text type="secondary">Seed: </Text>
            <Text code strong>{stats.seed}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>บันทึกไว้เพื่อ Audit</Text>
          </Card>
        </div>
      ) : null,
    },
    {
      key: 'tiebreak', label: 'TieBreak Log',
      children: (
        <div style={{ padding: 20 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            กรณีที่ต้องใช้ Seeded Random ตัดสินในขั้นสุดท้าย (Tie-break ชั้น 3)
          </Text>
          {selectedRun?.log
            ? <div className="log-viewer">{selectedRun.log}</div>
            : <Text type="secondary">ไม่มีข้อมูล</Text>}
          <Text type="secondary" style={{ marginTop: 10, fontSize: 12, display: 'block' }}>
            ดูรายละเอียดแบบเต็มได้ที่ชีต TieBreak_Log ในไฟล์ Excel ที่ดาวน์โหลด
          </Text>
        </div>
      ),
    },
  ]

  if (!runs.length) {
    return (
      <div style={{ padding: 32 }}>
        <Title level={4} style={{ marginBottom: 4 }}>ผลลัพธ์การจับคู่</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 40 }}>ยังไม่มีผลลัพธ์ — ไปรัน Matching ก่อน</Text>
        <Card>
          <Empty
            image={<BarChartOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
            description="ยังไม่มีการรัน Matching ที่สำเร็จ"
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap={16}
        style={{ marginBottom: 24 }}
      >
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>ผลลัพธ์การจับคู่</Title>
          <Text type="secondary">ผลลัพธ์จาก Matching Algorithm</Text>
        </div>
        <Flex gap={8} align="center" wrap="wrap">
          <Select
            style={{ minWidth: 300 }}
            value={selectedRunId}
            onChange={v => setSelectedRunId(v)}
            options={runs.map((r: any) => ({
              value: r.id,
              label: `Run #${r.id} — ${new Date(r.run_at).toLocaleString('th-TH')} (Seed: ${r.seed})`,
            }))}
          />
          {selectedRunId && (
            <Button
              icon={<DownloadOutlined />}
              href={downloadResult(selectedRunId)}
              download
            >
              ดาวน์โหลด Excel
            </Button>
          )}
        </Flex>
      </Flex>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={k => setTab(k as Tab)}
          items={tabItems}
        />
      </Card>
    </div>
  )
}
