import { useEffect, useState } from 'react'
import { Card, List, Button, Typography, Space, Tag, App as AntApp } from 'antd'
import {
  FileExcelOutlined, FilePdfOutlined, FileDoneOutlined,
  CloudDownloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { listSessions, listRuns } from '../api/client'
import api from '../api/client'
import { useProgram } from '../ProgramContext'

const { Title, Text } = Typography

// อักษรย่อหลักสูตร ไว้ตั้งชื่อไฟล์ดาวน์โหลด
const PROGRAM_ABBR: Record<string, string> = {
  'รังสีเทคนิค': 'RT',
  'วิทยาศาสตร์การเคลื่อนไหวและสุขภาพ': 'HK',
  'ฉุกเฉินการแพทย์': 'PMD',
}
const abbr = (p?: string) => PROGRAM_ABBR[p || ''] || (p || 'program').replace(/\s+/g, '')

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}
const hm = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}${pad(d.getMinutes())}`
}

export default function Downloads() {
  // useApp() ต้องเรียกในระดับ component ที่อยู่ใต้ <AntApp> — ไม่ใช่ static import
  const { message } = AntApp.useApp()
  const { program } = useProgram()

  const [sessions, setSessions] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  // track loading state per item to disable button while downloading
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    listSessions(program).then(r => setSessions(r.data))
    listRuns(program).then(r => setRuns(r.data.filter((run: any) => run.status === 'success')))
  }, [program])

  // นับจำนวนไฟล์ต่อวัน — ถ้าวันเดียวกันมีหลายไฟล์ จะเติมเวลา (_HHMM) กันชื่อซ้ำ
  const sessionDayCount: Record<string, number> = {}
  sessions.forEach(s => { const k = ymd(s.uploaded_at); sessionDayCount[k] = (sessionDayCount[k] || 0) + 1 })
  const runDayCount: Record<string, number> = {}
  runs.forEach(r => { const k = ymd(r.run_at); runDayCount[k] = (runDayCount[k] || 0) + 1 })

  const rawFilename = (s: any) => {
    const day = ymd(s.uploaded_at)
    const suffix = sessionDayCount[day] > 1 ? `_${hm(s.uploaded_at)}` : ''
    return `${abbr(program)}_rawdata_${day}${suffix}.xlsx`
  }
  const resultFilename = (r: any, ext: 'xlsx' | 'pdf') => {
    const day = ymd(r.run_at)
    const suffix = runDayCount[day] > 1 ? `_${hm(r.run_at)}` : ''
    const kind = ext === 'pdf' ? 'announcement' : 'result'
    return `${abbr(program)}_${kind}_${day}${suffix}.${ext}`
  }

  /** fetch ผ่าน axios (มี Bearer token) แล้ว trigger browser download */
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
      // ถ้า responseType=blob แล้ว backend ตอบ error (JSON) — อ่าน status จาก err.response
      const status = err?.response?.status
      if (status === 401) {
        message.error('Session หมดอายุ กรุณา Login ใหม่')
      } else if (status === 404) {
        message.error('ไม่พบไฟล์บนเซิร์ฟเวอร์ (อาจถูกลบออกแล้ว)')
      } else {
        message.error(`ดาวน์โหลดไม่สำเร็จ (${status ?? 'network error'}) — กรุณาลองใหม่`)
      }
    }
  }

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <CloudDownloadOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>ดาวน์โหลดไฟล์</Title>
        </div>
        <Text type="secondary">
          ดาวน์โหลดไฟล์ข้อมูลดิบ ผลลัพธ์การจับคู่ (Excel) และไฟล์ประกาศผล (PDF)
        </Text>
      </div>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* Raw uploads */}
        <Card
          title={
            <Space>
              <FileExcelOutlined style={{ color: '#217346' }} />
              ไฟล์ข้อมูลดิบ
              <Tag>{sessions.length} ไฟล์</Tag>
            </Space>
          }
        >
          {sessions.length === 0
            ? <Text type="secondary">ยังไม่มีไฟล์ข้อมูลดิบ</Text>
            : (
              <List
                dataSource={sessions}
                renderItem={(s: any) => (
                  <List.Item
                    key={s.id}
                    actions={[
                      <Button
                        key="dl"
                        type="primary"
                        icon={<FileExcelOutlined />}
                        loading={loadingId === `upload-${s.id}`}
                        onClick={async () => {
                          const key = `upload-${s.id}`
                          setLoadingId(key)
                          await triggerDownload(
                            `/download/upload/${s.id}?program=${encodeURIComponent(program)}`,
                            rawFilename(s),
                          )
                          setLoadingId(null)
                        }}
                      >
                        ดาวน์โหลด Excel
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong>{rawFilename(s)}</Text>}
                      description={
                        <Space size={8}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(s.uploaded_at).toLocaleString('th-TH')}
                          </Text>
                          {s.status === 'validated' && (
                            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 11 }}>
                              ตรวจสอบแล้ว
                            </Tag>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
        </Card>

        {/* Results */}
        <Card
          title={
            <Space>
              <FileDoneOutlined style={{ color: '#1677ff' }} />
              ไฟล์ผลลัพธ์การจับคู่
              <Tag>{runs.length} ไฟล์</Tag>
            </Space>
          }
        >
          {runs.length === 0
            ? <Text type="secondary">ยังไม่มีผลลัพธ์การจับคู่</Text>
            : (
              <List
                dataSource={runs}
                renderItem={(r: any) => (
                  <List.Item
                    key={r.id}
                    actions={[
                      <Button
                        key="xlsx"
                        type="primary"
                        icon={<FileExcelOutlined />}
                        loading={loadingId === `result-${r.id}`}
                        onClick={async () => {
                          const key = `result-${r.id}`
                          setLoadingId(key)
                          await triggerDownload(`/download/result/${r.id}`, resultFilename(r, 'xlsx'))
                          setLoadingId(null)
                        }}
                      >
                        ดาวน์โหลด Excel
                      </Button>,
                      <Button
                        key="pdf"
                        icon={<FilePdfOutlined />}
                        loading={loadingId === `pdf-${r.id}`}
                        onClick={async () => {
                          const key = `pdf-${r.id}`
                          setLoadingId(key)
                          await triggerDownload(`/download/result/${r.id}/pdf`, resultFilename(r, 'pdf'))
                          setLoadingId(null)
                        }}
                      >
                        ดาวน์โหลด PDF (ประกาศผล)
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong>{resultFilename(r, 'xlsx')}</Text>}
                      description={
                        <Space size={8} wrap>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(r.run_at).toLocaleString('th-TH')}
                          </Text>
                          <Tag color="success">{r.num_matched} กลุ่มที่จับคู่สำเร็จ</Tag>
                          {r.num_unmatched > 0 && (
                            <Tag color="error">{r.num_unmatched} ไม่ได้จับคู่</Tag>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
        </Card>
      </Space>
    </div>
  )
}
