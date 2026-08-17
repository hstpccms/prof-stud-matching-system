                                    — {step.value}
                                  </Text>
                                )}
                                <br />
                                <Text
                                  type={step.done ? 'secondary' : isWarn ? 'warning' : 'secondary'}
                                  style={{ fontSize: 12 }}
                                >
                                  {step.description}
                                </Text>
                                {/* Incomplete code tags */}
                                {!step.done && step.key !== 'algorithm' && step.key !== 'professors' && step.incomplete.length > 0 && (
                                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {incomplete.map(code => (
                                      <Tag key={code} color="orange" style={{ fontSize: 11, margin: 0 }}>{code}</Tag>
                                    ))}
                                    {more > 0 && (
                                      <Tag color="default" style={{ fontSize: 11, margin: 0 }}>+{more} รายการ</Tag>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Follow-up button */}
                              {!step.done && (
                                <Button
                                  size="small"
                                  type="link"
                                  icon={<ArrowRightOutlined />}
                                  onClick={() => navigate(step.trackPath)}
                                  style={{ fontSize: 12, flexShrink: 0, color: '#fa8c16', paddingRight: 0 }}
                                >
                                  ติดตาม
                                </Button>
                              )}
                            </Flex>
                          </div>
                        </Flex>
                        {!isLast && <Divider style={{ margin: 0 }} />}
                      </div>
                    )
                  })}
                </Flex>
              </Card>
            </Col>

            {/* Right column */}
            <Col xs={24} lg={8}>
              <Flex vertical gap={12} style={{ width: '100%' }}>
                {/* Quick actions */}
                <Card title="การดำเนินการ" size="small" style={{ borderRadius: 10 }}>
                  <Flex vertical style={{ width: '100%' }} gap={8}>
                    {[
                      { label: 'อัปโหลด / จัดการข้อมูล', sub: 'เพิ่มหรืออัปเดต Excel', path: '/data' },
                      { label: 'รัน Matching', sub: 'เริ่มกระบวนการจับคู่', path: '/run' },
                      ...(run?.status === 'success'
                        ? [
                            { label: 'ดูผลลัพธ์', sub: 'ตาราง, สถิติ, TieBreak', path: '/results' },
                            { label: 'ดาวน์โหลดไฟล์', sub: 'Excel ผลลัพธ์', path: '/downloads' },
                          ]
                        : []),
                    ].map(({ label, sub, path }) => (
                      <Button
                        key={path}
                        block
                        onClick={() => navigate(path)}
                        icon={<ArrowRightOutlined />}
                        style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{label}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>{sub}</div>
                        </div>
                      </Button>
                    ))}
                  </Flex>
                </Card>

                {/* Latest run details */}
                {run && (
                  <Card size="small" style={{ borderRadius: 10 }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                      การรันล่าสุด
                    </Text>
                    <Flex gap={8} align="center" style={{ marginBottom: 8 }}>
                      {run.status === 'success' && <Tag color="success">สำเร็จ</Tag>}
                      {run.status === 'running' && <Tag color="processing">กำลังรัน</Tag>}
                      {run.status === 'failed' && <Tag color="error">ล้มเหลว</Tag>}
                      <Text style={{ fontSize: 12 }}>{formatDateFull(run.run_at)}</Text>
                    </Flex>
                    <Flex gap={20} align="center">
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Seed</Text>
                        <Text strong style={{ fontSize: 13 }}>{run.seed}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>โหมด</Text>
                        <Text strong style={{ fontSize: 12 }}>{MODE_LABELS[run.mode] || run.mode}</Text>
                      </div>
                      {run.status === 'success' && (
                        <div style={{ marginLeft: 'auto' }}>
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, fontSize: 12 }}
                            onClick={() => navigate('/results')}
                          >
                            ดูผล →
                          </Button>
                        </div>
                      )}
                    </Flex>
                  </Card>
                )}

                {/* Recent run history */}
                {recentRuns.length > 0 && (
                  <Card
                    size="small"
                    style={{ borderRadius: 10 }}
                    title={
                      <Space>
                        <HistoryOutlined />
                        <span style={{ fontSize: 13 }}>ประวัติการรัน 3 ครั้งล่าสุด</span>
                      </Space>
                    }
                  >
                    <Flex vertical gap={0}>
                      {recentRuns.map((r, idx) => {
                        const isLast = idx === recentRuns.length - 1
                        const ratio = r.num_groups > 0 ? r.num_matched / r.num_groups : 0
                        const ratioColor =
                          r.status !== 'success' ? '#8c8c8c'
                          : ratio >= 1 ? '#52c41a'
                          : ratio >= 0.8 ? '#fa8c16'
                          : '#ff4d4f'

                        return (
                          <div key={r.id}>
                            <Tooltip title={`Seed: ${r.seed} | คลิกเพื่อดูประวัติ`}>
                              <div
                                onClick={() => navigate('/history')}
                                style={{ cursor: 'pointer', padding: '8px 0', borderRadius: 6, transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Flex justify="space-between" align="center">
                                  <div>
                                    <Text style={{ fontSize: 12 }}>{formatDateShort(r.run_at)}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      {MODE_LABELS[r.mode] || r.mode}
                                    </Text>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    {r.status === 'success' ? (
                                      <Text strong style={{ fontSize: 13, color: ratioColor }}>
                                        {r.num_matched} / {r.num_groups}
                                      </Text>
                                    ) : (
                                      <Tag
                                        color={r.status === 'running' ? 'processing' : 'error'}
                                        style={{ fontSize: 11 }}
                                      >
                                        {r.status === 'running' ? 'กำลังรัน' : 'ล้มเหลว'}
                                      </Tag>
                                    )}
                                  </div>
                                </Flex>
                              </div>
                            </Tooltip>
                            {!isLast && <Divider style={{ margin: '2px 0' }} />}
                          </div>
                        )
                      })}
                    </Flex>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, fontSize: 12, marginTop: 6 }}
                      onClick={() => navigate('/history')}
                    >
                      ดูประวัติทั้งหมด →
                    </Button>
                  </Card>
                )}
              </Flex>
            </Col>
          </Row>
