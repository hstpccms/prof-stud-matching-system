import { useEffect, useState } from 'react'
import {
  Select, Tabs, Table, Alert,
  Card, Typography, Space, Flex, Spin, Input,
} from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  listSessions, getGroups, getProfessors,
  getRankings, getScores,
} from '../api/client'
import { useProgram } from '../ProgramContext'

const { Title, Text } = Typography

// สไตล์ cell กลางสำหรับตารางทุกแท็บ — เนื้อหาตัวบางเหมือนกันหมด (หัวตารางเป็นตัวหนาตาม default)
const CELL = { fontSize: 13 }
// ไฮไลต์สีเฉพาะรหัส GroupID / ProfID (คนละสี) — ยังคงเป็นตัวบาง
const ID_GROUP = { fontSize: 13, color: '#1677ff' }   // GroupID = น้ำเงิน
const ID_PROF = { fontSize: 13, color: '#722ed1' }    // ProfID = ม่วง

type TabType = 'groups' | 'professors' | 'rankings' | 'scores'

export default function DataManagement() {
  const { program } = useProgram()
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSid, setSelectedSid] = useState<number | null>(null)
  const [tab, setTab] = useState<TabType>('groups')
  const [tableData, setTableData] = useState<any[]>([])
  const [loadingTable, setLoadingTable] = useState(false)
  const [search, setSearch] = useState('')
  // map รหัสอาจารย์ (P001) -> ชื่อ สำหรับแสดงแทนรหัสในแท็บ Rankings/Scores
  const [profMap, setProfMap] = useState<Record<string, string>>({})
  const profName = (code: string) => profMap[code] || code

  // กรองแถวในแท็บปัจจุบันตามคำค้นหา (ค้นทุก field รวม nested members/topics)
  const shown = search.trim()
    ? tableData.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase().trim()))
    : tableData

  const fetchSessions = async () => {
    const res = await listSessions(program)
    setSessions(res.data)
    if (res.data.length > 0) {
      if (!selectedSid || !res.data.some((s: any) => s.id === selectedSid)) {
        setSelectedSid(res.data[0].id)
      }
    } else {
      setSelectedSid(null)
      setTableData([])
    }
  }

  const fetchTable = async (sid: number, t: TabType) => {
    setLoadingTable(true); setTableData([])
    try {
      const fetchers: Record<TabType, () => Promise<any>> = {
        groups: () => getGroups(sid, program),
        professors: () => getProfessors(sid, program),
        rankings: () => getRankings(sid, program),
        scores: () => getScores(sid, program),
      }
      const res = await fetchers[t]()
      setTableData(res.data)
    } finally { setLoadingTable(false) }
  }

  useEffect(() => { fetchSessions() }, [program])
  useEffect(() => {
    if (selectedSid) { fetchTable(selectedSid, tab) }
  }, [selectedSid, tab, program])

  // โหลดรายชื่ออาจารย์ของ session ไว้ map รหัส -> ชื่อ (ใช้ในแท็บ Rankings/Scores)
  useEffect(() => {
    if (!selectedSid) { setProfMap({}); return }
    getProfessors(selectedSid, program).then(r => {
      const m: Record<string, string> = {}
      r.data.forEach((p: any) => {
        const code = p.anonymous_code || p.prof_id
        if (code) m[code] = p.full_name || code
      })
      setProfMap(m)
    }).catch(() => setProfMap({}))
  }, [selectedSid, program])

  /* ── Table columns ── */
  const groupColumns: ColumnsType<any> = [
    {
      title: 'GroupID',
      key: 'group_id',
      width: 90,
      align: 'center',
      render: (_, r) => <Text style={ID_GROUP}>{r.group_id || r.anonymous_code || '-'}</Text>,
    },
    {
      title: 'จำนวนสมาชิกกลุ่ม',
      key: 'member_count',
      width: 140,
      align: 'center',
      render: (_, r) => <Text style={CELL}>{r.member_count ?? (r.members?.length || 0)} คน</Text>,
    },
    {
      title: 'รายชื่อสมาชิก (รหัส + ชื่อ-นามสกุล)',
      dataIndex: 'members',
      key: 'members',
      width: 250,
      render: (members: any[], r: any) => {
        if (members && members.length > 0) {
          return (
            <Flex vertical gap={4}>
              {members.map((m, idx) => (
                <div
                  key={m.student_id || idx}
                  style={{
                    padding: '2px 0',
                    borderBottom: idx === members.length - 1 ? 'none' : '1px solid #f0f0f0',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <Text style={{ width: 85, fontSize: 13 }}>{m.student_id}</Text>
                  <Text style={{ fontSize: 13 }}>{m.full_name || '-'}</Text>
                </div>
              ))}
            </Flex>
          )
        }
        if (r.representative) {
          return <Text style={{ fontSize: 13 }}>{r.representative}</Text>
        }
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: 'หัวข้อที่สนใจ',
      key: 'topic_interest_title',
      width: 260,
      render: (_, r) => {
        if (!r.topic_interest) return <Text type="secondary">—</Text>
        try {
          const topics = typeof r.topic_interest === 'string' ? JSON.parse(r.topic_interest) : r.topic_interest
          if (!Array.isArray(topics) || topics.length === 0) return <Text type="secondary">—</Text>
          return (
            <Flex vertical gap={4}>
              {topics.map((t: any, idx: number) => {
                const title = typeof t === 'string' ? t : t.title || '—'
                return (
                  <div key={idx} style={{ fontSize: 13 }}>
                    <Text style={CELL}>• {title}</Text>
                  </div>
                )
              })}
            </Flex>
          )
        } catch {
          return <Text style={{ fontSize: 13 }}>{String(r.topic_interest)}</Text>
        }
      },
    },
    {
      title: 'รายละเอียดของหัวข้อ',
      key: 'topic_interest_detail',
      render: (_, r) => {
        if (!r.topic_interest) return <Text type="secondary">—</Text>
        try {
          const topics = typeof r.topic_interest === 'string' ? JSON.parse(r.topic_interest) : r.topic_interest
          if (!Array.isArray(topics) || topics.length === 0) return <Text type="secondary">—</Text>
          const hasAnyDetail = topics.some((t: any) => typeof t === 'object' && t?.detail)
          if (!hasAnyDetail) return <Text type="secondary">—</Text>
          return (
            <Flex vertical gap={4}>
              {topics.map((t: any, idx: number) => {
                const detail = typeof t === 'object' && t?.detail ? t.detail : '—'
                return (
                  <div key={idx} style={{ fontSize: 13 }}>
                    <Text type="secondary">• {detail}</Text>
                  </div>
                )
              })}
            </Flex>
          )
        } catch {
          return <Text type="secondary">—</Text>
        }
      },
    },
  ]

  const profColumns: ColumnsType<any> = [
    {
      title: 'ProfID',
      key: 'prof_id',
      width: 100,
      align: 'center',
      render: (_, r) => <Text style={ID_PROF}>{r.prof_id || r.anonymous_code || '-'}</Text>,
    },
    {
      title: 'รายชื่ออาจารย์ (ชื่อ-นามสกุล)',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 220,
      render: v => <Text style={CELL}>{v || '—'}</Text>,
    },
    {
      title: 'ความเชี่ยวชาญ',
      dataIndex: 'expertise',
      key: 'expertise',
      render: v => <Text style={CELL}>{v || '—'}</Text>,
    },
    {
      title: 'โควต้าที่รับกลุ่มนักศึกษาได้',
      dataIndex: 'quota',
      key: 'quota',
      width: 180,
      align: 'center',
      render: v => <Text style={CELL}>{v ?? 0} กลุ่ม</Text>,
    },
  ]

  const scoreColumns: ColumnsType<any> = [
    { title: 'อาจารย์', dataIndex: 'prof_code', key: 'prof_code', render: v => <Text style={ID_PROF}>{profName(v)}</Text> },
    { title: 'กลุ่ม', dataIndex: 'group_code', key: 'group_code', align: 'center', render: v => <Text style={ID_GROUP}>{v}</Text> },
    { title: 'A (TopicFit)', dataIndex: 'score_a', key: 'score_a', align: 'center', render: v => <Text style={CELL}>{v}</Text> },
    { title: 'B (Clarity)', dataIndex: 'score_b', key: 'score_b', align: 'center', render: v => <Text style={CELL}>{v}</Text> },
    { title: 'Score', dataIndex: 'sub_score', key: 'sub_score', align: 'center', render: v => <Text style={CELL}>{v?.toFixed(1)}</Text> },
  ]

  const renderRankingsTable = () => {
    const pivot: Record<string, Record<string, number>> = {}
    const profSet = new Set<string>()
    shown.forEach((r: any) => {
      pivot[r.group_code] = pivot[r.group_code] || {}
      pivot[r.group_code][r.prof_code] = r.rank
      profSet.add(r.prof_code)
    })
    const profs = Array.from(profSet).sort()
    const rows = Object.keys(pivot).sort().map(g => ({ group: g, ...pivot[g] }))
    const cols: ColumnsType<any> = [
      { title: 'กลุ่ม', dataIndex: 'group', key: 'group', align: 'center', render: v => <Text style={ID_GROUP}>{v}</Text> },
      ...profs.map(p => ({
        title: <span style={{ color: '#722ed1' }}>{profName(p)}</span>, dataIndex: p, key: p, align: 'center' as const,
        render: (v: number) => v !== undefined
          ? <Text style={CELL}>{v}</Text>
          : <Text type="secondary" style={CELL}>—</Text>,
      })),
    ]
    return <Table dataSource={rows} columns={cols} rowKey="group" size="small" scroll={{ x: true }} pagination={{ pageSize: 20 }} />
  }

  const tabItems = [
    {
      key: 'groups', label: 'กลุ่มนักศึกษา',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={shown} columns={groupColumns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />,
    },
    {
      key: 'professors', label: 'อาจารย์',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={shown} columns={profColumns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />,
    },
    {
      key: 'rankings', label: 'Student Rankings',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : renderRankingsTable(),
    },
    {
      key: 'scores', label: 'Professor Scores',
      children: loadingTable ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <Table dataSource={shown} columns={scoreColumns} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 20 }} />,
    },
  ]

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <DatabaseOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>จัดการข้อมูล</Title>
        </div>
        <Text type="secondary">ดูข้อมูลที่กรอกผ่านฟอร์มในเว็บ แยกตามกลุ่มนักศึกษา อาจารย์ การจัดอันดับ และคะแนน</Text>
      </div>

      {sessions.length === 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="ยังไม่มีข้อมูลในรอบนี้"
          description="ข้อมูลจะปรากฏเมื่อแอดมินเปิดรอบ และนักศึกษา/อาจารย์เริ่มกรอกฟอร์มในเว็บ"
        />
      )}

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
            <Input.Search
              placeholder="ค้นหาในตาราง (รหัส / ชื่อ / ความเชี่ยวชาญ / หัวข้อ)"
              allowClear
              style={{ width: 320 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </Space>

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
