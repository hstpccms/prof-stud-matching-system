import { useEffect, useState } from 'react'
import {
  Card, Typography, Form, Input, Button, Space, Alert, Tag, Table,
  Select, App as AntApp, Spin, Divider, Result, Descriptions, Flex,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, OrderedListOutlined, LockOutlined, FormOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getMe, getStudentMe, getStudentRoster, submitStudentForm1,
  getProfessorsForRanking, submitStudentForm3,
} from '../api/client'

const { Title, Text, Paragraph } = Typography

export default function StudentPortal() {
  const { message } = AntApp.useApp()
  const [form1] = Form.useForm()
  const [me, setMe] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [roster, setRoster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving1, setSaving1] = useState(false)
  const [profs, setProfs] = useState<any[]>([])
  const [ranks, setRanks] = useState<Record<string, number | undefined>>({})
  const [saving3, setSaving3] = useState(false)

  const rosterMap: Record<string, string> = Object.fromEntries(roster.map(r => [r.student_id, r.full_name || r.student_id]))

  const loadAll = async () => {
    const [meRes, profRes, rosterRes] = await Promise.all([
      getStudentMe(), getMe(), getStudentRoster().catch(() => ({ data: [] })),
    ])
    const m = meRes.data
    setMe(m); setProfile(profRes.data); setRoster(rosterRes.data)

    // prefill Form 1
    const members: string[] = m.group?.members?.length
      ? m.group.members.map((x: any) => x.student_id)
      : (profRes.data?.student_id ? [profRes.data.student_id] : [''])
    const topics = m.topics || []
    form1.setFieldsValue({
      members,
      topic1_title: topics[0]?.title, topic1_detail: topics[0]?.detail,
      topic2_title: topics[1]?.title, topic2_detail: topics[1]?.detail,
      topic3_title: topics[2]?.title, topic3_detail: topics[2]?.detail,
    })

    // prefill Form 3
    if (m.current_rankings?.length) {
      setRanks(Object.fromEntries(m.current_rankings.map((r: any) => [r.prof_anonymous_code, r.rank])))
    }
    if (m.codes_generated) {
      try { setProfs((await getProfessorsForRanking()).data) } catch { /* ignore */ }
    }
    return m
  }

  useEffect(() => { loadAll().finally(() => setLoading(false)) }, [])

  // ── ข้อ 1: ติดตามค่าฟอร์ม 1 เพื่อเปิด/ปิดปุ่มส่งเมื่อกรอกครบทุกช่อง ──
  const w1Members = Form.useWatch('members', form1) as (string | undefined)[] | undefined
  const w1t1t = Form.useWatch('topic1_title', form1)
  const w1t1d = Form.useWatch('topic1_detail', form1)
  const w1t2t = Form.useWatch('topic2_title', form1)
  const w1t2d = Form.useWatch('topic2_detail', form1)
  const w1t3t = Form.useWatch('topic3_title', form1)
  const w1t3d = Form.useWatch('topic3_detail', form1)
  const titleW = [w1t1t, w1t2t, w1t3t]
  const detailW = [w1t1d, w1t2d, w1t3d]

  const handleSubmit1 = async (values: any) => {
    const ids: string[] = (values.members || []).filter(Boolean)
    if (ids.length < 2) { message.error('กลุ่มต้องมีสมาชิกอย่างน้อย 2 คน'); return }
    if (new Set(ids).size !== ids.length) { message.error('มีสมาชิกซ้ำกัน'); return }
    setSaving1(true)
    try {
      await submitStudentForm1({
        members: ids.map(id => ({ student_id: id, full_name: rosterMap[id] || id })),
        topic1_title: values.topic1_title, topic1_detail: values.topic1_detail,
        topic2_title: values.topic2_title, topic2_detail: values.topic2_detail,
        topic3_title: values.topic3_title, topic3_detail: values.topic3_detail,
      })
      message.success('บันทึกข้อมูลกลุ่มแล้ว')
      await loadAll()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'บันทึกไม่สำเร็จ')
    } finally { setSaving1(false) }
  }

  const handleSubmit3 = async () => {
    const entries = profs.map(p => ({ prof_anonymous_code: p.anonymous_code, rank: ranks[p.anonymous_code] }))
    if (entries.some(e => !e.rank)) { message.error('กรุณาจัดอันดับให้ครบทุกคน'); return }
    const rankVals = entries.map(e => e.rank)
    if (new Set(rankVals).size !== rankVals.length) { message.error('อันดับห้ามซ้ำกัน'); return }
    setSaving3(true)
    try {
      await submitStudentForm3(entries as any)
      message.success('ส่งการจัดอันดับแล้ว')
      await loadAll()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'ส่งไม่สำเร็จ')
    } finally { setSaving3(false) }
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

  const isMember = me.has_group && !me.is_representative     // สมาชิกที่ไม่ใช่ตัวแทน → read-only
  const roundClosed = me.is_closed || me.matching_started    // รอบปิดรับแล้ว (ปิดเอง/เริ่ม matching)
  const form1Locked = me.codes_generated || isMember || roundClosed  // แก้ Form 1 ไม่ได้หลังสร้างรหัส/ปิดรอบ/ไม่ใช่ตัวแทน
  const form3Locked = me.matching_started || me.is_closed || isMember // แก้ Form 3 ไม่ได้หลังเริ่ม matching/ปิดรอบ/ไม่ใช่ตัวแทน

  const rosterOptions = roster.map(r => ({ value: r.student_id, label: `${r.student_id} — ${r.full_name || ''}` }))

  // ── ข้อ 1: ฟอร์ม 1 กรอกครบทุกช่องหรือยัง ──
  const members1 = (w1Members || []) as (string | undefined)[]
  const form1Complete =
    members1.length >= 2 && members1.every(Boolean) &&
    [w1t1t, w1t1d, w1t2t, w1t2d, w1t3t, w1t3d].every(v => !!(v && String(v).trim()))

  // ── ข้อ 1 + 2.1: ฟอร์ม 3 จัดอันดับครบและไม่ซ้ำหรือยัง ──
  const rankValues = profs.map(p => ranks[p.anonymous_code]).filter((v): v is number => v != null)
  const allRanked = profs.length > 0 && profs.every(p => ranks[p.anonymous_code] != null)
  const hasDupRanks = new Set(rankValues).size !== rankValues.length
  const form3Complete = allRanked && !hasDupRanks

  const rankColumns: ColumnsType<any> = [
    { title: 'อาจารย์ (นิรนาม)', dataIndex: 'anonymous_code', key: 'code', render: v => <Tag color="green">{v}</Tag> },
    { title: 'ความเชี่ยวชาญ', dataIndex: 'expertise', key: 'expertise', render: v => v || '—' },
    {
      title: 'อันดับที่ต้องการ', key: 'rank', width: 160,
      render: (_, r) => (
        <Select
          style={{ width: 120 }} placeholder="เลือกอันดับ" disabled={form3Locked}
          value={ranks[r.anonymous_code]}
          onChange={v => setRanks(prev => ({ ...prev, [r.anonymous_code]: v }))}
          options={profs.map((_, i) => ({ value: i + 1, label: `อันดับ ${i + 1}` }))}
        />
      ),
    },
  ]

  // ── ข้อ 2.2: ตารางอันดับแบบอ่านอย่างเดียว (สำหรับสมาชิกที่ไม่ใช่ตัวแทน) ──
  const readonlyRankColumns: ColumnsType<any> = [
    { title: 'อาจารย์ (นิรนาม)', dataIndex: 'anonymous_code', key: 'code', render: v => <Tag color="green">{v}</Tag> },
    { title: 'ความเชี่ยวชาญ', dataIndex: 'expertise', key: 'expertise', render: v => v || '—' },
    {
      title: 'อันดับที่กลุ่มเลือก', key: 'rank', width: 160,
      render: (_, r) => ranks[r.anonymous_code]
        ? <Tag color="blue">อันดับ {ranks[r.anonymous_code]}</Tag>
        : <Text type="secondary">—</Text>,
    },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 900 }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <FormOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>ฟอร์มของนักศึกษา</Title>
        </div>
        <Text type="secondary">
          {profile?.full_name} {profile?.student_id ? `(${profile.student_id})` : ''} · กรอกข้อมูลกลุ่ม (ฟอร์ม 1) และจัดอันดับอาจารย์ (ฟอร์ม 3)
        </Text>
      </div>

      {roundClosed ? (
        <Alert type="warning" showIcon icon={<LockOutlined />} style={{ marginBottom: 16 }}
          message={me.matching_started
            ? 'ปิดรับฟอร์มแล้ว — ระบบกำลังประมวลผลจับคู่ ไม่สามารถส่งหรือแก้ไขฟอร์มได้'
            : 'รอบนี้ปิดรับแล้ว — ไม่สามารถส่งหรือแก้ไขฟอร์มได้ หากต้องการแก้ไขกรุณาติดต่อผู้ดูแลระบบ'} />
      ) : (
        <Alert type="success" showIcon style={{ marginBottom: 16 }}
          message="เปิดรับฟอร์ม — คุณสามารถกรอกและแก้ไขข้อมูลได้" />
      )}

      {isMember && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message={`คุณเป็นสมาชิกของกลุ่ม ${me.group_anonymous_code || me.group?.group_id || ''}`}
          description={`ตัวแทนกลุ่มคือ "${me.representative_name || '—'}" — เฉพาะตัวแทนเท่านั้นที่กรอก/แก้ไขฟอร์มได้ คุณดูข้อมูลได้แบบอ่านอย่างเดียว`} />
      )}

      {/* ── Form 1 ── */}
      <Card
        title={<span>📋 ฟอร์ม 1 — ข้อมูลกลุ่มและหัวข้อที่สนใจ</span>}
        style={{ marginBottom: 24 }}
        extra={me.has_group ? <Tag color="success">บันทึกแล้ว</Tag> : <Tag>ยังไม่บันทึก</Tag>}
      >
        {isMember && me.group ? (
          <ReadOnlyGroup group={me.group} topics={me.topics} />
        ) : (
          <>
            {me.codes_generated && (
              <Alert type="warning" showIcon style={{ marginBottom: 16 }} icon={<LockOutlined />}
                message="รอบนี้สร้างรหัสนิรนามแล้ว — ไม่สามารถแก้ไขข้อมูลกลุ่มได้" />
            )}
            <Form form={form1} layout="vertical" onFinish={handleSubmit1} disabled={form1Locked}>
              <Text strong>สมาชิกกลุ่ม</Text>
              <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                เลือกเพื่อนร่วมกลุ่มจากรายชื่อนักศึกษาในหลักสูตร (ตัวคุณถูกเพิ่มเป็นตัวแทนอัตโนมัติ)
              </Paragraph>
              <Form.List name="members">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, idx) => (
                      <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                        <Form.Item {...field} name={field.name} rules={[{ required: true, message: 'เลือกสมาชิก' }]} style={{ marginBottom: 0 }}>
                          <Select
                            showSearch style={{ width: 360 }} placeholder={`สมาชิกคนที่ ${idx + 1}`}
                            options={rosterOptions} optionFilterProp="label"
                          />
                        </Form.Item>
                        {fields.length > 1 && <DeleteOutlined onClick={() => remove(field.name)} style={{ color: '#ff4d4f' }} />}
                      </Space>
                    ))}
                    {fields.length < 4 && (
                      <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                        เพิ่มสมาชิก
                      </Button>
                    )}
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>กลุ่มละ 2–4 คน</div>
                  </>
                )}
              </Form.List>

              <Divider />
              <Text strong>หัวข้อที่สนใจ (3 หัวข้อ)</Text>
              {[1, 2, 3].map(n => {
                const tLen = ((titleW[n - 1] as string) || '').length
                const dLen = ((detailW[n - 1] as string) || '').length
                return (
                  <Flex key={n} gap={8} align="flex-start" style={{ marginTop: 8 }}>
                    <div style={{ width: '40%' }}>
                      <Form.Item name={`topic${n}_title`} rules={[{ required: true, message: `กรอกหัวข้อที่ ${n}` }]} style={{ marginBottom: 0 }}>
                        <Input.TextArea placeholder={`หัวข้อที่ ${n}`} maxLength={150} autoSize={{ minRows: 1, maxRows: 4 }} />
                      </Form.Item>
                      <div style={{ textAlign: 'right', fontSize: 11, marginTop: 2, color: tLen >= 150 ? '#ff4d4f' : '#999' }}>{tLen}/150</div>
                    </div>
                    <div style={{ width: '60%' }}>
                      <Form.Item name={`topic${n}_detail`} rules={[{ required: true, message: `กรอกรายละเอียดหัวข้อที่ ${n}` }]} style={{ marginBottom: 0 }}>
                        <Input.TextArea placeholder={`รายละเอียดหัวข้อที่ ${n}`} maxLength={300} autoSize={{ minRows: 1, maxRows: 6 }} />
                      </Form.Item>
                      <div style={{ textAlign: 'right', fontSize: 11, marginTop: 2, color: dLen >= 300 ? '#ff4d4f' : '#999' }}>{dLen}/300</div>
                    </div>
                  </Flex>
                )
              })}

              <Button type="primary" htmlType="submit" loading={saving1} icon={<SaveOutlined />} style={{ marginTop: 8 }} disabled={form1Locked || !form1Complete}>
                {me.has_group ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลกลุ่ม'}
              </Button>
            </Form>
          </>
        )}
      </Card>

      {/* ── Form 3 ── */}
      <Card title={<span><OrderedListOutlined /> ฟอร์ม 3 — จัดอันดับอาจารย์</span>}
        extra={me.ranking_submitted ? <Tag color="success">บันทึกแล้ว</Tag> : <Tag>ยังไม่บันทึก</Tag>}>
        {me.matching_started && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} icon={<LockOutlined />}
            message="ปิดรับการแก้ไขแล้ว — ระบบเริ่มรัน Matching ไปแล้ว" />
        )}
        {!me.codes_generated ? (
          <Alert type="info" showIcon
            message="ยังไม่เปิดให้จัดอันดับ"
            description="รอให้แอดมินสร้างรหัสนิรนามก่อน จึงจะจัดอันดับอาจารย์ได้" />
        ) : !me.has_group ? (
          <Alert type="warning" showIcon message="กรุณาส่งข้อมูลกลุ่ม (ฟอร์ม 1) ก่อน" />
        ) : isMember ? (
          me.ranking_submitted ? (
            <>
              <Paragraph type="secondary">อันดับที่ตัวแทนกลุ่มจัดไว้ (คุณดูได้อย่างเดียว)</Paragraph>
              <Table dataSource={profs} columns={readonlyRankColumns} rowKey="anonymous_code" size="small" pagination={false} />
            </>
          ) : (
            <Alert type="info" showIcon message="ตัวแทนกลุ่มยังไม่ได้จัดอันดับอาจารย์ — กลับมาดูได้ภายหลัง" />
          )
        ) : (
          <>
            <Paragraph type="secondary">เลือกอันดับความต้องการให้อาจารย์แต่ละท่าน (อันดับ 1 = ต้องการมากที่สุด, ห้ามซ้ำ)</Paragraph>
            <Table dataSource={profs} columns={rankColumns} rowKey="anonymous_code" size="small" pagination={false} />
            {hasDupRanks && (
              <Alert type="error" showIcon style={{ marginTop: 12 }}
                message="มีอันดับซ้ำกัน — กรุณาเลือกอันดับไม่ให้ซ้ำก่อนส่ง" />
            )}
            <Button type="primary" onClick={handleSubmit3} loading={saving3} icon={<SaveOutlined />} style={{ marginTop: 16 }} disabled={form3Locked || !form3Complete}>
              {me.ranking_submitted ? 'บันทึกการแก้ไข' : 'ส่งการจัดอันดับ'}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}

function ReadOnlyGroup({ group, topics }: { group: any; topics: any[] }) {
  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="รหัสกลุ่ม">{group.anonymous_code || group.group_id || '—'}</Descriptions.Item>
      <Descriptions.Item label="ตัวแทนกลุ่ม">{group.representative || '—'}</Descriptions.Item>
      <Descriptions.Item label="สมาชิก">
        {(group.members || []).map((m: any, i: number) => (
          <div key={i}>{m.student_id} — {m.full_name || '—'}</div>
        ))}
      </Descriptions.Item>
      <Descriptions.Item label="หัวข้อที่สนใจ">
        {(topics || []).map((t: any, i: number) => (
          <div key={i}>• {typeof t === 'string' ? t : t.title}{t?.detail ? ` (${t.detail})` : ''}</div>
        ))}
      </Descriptions.Item>
    </Descriptions>
  )
}
