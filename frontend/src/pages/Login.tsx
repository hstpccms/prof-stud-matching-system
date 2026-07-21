import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form, Input, Button, Card, Typography, Space, App as AntApp,
} from 'antd'
import {
  UserOutlined, LockOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { login } from '../api/client'

const { Title, Text } = Typography

export default function LoginPage() {
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await login(values.username, values.password)
      localStorage.setItem('token', res.data.access_token)
      navigate('/')
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Username หรือ Password ไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
        variant="outlined"
      >
        {/* Logo + Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 16px rgba(22,119,255,0.35)',
            }}
          >
            <ThunderboltOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <Title level={3} style={{ marginBottom: 4 }}>
            Matching System
          </Title>
          <Text type="secondary">ระบบจับคู่อาจารย์ที่ปรึกษา</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'กรุณากรอก Username' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="admin"
              size="large"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'กรุณากรอก Password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </Form.Item>
        </Form>

        <Space style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            สำหรับแอดมินเท่านั้น
          </Text>
        </Space>
      </Card>
    </div>
  )
}
