import { useEffect, useState, useRef } from 'react'
import {
  Upload, Button, Select, Tabs, Table, Tag, Alert,
  Card, Typography, Space, Flex, App as AntApp, Spin,
} from 'antd'
import {
  InboxOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  uploadFile, listSessions, getGroups, getProfessors,
  getRankings, getScores, validateSession,
} from '../api/client'

const { Title, Text } = Typography
const { Dragger } = Upload

type TabType = 'groups' | 'professors' | 'rankings' | 'scores'

export default function DataManagement() {
  const { message } = AntApp.useApp()
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSid, setSelectedSid] = useState<number | null>(null)
  const [tab, setTab] = useState<TabType>('groups')
  const [tableData, setTableData] = useState<any[]>([])
  const [validationResult, setValidationResult] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)
  // suppress unused ref warning — kept for future direct file input use
  const _fileRef = useRef<HTMLInputElement>(null)

  const fetchSessions = async () => {
    const res = await listSessions()
    setSessions(res.data)
    if (res.data.length > 0 && !selectedSid) setSelectedSid(res.data[0].id)
  }

  const fetchTable = async (sid: number, t: TabType) => {
    setLoadingTable(true); setTableData([])
    try {
      const fetchers: Record<TabType, () => Promise<any>> = {
        groups: () => getGroups(sid),
        professors: () => getProfessors(sid),
        rankings: () => getRankings(sid),
        scores: () => getScores(sid),
      }
      const res = await fetchers[t]()
      setTableData(res.data)
    } finally { setLoadingTable(false) }
  }

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => {
    if (selectedSid) { setValidationResult(null); fetchTable(selectedSid, tab) }
  }, [selectedSid, tab])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) { message.error('กรุณาเลือกไฟล์ .xlsx'); return false }
    setUploading(true)
    try {
      const res = await uploadFile(file)
      message.success(`อัปโหลด "${file.name}" สำเร็จ`)
      await fetchSessions(); setSelectedSid(res.data.id)
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'อัปโหลดล้มเหลว')
    } finally { setUploading(false) }
    return false // prevent antd auto upload
  }

  const handleValidate = async () => {
    if (!selectedSid) return
    setValidating(true)
    try {
      const res = await validateSession(selectedSid)
      setValidationResult(res.data)
      if (res.data.passed) message.success('ผ่านการตรวจสอบแล้ว')
      else message.error(`พบ ${res.data.errors.length} ข้อผิดพลาด`)
      await fetchSessions()
    } catch { message.error('เกิดข้อผิดพลาด') }
    finally { setValidating(false) }
  }

  const selectedSession = sessions.find(s => s.id === selectedSid)

  /* ── Table columns ── */
  const groupColumns: ColumnsType<any> = [
    { title: 'GroupID', dataIndex: 'group_id', key: 'group_id', render: v => <Text strong>{v}</Text> },
    { title: 'รหัส', dataIndex: 'anonymous_code', key: 'anonymous_code', render: v => <Tag>{v}</Tag> },
    { title: 'ตัวแทน', dataIndex: 'representative', key: 'representative' },
    { title: 'สมาชิก', dataIndex: 'member_count', key: 'member_count', align: 'center' },
    {
      title: 'หัวข้อสนใจ', dataIndex: 'topic_interest', key: 'topic_interest',
      render: v => v ? JSON.parse(v).join(', ') : '—',
    },
  ]

  const profColumns: ColumnsType<any> = [
    { title: 'ProfID', dataIndex: 'prof_id', key: 'prof_id', render: v => <Text type="secondary">{v}</Text> },
    { title: 'รหัส', dataIndex: 'anonymous_code', key: 'anonymous_code', render: v => <Tag>{v}</Tag> },
    { title: 'ชื่อ-นามสกุล', dataIndex: 'full_name', key: 'full_name', render: v => <Text strong>{v}</Text> },
    { title: 'ความเชี่ยวชาญ', dataIndex: 'expertise', key: 'expertise', ellipsis: true },
    { title: 'Quota', dataIndex: 'quota', key: 'quota', align: 'center', render: v => <Text style={{ color: '#1677ff', fontWeight: 600 }}>{v}</Text> },
  ]

  const scoreColumns: ColumnsType<any> = [
    { title: 'อาจารย์', dataIndex: 'prof_code', key: 'prof_code', render: v => <Tag>{v}</Tag> },
    { title: 'กลุ่ม', dataIndex: 'group_code', key: 'group_code', render: v => <Tag color="blue">{v}</Tag> },
    { title: 'A (TopicFit)', dataIndex: 'score_a', key: 'score_a', align: 'center' },
    { title: 'B (Clarity)', dataIndex: 'score_b', key: 'score_b', align: 'center' },
    { title: 'Sub-score', dataIndex: 'sub_score', key: 'sub_score', align: 'center', render: v => v?.toFixed(1) },
    {
      title: 'Main Score', dataIndex: 'main_score', key: 'main_score', align: 'center',
      render: v => (
        <Text strong style={{ color: v >= 70 ? '#52c41a' : v >= 40 ? '#faad14' : '#ff4d4f' }}>
          {v}
        </Text>
      ),
    },
  ]

  const renderRankingsTable = () => {
    const pivot: Record<string, Record<string, number>> = {}
    const profSet = new Set<string>()
    tableData.forEach((r: any) => {
      pivot[r.group_code] = pivot[r.group_code] || {}
      pivot[r.group_code][r.prof_code] = r.rank
      profSet.add(r.prof_code)
    })
    const profs = Array.from(profSet).sort()
    const rows = Object.keys(pivot).sort().map(g => ({ group: g, ...pivot[g] }))
    const cols: ColumnsType<any> = [
      { title: 'กลุ่ม', dataIndex: 'group', key: 'group', render: v => <Tag>{v}</Tag> },
      ...profs.map(p => ({
        title: p, dataIndex: p, key: p, align: 'center' as const,
        render: (v: number) => v !== undefined
          ? <Text style={{ color: v === 1 ? '#52c41a' : v <= 3 ? '#1677ff' : '#8c8c8c', fontWeight: v <= 3 ? 600 : 400 }}>{v}</Text>
          : <Text type="danger">—</Text>,
      })),
    ]
    return <Table dataSource={rows} columns={cols} rowKey="group" size="small" scroll={{ x: true }} pagination={false} />
  }

  const tabItems = [
    {
      key: 'groups', label: 'กลุ่มนักศึกษา',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={tableData} columns={groupColumns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />,
    },
    {
      key: 'professors', label: 'อาจารย์',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={tableData} columns={profColumns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />,
    },
    {
      key: 'rankings', label: 'Student Rankings',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : renderRankingsTable(),
    },
    {
      key: 'scores', label: 'Professor Scores',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={tableData} columns={scoreColumns} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 20 }} />,
    },
  ]

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>จัดการข้อมูล</Title>
        <Text type="secondary">อัปโหลดและตรวจสอบข้อมูล Excel</Text>
      </div>

      {/* Upload */}
      <Card style={{ marginBottom: 16 }}>
        <Dragger
          accept=".xlsx"
          showUploadList={false}
          beforeUpload={f => { handleFile(f); return false }}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            {uploading ? <Spin /> : <InboxOutlined />}
          </p>
          <p className="ant-upload-text">
            {uploading ? 'กำลังอัปโหลด...' : 'คลิกหรือลากไฟล์มาวาง'}
          </p>
          <p className="ant-upload-hint">
            <FileExcelOutlined /> .xlsx — 4 ชีต: Group_Info, Professor_Info, Student_Rankings, Professor_Scores
          </p>
        </Dragger>
      </Card>

      {/* Data Preview */}
      {sessions.length > 0 && (
        <Card>
          {/* Toolbar */}
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              style={{ minWidth: 300 }}
              value={selectedSid}
              onChange={v => setSelectedSid(v)}
              options={sessions.map((s: any) => ({
                value: s.id,
                label: `${s.filename || `Session #${s.id}`} — ${new Date(s.uploaded_at).toLocaleString('th-TH')}`,
              }))}
            />
            {selectedSession && (
              <Tag
                color={selectedSession.status === 'validated' ? 'success' : 'default'}
                icon={selectedSession.status === 'validated' ? <CheckCircleOutlined /> : undefined}
              >
                {selectedSession.status === 'validated' ? 'ผ่านการตรวจสอบ' : selectedSession.status}
              </Tag>
            )}
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleValidate}
              loading={validating}
              disabled={!selectedSid}
            >
              ตรวจสอบ
            </Button>
          </Space>

          {/* Validation result */}
          {validationResult && (
            <div style={{ marginBottom: 16 }}>
              {validationResult.passed
                ? <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="ผ่านการตรวจสอบทุกเงื่อนไข — พร้อมรัน Matching" />
                : <Flex vertical gap={8} style={{ width: '100%' }}>
                    {validationResult.errors.map((err: any, i: number) => (
                      <Alert
                        key={i} type="error" showIcon
                        icon={<ExclamationCircleOutlined />}
                        message={err.message}
                      />
                    ))}
                  </Flex>}
            </div>
          )}

          {/* Tabs */}
          <Tabs
            activeKey={tab}
            onChange={k => setTab(k as TabType)}
            items={tabItems}
            size="small"
          />
        </Card>
      )}
    </div>
  )
}
