import { useEffect, useState } from 'react'
import { Card, List, Button, Typography, Space, Tag } from 'antd'
import { DownloadOutlined, FileExcelOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { listSessions, listRuns, downloadUpload, downloadResult } from '../api/client'

const { Title, Text } = Typography

export default function Downloads() {
  const [sessions, setSessions] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])

  useEffect(() => {
    listSessions().then(r => setSessions(r.data))
    listRuns().then(r => setRuns(r.data.filter((run: any) => run.status === 'success')))
  }, [])

  return (
    <div style={{ padding: 32 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>ดาวน์โหลดไฟล์</Title>
        <Text type="secondary">ดาวน์โหลดไฟล์ข้อมูลดิบและผลลัพธ์ทุกรอบจากที่เดียว</Text>
      </div>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* Raw uploads */}
        <Card
          title={
            <Space>
              <FileExcelOutlined />
              ไฟล์ข้อมูลดิบ
              <Tag>{sessions.length} ไฟล์</Tag>
            </Space>
          }
        >
          {sessions.length === 0
            ? <Text type="secondary">ยังไม่มีไฟล์</Text>
            : (
              <List
                dataSource={sessions}
                renderItem={(s: any) => (
                  <List.Item
                    key={s.id}
                    actions={[
                      <Button
                        key="dl"
                        icon={<DownloadOutlined />}
                        href={downloadUpload(s.id)}
                        download
                      >
                        ดาวน์โหลด
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong>{s.filename || `upload_${s.id}.xlsx`}</Text>}
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
              <DownloadOutlined />
              ไฟล์ผลลัพธ์
              <Tag>{runs.length} รอบ</Tag>
            </Space>
          }
        >
          {runs.length === 0
            ? <Text type="secondary">ยังไม่มีผลลัพธ์</Text>
            : (
              <List
                dataSource={runs}
                renderItem={(r: any) => (
                  <List.Item
                    key={r.id}
                    actions={[
                      <Button
                        key="dl"
                        type="primary"
                        icon={<DownloadOutlined />}
                        href={downloadResult(r.id)}
                        download
                      >
                        ดาวน์โหลด
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>Run #{r.id}</Text>
                          <Tag color="success">{r.num_matched} กลุ่มที่จับคู่สำเร็จ</Tag>
                          {r.num_unmatched > 0 && (
                            <Tag color="error">{r.num_unmatched} ไม่ได้จับคู่</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space size={8}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(r.run_at).toLocaleString('th-TH')}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Seed: <Text code>{r.seed}</Text>
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
        </Card>
      </Space>

      <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 13 }}>
        ไฟล์ผลลัพธ์มี 4 ชีต: Final_Matching · Professor_Summary · Stats · TieBreak_Log
      </Text>
    </div>
  )
}
