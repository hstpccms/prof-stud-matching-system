import React, { useEffect, useMemo, useState } from 'react'
import {
  Card, Select, Tabs, Table, Tag, Typography,
  Flex, Row, Col, Button, Empty, Badge, Tooltip, Switch, App as AntApp,
} from 'antd'
import {
  BarChartOutlined, DownloadOutlined, SwapOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listRuns, getResults, getProfSummary, getStats } from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography

type Tab = 'matching' | 'professors' | 'stats' | 'tiebreak'

/** Strip ANSI codes, BOM, and non-printable chars from log text */
function sanitizeLog(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*[mGKHF]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\uFEFF/g, '')
}

function rankColor(v: number | null): string {
  if (!v) return '#595959'
  if (v === 1) return '#52c41a'
  if (v <= 3) return '#1677ff'
  return '#595959'
}

export default function Results() {
  const { message } = AntApp.useApp()
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('matching')

  const [resultsStudent, setResultsStudent] = useState<any[]>([])
  const [resultsProfessor, setResultsProfessor] = useState<any[]>([])
  const [profSummaryStudent, setProfSummaryStudent] = useState<any[]>([])
  const [profSummaryProfessor, setProfSummaryProfessor] = useState<any[]>([])
  const [statsStudent, setStatsStudent] = useState<any>(null)
  const [statsProfessor, setStatsProfessor] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [downloadingRun, setDownloadingRun] = useState(false)
  // Toggle states for comparison table
  const [showDiffOnly, setShowDiffOnly] = useState(false)
  const [sortByImpact, setSortByImpact] = useState(false)

  const triggerDownload = async (url: string, filename: string) => {
    try {
      const res = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
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
    listRuns().then(res => {
      const ok = res.data.filter((r: any) => r.status === 'success')
      setRuns(ok)
      if (ok.length) setSelectedRunId(ok[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedRunId) return
    setLoading(true)
    Promise.all([
      getResults(selectedRunId, 'student'),
      getResults(selectedRunId, 'professor'),
      getProfSummary(selectedRunId, 'student'),
      getProfSummary(selectedRunId, 'professor'),
      getStats(selectedRunId, 'student'),
      getStats(selectedRunId, 'professor'),
    ])
      .then(([rs, rp, ps, pp, ss, sp]) => {
        setResultsStudent(rs.data)
        setResultsProfessor(rp.data)
        setProfSummaryStudent(ps.data)
        setProfSummaryProfessor(pp.data)
        setStatsStudent(ss.data)
        setStatsProfessor(sp.data)
      })
      .finally(() => setLoading(false))
  }, [selectedRunId])

  const selectedRun = runs.find(r => r.id === selectedRunId)

  const compRows = useMemo(() => {
    const profMap = new Map(resultsProfessor.map(r => [r.group_code, r]))
    return resultsStudent.map((s, i) => {
      const p = profMap.get(s.group_code)
      const sRank = s.rank_given ?? 0
      const pRank = p?.rank_given ?? 0
      // impact = |rank_professor_proposing - rank_student_proposing|
      // คำนวณที่ Frontend เพราะข้อมูล Rank ทั้งสองฝั่งมีอยู่แล้ว ไม่จำเป็นต้องแก้ Backend
      const impact = Math.abs(pRank - sRank)
      return {
        key: String(i),
        group_code: s.group_code,
        s_prof: s.assigned_prof,
        s_rank: s.rank_given,
        p_prof: p?.assigned_prof ?? null,
        p_rank: p?.rank_given ?? null,
        diff: s.assigned_prof !== (p?.assigned_prof ?? null),
        impact,
      }
    })
  }, [resultsStudent, resultsProfessor])

  // numDiff คำนวณจากข้อมูลเต็มเสมอ — ไม่เปลี่ยนตาม toggle ที่เปิดอยู่
  const numDiff = compRows.filter(r => r.diff).length

  // displayRows: กรอง → เรียง → แสดง (ลำดับสำคัญ ต้องไม่สลับ)
  const displayRows = useMemo(() => {
    // ขั้น 1: กรองตาม showDiffOnly
    let rows = showDiffOnly ? compRows.filter(r => r.diff) : [...compRows]
    // ขั้น 2: เรียงตาม sortByImpact (impact=0 อยู่ท้ายสุด)
    if (sortByImpact) {
      rows = rows.slice().sort((a, b) => {
        if (a.impact === 0 && b.impact === 0) return 0
        if (a.impact === 0) return 1
        if (b.impact === 0) return -1
        return b.impact - a.impact
      })
    }
    return rows
  }, [compRows, showDiffOnly, sortByImpact])

  /*
   * NOTE: คอลัมน์ Score ถูกลบออกโดยตั้งใจ — ห้ามเพิ่มกลับ
   * Score เป็นคะแนนที่อาจารย์แต่ละคนให้ตาม Rubric ของตัวเอง
   * ใช้เป็น Ordinal Preference ภายในรายการของอาจารย์คนนั้นเท่านั้น
   * ไม่ได้ถูกออกแบบให้เทียบข้ามอาจารย์คนละคนได้
   * การวางคอลัมน์ Score จากอาจารย์ 2 คนต่างกันไว้ข้างกันทำให้แอดมินเข้าใจผิด
   * ว่าเทียบกันได้โดยตรง (เช่น "89 ดีกว่า 38") ทั้งที่ไม่ใช่
   */
  const compColumns: ColumnsType<any> = [
    {
      // # นับใหม่ตามแถวที่แสดงจริงบนหน้าจอ (ไม่ใช่เลขเดิมจาก list เต็ม)
      title: '#', key: 'idx', width: 44,
      render: (_: any, __: any, i: number) => <Text type="secondary">{i + 1}</Text>,
    },
    {
      title: 'กลุ่ม', dataIndex: 'group_code', width: 90,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: <span style={{ color: '#1677ff', fontWeight: 600, fontSize: 13 }}>Student-Proposing</span>,
      onHeaderCell: () => ({ style: { borderBottom: '2px solid #1677ff' } }),
      children: [
        {
          title: 'อาจารย์', dataIndex: 's_prof', key: 's_prof',
          render: (v: string) => (!v || v === 'UNMATCHED')
            ? <Tag color="error">UNMATCHED</Tag>
            : <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
        },
        {
          // คง 'อันดับ' ไว้ — เป็นข้อมูลที่เทียบข้ามได้จริง (มาจาก Ranking List เดียวกันของกลุ่มนั้น)
          title: 'อันดับ', dataIndex: 's_rank', key: 's_rank',
          align: 'center' as const, width: 70,
          render: (v: number) => v
            ? <Text strong style={{ color: rankColor(v) }}>{v}</Text> : '—',
        },
      ],
    },
    {
      title: '',
      key: 'divider',
      width: 4,
      render: () => null,
      onHeaderCell: () => ({ style: { background: '#d9d9d9', padding: 0 } }),
      onCell: () => ({ style: { background: '#f0f0f0', padding: 0 } }),
    },
    {
      title: <span style={{ color: '#722ed1', fontWeight: 600, fontSize: 13 }}>Professor-Proposing</span>,
      onHeaderCell: () => ({ style: { borderBottom: '2px solid #722ed1' } }),
      children: [
        {
          title: 'อาจารย์', dataIndex: 'p_prof', key: 'p_prof',
          render: (v: string) => (!v || v === 'UNMATCHED')
            ? <Tag color="error">UNMATCHED</Tag>
            : <Text strong style={{ color: '#722ed1' }}>{v}</Text>,
        },
        {
          // คง 'อันดับ' ไว้ — เป็นข้อมูลที่เทียบข้ามได้จริง (มาจาก Ranking List เดียวกันของกลุ่มนั้น)
          title: 'อันดับ', dataIndex: 'p_rank', key: 'p_rank',
          align: 'center' as const, width: 70,
          render: (v: number) => v
            ? <Text strong style={{ color: rankColor(v) }}>{v}</Text> : '—',
        },
      ],
    },
    {
      // Binary Indicator — คงเป็น ต่าง/— เหมือนเดิม ไม่เพิ่มทิศทางหรือขนาดผลต่าง
      title: (
        <Tooltip title="ผลจากสองโหมดต่างกันหรือไม่">
          <SwapOutlined />
        </Tooltip>
      ),
      dataIndex: 'diff', key: 'diff', align: 'center' as const, width: 56,
      render: (v: boolean) => v
        ? <Tag color="orange" style={{ margin: 0 }}>ต่าง</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
  ]

  const profCols = (color: string): ColumnsType<any> => [
    { title: 'รหัส', dataIndex: 'prof_code', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'ชื่อ', dataIndex: 'full_name', render: (v: string) => <Text strong>{v || '—'}</Text> },
    { title: 'Quota', dataIndex: 'quota', align: 'center' as const },
    {
      title: 'กลุ่มที่ได้รับ', dataIndex: 'groups_assigned',
      render: (v: string[]) => v?.length
        ? v.map(g => <Tag key={g} color={color} style={{ marginBottom: 2 }}>{g}</Tag>)
        : <Text type="danger">—</Text>,
    },
    {
      title: 'จำนวน', dataIndex: 'num_assigned', align: 'center' as const,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: 'คงเหลือ', dataIndex: 'quota_remaining', align: 'center' as const,
      render: (v: number) => <Tag color={v === 0 ? 'success' : v > 0 ? 'warning' : 'error'}>{v}</Tag>,
    },
  ]

  const sameResult = resultsStudent.length > 0 && numDiff === 0

  // ── Stats comparison table rows ──────────────────────────────────────────
  const buildStatsRows = (s: any, p: any) => {
    if (!s && !p) return []

    const advantage = (
      sVal: number | null,
      pVal: number | null,
      higherIsBetter = true,
    ): React.ReactNode => {
      if (sVal === null || pVal === null) return <Text type="secondary">—</Text>
      if (sVal === pVal) return <Tag color="default" style={{ margin: 0 }}>เท่ากัน</Tag>
      const studentWins = higherIsBetter ? sVal > pVal : sVal < pVal
      return studentWins
        ? <Tag color="blue" style={{ margin: 0, color: '#1677ff', background: '#e6f4ff', borderColor: '#91caff' }}>Student</Tag>
        : <Tag color="purple" style={{ margin: 0, color: '#722ed1', background: '#f9f0ff', borderColor: '#d3adf7' }}>Professor</Tag>
    }

    return [
      {
        key: 'matched',
        metric: 'จำนวนกลุ่มที่จับคู่สำเร็จ',
        student: s?.num_matched ?? '—',
        professor: p?.num_matched ?? '—',
        adv: advantage(s?.num_matched ?? null, p?.num_matched ?? null, true),
      },
      {
        key: 'unmatched',
        metric: 'จำนวนกลุ่มที่ไม่ได้จับคู่ (Unmatched)',
        student: s?.num_unmatched ?? '—',
        professor: p?.num_unmatched ?? '—',
        adv: advantage(s?.num_unmatched ?? null, p?.num_unmatched ?? null, false),
      },
      {
        key: 'avg_rank',
        metric: 'Rank เฉลี่ยที่นักศึกษาได้รับ (ยิ่งน้อยยิ่งดี)',
        student: s?.avg_rank ?? '—',
        professor: p?.avg_rank ?? '—',
        adv: advantage(s?.avg_rank ?? null, p?.avg_rank ?? null, false),
      },
      {
        key: 'pct_rank1',
        metric: '% กลุ่มที่ได้อาจารย์อันดับ 1 ของตน',
        student: s?.pct_rank1 != null ? s.pct_rank1 : '—',
        professor: p?.pct_rank1 != null ? p.pct_rank1 : '—',
        adv: advantage(s?.pct_rank1 ?? null, p?.pct_rank1 ?? null, true),
      },
      {
        key: 'pct_top3',
        metric: '% กลุ่มที่ได้อาจารย์อยู่ใน Top-3 ของตน',
        student: s?.pct_top3 != null ? s.pct_top3 : '—',
        professor: p?.pct_top3 != null ? p.pct_top3 : '—',
        adv: advantage(s?.pct_top3 ?? null, p?.pct_top3 ?? null, true),
      },
      {
        key: 'avg_main',
        metric: 'Main Score เฉลี่ยที่อาจารย์ให้กลุ่มที่ตนได้ (ความพอใจฝั่งอาจารย์)',
        student: s?.avg_main_score ?? '—',
        professor: p?.avg_main_score ?? '—',
        adv: advantage(s?.avg_main_score ?? null, p?.avg_main_score ?? null, true),
      },
    ]
  }

  const statsTableCols: ColumnsType<any> = [
    {
      title: 'ตัวชี้วัด',
      dataIndex: 'metric',
      key: 'metric',
      width: '42%',
      render: (v: React.ReactNode) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: <span style={{ color: '#1677ff', fontWeight: 600 }}>Student-Proposing</span>,
      dataIndex: 'student',
      key: 'student',
      align: 'center' as const,
      width: '20%',
      render: (v: any) => <Text strong style={{ fontSize: 14 }}>{v}</Text>,
    },
    {
      title: <span style={{ color: '#722ed1', fontWeight: 600 }}>Professor-Proposing</span>,
      dataIndex: 'professor',
      key: 'professor',
      align: 'center' as const,
      width: '20%',
      render: (v: any) => <Text strong style={{ fontSize: 14 }}>{v}</Text>,
    },
    {
      title: 'ฝั่งที่ได้เปรียบ',
      dataIndex: 'adv',
      key: 'adv',
      align: 'center' as const,
      width: '18%',
      render: (v: React.ReactNode) => v,
    },
  ]

  const tabItems = [
    {
      key: 'matching',
      label: (
        <Flex align="center" gap={6}>
          <span>Final Matching</span>
          {numDiff > 0 && !loading && (
            <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
              {numDiff} ต่าง
            </Tag>
          )}
        </Flex>
      ),
      children: (
        <div>
          {/* แถว Legend + Toggle controls — ข้อความ numDiff คงค่าจากข้อมูลเต็มเสมอ ไม่เปลี่ยนตาม filter */}
          <Flex align="center" justify="space-between" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
            <Flex align="center" gap={16}>
              <Badge color="#1677ff" text={<Text style={{ fontSize: 12 }}>Student-Proposing</Text>} />
              <Badge color="#722ed1" text={<Text style={{ fontSize: 12 }}>Professor-Proposing</Text>} />
              {numDiff > 0 && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  ⚠ {numDiff} กลุ่มได้ผลต่างกันระหว่างสองโหมด
                </Text>
              )}
            </Flex>
            <Flex align="center" gap={16}>
              <Flex align="center" gap={6}>
                <Switch
                  size="small"
                  checked={showDiffOnly}
                  onChange={setShowDiffOnly}
                  id="toggle-show-diff-only"
                />
                <Text style={{ fontSize: 12, userSelect: 'none' }}>แสดงเฉพาะกลุ่มที่ต่างกัน</Text>
              </Flex>
              <Flex align="center" gap={6}>
                <Switch
                  size="small"
                  checked={sortByImpact}
                  onChange={setSortByImpact}
                  id="toggle-sort-by-impact"
                />
                <Text style={{ fontSize: 12, userSelect: 'none' }}>เรียงตาม Impact</Text>
              </Flex>
            </Flex>
          </Flex>
          <Table
            dataSource={displayRows}
            columns={compColumns}
            rowKey="key"
            size="small"
            loading={loading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: true }}
            bordered
            rowClassName={(r: any) => r.diff ? 'row-diff' : ''}
          />
          <style>{`
            .row-diff td { background-color: #fffbe6 !important; }
            .row-diff:hover td { background-color: #fff1b8 !important; }
          `}</style>
        </div>
      ),
    },
    {
      key: 'professors',
      label: 'Professor Summary',
      children: (
        <Row gutter={24}>
          <Col span={12}>
            <div style={{ fontWeight: 700, color: '#1677ff', marginBottom: 8, fontSize: 13 }}>
              Student-Proposing
            </div>
            <Table
              dataSource={profSummaryStudent}
              columns={profCols('#1677ff')}
              rowKey="prof_code"
              size="small"
              loading={loading}
              pagination={false}
              bordered
            />
          </Col>
          <Col span={12}>
            <div style={{ fontWeight: 700, color: '#722ed1', marginBottom: 8, fontSize: 13 }}>
              Professor-Proposing
            </div>
            <Table
              dataSource={profSummaryProfessor}
              columns={profCols('#722ed1')}
              rowKey="prof_code"
              size="small"
              loading={loading}
              pagination={false}
              bordered
            />
          </Col>
        </Row>
      ),
    },
    {
      key: 'stats',
      label: 'สถิติ',
      children: (statsStudent || statsProfessor) ? (
        <div style={{ padding: '16px 4px' }}>
          {sameResult && (
            <div style={{ borderLeft: '3px solid #52c41a', paddingLeft: 12, marginBottom: 16 }}>
              <Text style={{ color: '#389e0d', fontSize: 13 }}>
                ทั้งสองโหมดให้ผล matching เหมือนกัน — ข้อมูลชุดนี้มี Stable Matching เดียว
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                (เมื่อ matching เหมือนกัน สถิติทั้ง 6 ตัวจึงเท่ากัน ซึ่งถูกต้องตามทฤษฎี Gale-Shapley)
              </Text>
            </div>
          )}
          {numDiff > 0 && (
            <div style={{ borderLeft: '3px solid #faad14', paddingLeft: 12, marginBottom: 16 }}>
              <Text type="warning" style={{ fontSize: 13 }}>
                ทั้งสองโหมดให้ผล matching ต่างกัน {numDiff} กลุ่ม — ดูแท็บ Final Matching เพื่อเปรียบเทียบ
              </Text>
            </div>
          )}
          <Table
            dataSource={buildStatsRows(statsStudent, statsProfessor)}
            columns={statsTableCols}
            rowKey="key"
            size="small"
            loading={loading}
            pagination={false}
            bordered
            style={{ marginBottom: 16 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Seed: <Text code style={{ fontSize: 12 }}>
              {statsStudent?.seed ?? statsProfessor?.seed}
            </Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              (บันทึกไว้เพื่อตรวจสอบ Tie-break)
            </Text>
          </Text>
        </div>
      ) : null,
    },
    {
      key: 'tiebreak',
      label: 'TieBreak Log',
      children: (
        <div style={{ padding: 20 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            กรณีที่ต้องใช้ Seeded Random ตัดสินในขั้นสุดท้าย (Tie-break ชั้น 3)
          </Text>
          {selectedRun?.log
            ? (
              <div className="log-viewer">
                {sanitizeLog(selectedRun.log)}
              </div>
            )
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
        <Text type="secondary" style={{ display: 'block', marginBottom: 40 }}>
          ยังไม่มีผลลัพธ์ — ไปรัน Matching ก่อน
        </Text>
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
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap={16}
        style={{ marginBottom: 24 }}
      >
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>ผลลัพธ์การจับคู่</Title>
          <Text type="secondary">
            เปรียบเทียบ Student-Proposing 🔵 vs Professor-Proposing 🟣
          </Text>
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
              loading={downloadingRun}
              onClick={async () => {
                const run = runs.find(r => r.id === selectedRunId)
                setDownloadingRun(true)
                await triggerDownload(
                  `/download/result/${selectedRunId}`,
                  `result_run${selectedRunId}_seed${run?.seed ?? 0}.xlsx`,
                )
                setDownloadingRun(false)
              }}
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
