import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, theme } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
  DownloadOutlined,
  HistoryOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const { Sider, Content } = Layout
const { Text } = Typography

const NAV_ITEMS = [
  { key: '/', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/data', label: 'จัดการข้อมูล', icon: <DatabaseOutlined /> },
  { key: '/run', label: 'รัน Matching', icon: <PlayCircleOutlined /> },
  { key: '/results', label: 'ผลลัพธ์', icon: <BarChartOutlined /> },
  { key: '/downloads', label: 'ดาวน์โหลด', icon: <DownloadOutlined /> },
  { key: '/history', label: 'ประวัติ', icon: <HistoryOutlined /> },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const menuItems = [
    ...NAV_ITEMS.map(({ key, label, icon }) => ({ key, label, icon })),
    { type: 'divider' as const },
    {
      key: '__logout',
      label: 'ออกจากระบบ',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '__logout') {
      localStorage.removeItem('token')
      navigate('/login')
    } else {
      navigate(key)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ThunderboltOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <Text strong style={{ display: 'block', fontSize: 13, lineHeight: '1.2' }}>
              Matching System
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Admin Dashboard
            </Text>
          </div>
        </div>

        {/* Navigation */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none', marginTop: 8, fontFamily: "'Kanit', sans-serif" }}
        />
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Content
          style={{
            minHeight: '100vh',
            background: token.colorBgLayout,
            overflow: 'auto',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
