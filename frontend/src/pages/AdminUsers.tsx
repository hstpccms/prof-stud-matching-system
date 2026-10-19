import { useEffect, useState } from 'react'
import {
  Card, Typography, Form, Input, Select, Button, Table, Tag, Space,
  Popconfirm, App as AntApp, Modal,
} from 'antd'
import { UserAddOutlined, DeleteOutlined, KeyOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listUsers, createUser, deleteUser, resetUserPassword } from '../api/client'
import { PROGRAMS } from '../constants'

const { Title, Text } = Typography

export default function AdminUsers() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [resetFor, setResetFor] = useState<any>(null)
  const [newPw, setNewPw] = useState('')

  const role = Form.useWatch('role', form)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await listUsers()
      setUsers(res.data)
    } catch { message.error('โหลดรายชื่อผู้ใช้ไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (values: any) => {
    setCreating(true)
    try {
      await createUser({
        username: values.username.trim(),
        password: values.password,
        role: values.role,
        full_name: values.full_name,
        student_id: values.role === 'student' ? values.student_id : undefined,
        program: values.program,
      })
      message.success(`สร้างบัญชี ${values.username} สำเร็จ`)
      form.resetFields()
      form.setFieldsValue({ role: 'student', program: PROGRAMS[0] })
      await fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'สร้างบัญชีไม่สำเร็จ')
    } finally { setCreating(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id)
      message.success('ลบบัญชีแล้ว')
      await fetchUsers()
    } catch (err: any) { message.error(err.response?.data?.detail || 'ลบไม่สำเร็จ') }
  }

  const handleReset = async () => {
    if (!resetFor || !newPw) return
    try {
      await resetUserPassword(resetFor.id, newPw)
      message.success(`รีเซ็ตรหัสผ่านของ ${resetFor.username} แล้ว`)
      setResetFor(null); setNewPw('')
    } catch (err: any) { message.error(err.response?.data?.detail || 'รีเซ็ตไม่สำเร็จ') }
  }

  const columns: ColumnsType<any> = [
    { title: 'Username', dataIndex: 'username', key: 'username', render: v => <Text strong>{v}</Text> },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (v: string) => <Tag color={v === 'student' ? 'blue' : 'green'}>{v === 'student' ? 'นักศึกษา' : 'อาจารย์'}</Tag>,
      filters: [{ text: 'นักศึกษา', value: 'student' }, { text: 'อาจารย์', value: 'professor' }],
      onFilter: (val, r) => r.role === val,
    },
    { title: 'ชื่อ-นามสกุล', dataIndex: 'full_name', key: 'full_name', render: v => v || '—' },
    { title: 'รหัสนักศึกษา', dataIndex: 'student_id', key: 'student_id', render: v => v || '—' },
    { title: 'หลักสูตร', dataIndex: 'program', key: 'program', render: v => v || '—' },
    {
      title: 'จัดการ', key: 'actions', width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<KeyOutlined />} onClick={() => setResetFor(r)}>รหัสผ่าน</Button>
          <Popconfirm title="ลบบัญชีนี้?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <TeamOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>จัดการบัญชีผู้ใช้</Title>
        </div>
        <Text type="secondary">สร้างบัญชีนักศึกษาและอาจารย์ล่วงหน้า เพื่อให้เข้ามากรอกฟอร์มในเว็บ</Text>
      </div>

      <Card style={{ marginBottom: 16 }} title={<span><UserAddOutlined /> เพิ่มบัญชีใหม่</span>}>
        <Form
          form={form} layout="inline"
          initialValues={{ role: 'student', program: PROGRAMS[0] }}
          onFinish={handleCreate}
          style={{ rowGap: 12 }}
        >
          <Form.Item name="role" rules={[{ required: true }]}>
            <Select style={{ width: 130 }} options={[
              { value: 'student', label: 'นักศึกษา' },
              { value: 'professor', label: 'อาจารย์' },
            ]} />
          </Form.Item>
          <Form.Item name="username" rules={[{ required: true, message: 'กรอก username' }]}>
            <Input placeholder="username" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'กรอกรหัสผ่าน' }]}>
            <Input.Password placeholder="password" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="full_name">
            <Input placeholder="ชื่อ-นามสกุล" style={{ width: 180 }} />
          </Form.Item>
          {role === 'student' && (
            <Form.Item name="student_id">
              <Input placeholder="รหัสนักศึกษา" style={{ width: 140 }} />
            </Form.Item>
          )}
          <Form.Item name="program" rules={[{ required: true }]}>
            <Select style={{ width: 220 }} options={PROGRAMS.map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creating} icon={<UserAddOutlined />}>
              สร้างบัญชี
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={`รายชื่อบัญชีทั้งหมด (${users.length})`}>
        <Table
          dataSource={users} columns={columns} rowKey="id"
          loading={loading} size="small" pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        open={!!resetFor}
        title={`รีเซ็ตรหัสผ่าน: ${resetFor?.username || ''}`}
        onOk={handleReset}
        onCancel={() => { setResetFor(null); setNewPw('') }}
        okText="รีเซ็ต" cancelText="ยกเลิก"
        okButtonProps={{ disabled: !newPw }}
      >
        <Input.Password
          placeholder="รหัสผ่านใหม่"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
        />
      </Modal>
    </div>
  )
}
