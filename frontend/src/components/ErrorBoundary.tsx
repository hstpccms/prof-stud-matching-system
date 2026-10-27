import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Result, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    localStorage.clear()
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24, background: '#f5f5f5' }}>
          <Result
            status="error"
            title="เกิดข้อผิดพลาดในการแสดงผล"
            subTitle={this.state.error?.message || 'ระบบพบข้อผิดพลาด กรุณารีเฟรชหรือล้างแคชเพื่อเข้าสู่ระบบใหม่'}
            extra={[
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                โหลดหน้านี้ใหม่
              </Button>,
              <Button key="clear" onClick={this.handleReset}>
                ล้างแคชและเข้าสู่ระบบใหม่
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}
export default ErrorBoundary
