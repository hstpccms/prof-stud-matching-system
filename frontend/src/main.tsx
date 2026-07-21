import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import thTH from 'antd/locale/th_TH'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={thTH}
      theme={{
        token: {
          fontFamily: "'Kanit', 'Segoe UI', sans-serif",
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
