import { useEffect, useState } from 'react'
import {
  Card, Typography, Form, Input, InputNumber, Button, Alert, Tag, Table,
  App as AntApp, Spin, Result, Space, Tooltip,
} from 'antd'
import { SaveOutlined, StarOutlined, LockOutlined, QuestionCircleOutlined, SolutionOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getProfessorMe, submitProfessorForm2, getGroupsForScoring, submitProfessorForm4,
} from '../api/client'

const { Title, Text, Paragraph } = Typography

export default function ProfessorPortal() {
  const { message } = AntApp.useApp()
  const [form2] = Form.useForm()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving2, setSaving2] = useState(false)
  const [groups, setGroups] = useState<any[]>([])
  const [scores, setScores] = useState<Record<string, { a?: number; b?: number }>>({})
  const [saving4, setSaving4] = useState(false)

  const fetchMe = async () => {
    try {
      const res = await getProfessorMe()
      setMe(res.data)
      if (res.data?.info_submitted) {
        form2.setFieldsValue({ expertise: res.data.expertise, quota: res.data.quota })
      }
      if (res.data?.current_scores?.length) {
        setScores(Object.fromEntries(
          res.data.current_scores.map((s: any) => [s.group_anonymous_code, { a: s.score_a, b: s.score_b }])
        ))
      }
      return res.data
    } finally { setLoading(false) }
  }

  const fetchGroups = async () => {
    try {
      const res = await getGroupsForScoring()
      setGroups(res.data)
    } catch { /* not ready */ }
  }

  useEffect(() => {
    (async () => {
      const m = await fetchMe()
      if (m?.codes_generated) fetchGroups()
    })()
  }, [])

  // ── ข้อ 1: ติดตามค่าฟอร์ม 2 เพื่อเปิด/ปิดปุ่มส่งเมื่อกรอกครบ ──
  const w2Expertise = Form.useWatch('expertise', form2)
  const w2Quota = Form.useWatch('quota', form2)
  const form2Complete = !!(w2Expertise && String(w2Expertise).trim()) && w2Quota != null

  const handleSubmit2 = async (values: any) => {
    setSaving2(true)
    try {
      await submitProfessorForm2(values.expertise, values.quota)
      message.success('บันทึกข้อมูลอาจารย์แล้ว')
      await fetchMe()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'บันทึกไม่สำเร็จ')
    } finally { setSaving2(false) }
  }

  const handleSubmit4 = async () => {
    const entries = groups.map(g => ({
      group_anonymous_code: g.anonymous_code,
      score_a: scores[g.anonymous_code]?.a,
      score_b: scores[g.anonymous_code]?.b,
    }))
    if (entries.some(e => e.score_a == null || e.score_b == null)) {
      message.error('กรุณาให้คะแนนครบทุกกลุ่ม (ทั้ง A และ B)'); return
    }
    setSaving4(true)
    try {
      await submitProfessorForm4(entries as any)
      message.success('ส่งคะแนนแล้ว')
      await fetchMe()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'ส่งไม่สำเร็จ')
    } finally { setSaving4(false) }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>

  if (!me?.round_open) {
    return (
      <div style={{ padding: 32 }}>
        <Result status="info" title="ยังไม่เปิดรอบรับฟอร์ม"
          subTitle="กรุณารอให้แอดมินเปิดรอบ แล้วเข้ามากรอกข้อมูลอีกครั้ง" />
      </div>
    )
  }

  const roundClosed = me.is_closed || me.matching_started   // รอบปิดรับแล้ว (ปิดเอง/เริ่ม matching)
  const form2Locked = me.codes_generated || roundClosed
  const form4Locked = me.matching_started || me.is_closed

  // ── ข้อ 1: ฟอร์ม 4 ให้คะแนน A+B ครบทุกกลุ่มหรือยัง ──
  const form4Complete = groups.length > 0 && groups.every(g => {
    const s = scores[g.anonymous_code]
    return s && s.a != null && s.b != null
  })

  const setScore = (code: string, key: 'a' | 'b', val: number | null) =>
    setScores(prev => ({ ...prev, [code]: { ...prev[code], [key]: val ?? undefined } }))

  const scoreColumns: ColumnsType<any> = [
    { title: 'กลุ่ม (นิรนาม)', dataIndex: 'anonymous_code', key: 'code', width: 120, render: v => <Tag color="blue">{v}</Tag> },
    {
      title: 'หัวข้อที่กลุ่มสนใจ', dataIndex: 'topics', key: 'topics',
      render: (topics: any[]) => Array.isArray(topics) && topics.length
        ? (
          <Space direction="vertical" size={4} style={{ display: 'flex' }}>
            {topics.map((t, i) => {
              const title = typeof t === 'string' ? t : (t?.title || '')
              const detail = typeof t === 'string' ? '' : (t?.detail || '')
              if (!title && !detail) return null
              return (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <Text strong>หัวข้อ {i + 1}:</Text> {title || '—'}
                  {detail ? <div style={{ color: '#888', paddingLeft: 12 }}>รายละเอียด: {detail}</div> : null}
                </div>
              )
            })}
          </Space>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: (
        <Tooltip title="หัวข้อที่กลุ่มเลือก ตรงกับสาขาที่ท่านเชี่ยวชาญ/รับให้คำปรึกษามากแค่ไหน (100 = ตรงมากที่สุด)">
          <span>A · ความตรงกับความเชี่ยวชาญ (0–100) <QuestionCircleOutlined style={{ color: '#999' }} /></span>
        </Tooltip>
      ),
      key: 'a', width: 200, align: 'center',
      render: (_, r) => (
        <InputNumber min={0} max={100} precision={0} step={1} style={{ width: 100 }} disabled={form4Locked}
          value={scores[r.anonymous_code]?.a}
          onChange={v => setScore(r.anonymous_code, 'a', v as number)} />
      ),
    },
    {
      title: (
        <Tooltip title="หัวข้อและรายละเอียดที่เขียนมา ชัดเจน เข้าใจง่าย ขอบเขตชัดแค่ไหน (100 = ชัดเจนมากที่สุด)">
          <span>B · ความชัดเจนของหัวข้อ (0–100) <QuestionCircleOutlined style={{ color: '#999' }} /></span>
        </Tooltip>
      ),
      key: 'b', width: 200, align: 'center',
      render: (_, r) => (
        <InputNumber min={0} max={100} precision={0} step={1} style={{ width: 100 }} disabled={form4Locked}
          value={scores[r.anonymous_code]?.b}
          onChange={v => setScore(r.anonymous_code, 'b', v as number)} />
      ),
    },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1000 }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <SolutionOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>ฟอร์มของอาจารย์</Title>
        </div>
        <Text type="secondary">กรอกข้อมูลและโควตา (ฟอร์ม 2) และให้คะแนนกลุ่ม (ฟอร์ม 4)</Text>
      </div>

      {roundClosed ? (
        <Alert type="warning" showIcon icon={<LockOutlined />} style={{ marginBottom: 16 }}
          message={me.matching_started
            ? 'ปิดรับฟอร์มแล้ว — ระบบกำลังประมวลผลจับคู่ ไม่สามารถส่งหรือแก้ไขฟอร์มได้'
            : 'รอบนี้ปิดรับแล้ว — ไม่สามารถส่งหรือแก้ไขฟอร์มได้ หากต้องการแก้ไขกรุณาติดต่อผู้ดูแลระบบ'} />
      ) : (
        <Alert type="success" showIcon style={{ marginBottom: 16 }}
          message="เปิดรับฟอร์ม — ท่านสามารถกรอกและแก้ไขข้อมูลได้" />
      )}

      {/* ── Form 2 ── */}
      <Card title={<span>👤 ฟอร์ม 2 — ข้อมูลอาจารย์และโควตา</span>} style={{ marginBottom: 24 }}
        extra={me.info_submitted ? <Tag color="success">ส่งแล้ว</Tag> : <Tag>ยังไม่ส่ง</Tag>}>
        {form2Locked && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            message="รอบนี้สร้างรหัสนิรนามแล้ว — ไม่สามารถแก้ไขข้อมูลได้" />
        )}
        <Form form={form2} layout="vertical" onFinish={handleSubmit2} disabled={form2Locked} style={{ maxWidth: 520 }}>
          <Form.Item label="ความเชี่ยวชาญ / สาขาที่รับให้คำปรึกษา" name="expertise" rules={[{ required: true, message: 'กรอกความเชี่ยวชาญ' }]} style={{ marginBottom: 4 }}>
            <Input.TextArea maxLength={200} autoSize={{ minRows: 2, maxRows: 8 }} placeholder="เช่น Machine Learning, Image Processing" />
          </Form.Item>
          <div style={{ textAlign: 'right', fontSize: 11, marginTop: 2, marginBottom: 16, color: (w2Expertise || '').length >= 200 ? '#ff4d4f' : '#999' }}>
            {(w2Expertise || '').length}/200
          </div>
          <Form.Item label="โควตา — รับได้กี่กลุ่ม" name="quota" rules={[{ required: true, message: 'กรอกโควตา' }]}>
            <InputNumber min={1} max={50} style={{ width: 160 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving2} icon={<SaveOutlined />} disabled={form2Locked || !form2Complete}>
            บันทึกข้อมูล
          </Button>
        </Form>
      </Card>

      {/* ── Form 4 ── */}
      <Card title={<span><StarOutlined /> ฟอร์ม 4 — ให้คะแนนกลุ่มนักศึกษา</span>}
        extra={me.score_submitted ? <Tag color="success">บันทึกแล้ว ({me.scored_count}/{me.total_groups})</Tag> : <Tag>ยังไม่บันทึก</Tag>}>
        {me.matching_started && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} icon={<LockOutlined />}
            message="ปิดรับการแก้ไขแล้ว — ระบบเริ่มรัน Matching ไปแล้ว" />
        )}
        {!me.codes_generated ? (
          <Alert type="info" showIcon
            message="ยังไม่เปิดให้คะแนน"
            description="รอให้แอดมินสร้างรหัสนิรนามก่อน จึงจะให้คะแนนกลุ่มได้" />
        ) : !me.info_submitted ? (
          <Alert type="warning" showIcon message="กรุณาส่งข้อมูลอาจารย์ (ฟอร์ม 2) ก่อน" />
        ) : (
          <>
            <Paragraph type="secondary">ให้คะแนนแต่ละกลุ่ม 2 ด้าน (A และ B) — ระบบจะคำนวณ Sub/Main score ให้อัตโนมัติ</Paragraph>
            <Table dataSource={groups} columns={scoreColumns} rowKey="anonymous_code" size="small" pagination={false} />
            <Button type="primary" onClick={handleSubmit4} loading={saving4} icon={<SaveOutlined />} style={{ marginTop: 16 }} disabled={form4Locked || !form4Complete}>
              {me.score_submitted ? 'บันทึกการแก้ไข' : 'ส่งคะแนน'}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
