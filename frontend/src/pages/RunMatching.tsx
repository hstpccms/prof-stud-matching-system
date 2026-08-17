import { useEffect, useState } from 'react'
import {
  Card, Select, Button, Alert, Typography, Row, Col,
  Space, Flex, Tag, App as AntApp, InputNumber,
} from 'antd'
import {
  PlayCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { listSessions, runMatching, getRun, validateSession } from '../api/client'
import { useProgram } from '../ProgramContext'

const { Title, Text } = Typography

export default function RunMatching() {
  const { message } = AntApp.useApp()
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSid, setSelectedSid] = useState<number | null>(null)
  const [seed, setSeed] = useState(2026)
  const [running, setRunning] = useState(false)
  const [currentRun, setCurrentRun] = useState<any>(null)
  const [validation, setValidation] = useState<any>(null)
  const [checkingVal, setCheckingVal] = useState(false)
  const { program } = useProgram()

  useEffect(() => {
    listSessions().then(res => {
      setSessions(res.data)
      if (res.data.length > 0) setSelectedSid(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedSid) return
    setCheckingVal(true); setValidation(null)
    validateSession(selectedSid, program)
      .then(r => setValidation(r.data))
      .catch(() => {})
      .finally(() => setCheckingVal(false))
  }, [selectedSid, program])

  const pollRun = (runId: number) => {
    const t = setInterval(async () => {
      try {
        const res = await getRun(runId)
        setCurrentRun(res.data)
        if (res.data.status !== 'running') {
          clearInterval(t); setRunning(false)
          if (res.data.status === 'success')
            message.success(`Matching สำเร็จ — จับคู่ได้ ${res.data.num_matched} กลุ่ม`)
          else
            message.error('Matching ล้มเหลว — ดู Output ด้านล่าง')
        }
      } catch { clearInterval(t); setRunning(false) }
    }, 2000)
  }

  const handleRun = async () => {
    if (!selectedSid || !validation?.passed) return
    setRunning(true); setCurrentRun(null)
    try {
      const res = await runMatching(selectedSid, seed, program)
      setCurrentRun(res.data)
      message.info('เริ่มรัน Matching Algorithm...')
      pollRun(res.data.id)
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'ไม่สามารถเริ่มรันได้')
      setRunning(false)
    }
  }

  const canRun = validation?.passed && !running && selectedSid

  const statusTag = (status: string) => {
    if (status === 'running') return <Tag color="processing" icon={<ClockCircleOutlined />}>กำลังรัน...</Tag>
    if (status === 'success') return <Tag color="success" icon={<CheckCircleOutlined />}>สำเร็จ</Tag>
    if (status === 'failed')  return <Tag color="error" icon={<ExclamationCircleOutlined />}>ล้มเหลว</Tag>
    return null
  }

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>รัน Matching Algorithm</Title>
        <Text type="secondary">Student-Proposing Deferred Acceptance with Hospital/Residents Ties</Text>
      </div>

      <Row gutter={16}>
        {/* Config */}
        <Col span={10}>
          <Card title="ตั้งค่า">
            <Flex vertical gap={16} style={{ width: '100%' }}>
              {/* Dataset select */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>ชุดข้อมูล</Text>
                <Select
                  style={{ width: '100%' }}
                  value={selectedSid}
                  onChange={v => setSelectedSid(v)}
                  options={sessions.map((s: any) => ({
                    value: s.id,
                    label: `${s.filename || `Session #${s.id}`} — ${new Date(s.uploaded_at).toLocaleString('th-TH')}`,
                  }))}
                />
              </div>

              {/* Validation status */}
              {selectedSid && (
                <div>
                  {checkingVal
                    ? <Alert type="info" showIcon message="กำลังตรวจสอบข้อมูล..." />
                    : validation && (
                      <Alert
                        type={validation.passed ? 'success' : 'error'}
                        showIcon
                        message={validation.passed ? 'ข้อมูลผ่านการตรวจสอบ' : `ไม่ผ่าน ${validation.errors.length} เงื่อนไข`}
                      />
                    )}
                </div>
              )}

              {/* Seed */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Random Seed</Text>
                <Space>
                  <InputNumber
                    min={1}
                    value={seed}
                    onChange={v => setSeed(v ?? 1)}
                    style={{ width: 160 }}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => setSeed(Math.floor(Math.random() * 99999) + 1)}
                    title="สุ่ม Seed"
                  />
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  บันทึกไว้เพื่อ Audit ย้อนหลัง
                </Text>
              </div>

              {/* Run button */}
              <Button
                type="primary"
                size="large"
                block
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                disabled={!canRun}
                loading={running}
              >
                {running ? 'กำลังประมวลผล...' : 'สั่งรัน Matching'}
              </Button>
            </Flex>
          </Card>
        </Col>

        {/* Status */}
        <Col span={14}>
          <Card title="สถานะการรัน" style={{ minHeight: 300 }}>
            {!currentRun && !running && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#bfbfbf' }}>
                <PlayCircleOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                <Text type="secondary">ยังไม่มีการรัน — กด "สั่งรัน Matching" ทางซ้าย</Text>
              </div>
            )}

            {currentRun && (
              <div className="animate-fade-in">
                {/* Status */}
                <Space style={{ marginBottom: 16 }}>
                  {statusTag(currentRun.status)}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined /> {new Date(currentRun.run_at).toLocaleString('th-TH')}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Seed: <Text code>{currentRun.seed}</Text>
                  </Text>
                </Space>

                {/* Stats */}
                {currentRun.status === 'success' && (
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    {[
                      { label: 'จับคู่สำเร็จ', value: currentRun.num_matched, color: '#52c41a' },
                      { label: 'ไม่ได้จับคู่', value: currentRun.num_unmatched, color: currentRun.num_unmatched > 0 ? '#ff4d4f' : '#8c8c8c' },
                      { label: 'Tie-break', value: currentRun.num_ties, color: '#faad14' },
                    ].map(({ label, value, color }) => (
                      <Col span={8} key={label}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.6rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                {/* Log */}
                {currentRun.log && (
                  <>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                      Output
                    </Text>
                    <div className="log-viewer">
                      {currentRun.log.split('\n').map((line: string, i: number) => (
                        <div
                          key={i}
                          className={line.includes('Matched') ? 'log-success' : line.toLowerCase().includes('error') ? 'log-error' : ''}
                        >
                          {line || '\u00A0'}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
