import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Button,
  Breadcrumbs,
  NonIdealState,
  Spinner,
  Navbar,
  NavbarGroup,
  NavbarHeading,
  NavbarDivider,
  Alignment,
  ButtonGroup,
  Tag,
  Callout,
  Intent,
  Card,
  Tooltip,
  InputGroup,
  Drawer,
  Position
} from '@blueprintjs/core'
import api from '../api'
import type { Tool } from '../types'

export default function Preview() {
  const params = useParams()
  const navigate = useNavigate()
  const toolId = params.toolId || ''
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [toolStatus, setToolStatus] = useState<'stopped' | 'running' | 'starting' | 'stopping'>('stopped')
  const [toolPort, setToolPort] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  useEffect(() => {
    if (!toolId) return
    loadTool()
  }, [toolId])

  useEffect(() => {
    if (toolStatus === 'running' && toolPort) {
      setPreviewUrl(`/api/apps/${toolId}`)
    } else {
      setPreviewUrl('')
    }
  }, [toolStatus, toolPort, toolId])

  // Set up log streaming when tool is running
  useEffect(() => {
    if (toolStatus === 'running' && toolId) {
      const es = new EventSource(`/api/tools/${toolId}/logs`)
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.event === 'log') {
            setLogs(prev => [...prev, data.line])
          } else if (data.event === 'exit') {
            setToolStatus('stopped')
            setToolPort(null)
            es.close()
          }
        } catch (e) {
          console.error('Failed to parse log event:', e)
        }
      }
      
      es.onerror = () => {
        es.close()
        setTimeout(() => {
          if (toolStatus === 'running') {
            // Retry connection
            loadTool()
          }
        }, 1000)
      }
      
      setEventSource(es)
      
      return () => {
        es.close()
        setEventSource(null)
      }
    }
  }, [toolStatus, toolId])

  async function loadTool() {
    try {
      setLoading(true)
      const tools = await api.tools()
      const found = tools.find(t => t.id === toolId)
      if (found) {
        setTool(found)
        setToolStatus(found.status === 'running' ? 'running' : 'stopped')
        setToolPort(found.port || null)
      } else {
        setError('Tool not found')
      }
    } catch (err: any) {
      setError(`Failed to load tool: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function startTool() {
    if (!tool) return
    
    setToolStatus('starting')
    setLogs([])
    
    try {
      const result = await api.start(tool.id)
      setToolStatus('running')
      setToolPort(result.port)
    } catch (err: any) {
      setToolStatus('stopped')
      setError(`Failed to start tool: ${err.message}`)
    }
  }

  async function stopTool() {
    if (!tool) return
    
    setToolStatus('stopping')
    
    try {
      await api.stop(tool.id)
      setToolStatus('stopped')
      setToolPort(null)
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
      }
    } catch (err: any) {
      setToolStatus('running')
      setError(`Failed to stop tool: ${err.message}`)
    }
  }

  async function restartTool() {
    if (!tool) return
    
    setToolStatus('stopping')
    setLogs([])
    
    try {
      // Stop first
      await api.stop(tool.id)
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Start again
      const result = await api.start(tool.id)
      setToolStatus('running')
      setToolPort(result.port)
    } catch (err: any) {
      setToolStatus('stopped')
      setError(`Failed to restart tool: ${err.message}`)
    }
  }

  const refreshPreview = () => {
    if (iframeRef.current) {
      const iframe = iframeRef.current
      const currentUrl = iframe.src
      iframe.src = ''
      iframe.src = currentUrl
    }
  }

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  if (!toolId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: 20 
      }}>
        <NonIdealState
          icon="error"
          title="No Tool Selected"
          description="Please select a tool to preview"
          action={<Link to="/dashboard"><Button intent="primary">Back to Dashboard</Button></Link>}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <Spinner size={50} />
      </div>
    )
  }

  if (error || !tool) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: 20 
      }}>
        <NonIdealState
          icon="error"
          title="Tool Not Found"
          description={error || `Tool with ID "${toolId}" was not found`}
          action={
            <div>
              <Button 
                onClick={() => navigate(-1)} 
                style={{ marginRight: 8 }}
              >
                Go Back
              </Button>
              <Link to="/dashboard">
                <Button intent="primary">Back to Dashboard</Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar>
        <NavbarGroup align={Alignment.LEFT}>
          <NavbarHeading>Tool Preview</NavbarHeading>
          <NavbarDivider />
          <Breadcrumbs
            items={[
              { 
                text: 'Dashboard', 
                onClick: () => navigate('/dashboard')
              },
              { 
                text: tool.name, 
                onClick: () => navigate(`/tools/${toolId}/edit`)
              },
              { 
                text: 'Preview', 
                current: true 
              }
            ]}
          />
        </NavbarGroup>
        
        <NavbarGroup align={Alignment.RIGHT}>
          <Tag 
            intent={toolStatus === 'running' ? 'success' : 'danger'}
            icon={(toolStatus === 'running' ? 'play' : 'stop') as any}
          >
            {toolStatus.toUpperCase()}
          </Tag>
          
          {toolPort && (
            <Tag intent="primary">Port {toolPort}</Tag>
          )}
          
          <NavbarDivider />
          
          <ButtonGroup>
            {toolStatus === 'stopped' && (
              <Tooltip content="Start Tool">
                <Button
                  icon="play"
                  intent="success"
                  onClick={startTool}
                  loading={['starting', 'stopping'].includes(toolStatus)}
                />
              </Tooltip>
            )}
            
            {toolStatus === 'running' && (
              <>
                <Tooltip content="Restart Tool">
                  <Button
                    icon="refresh"
                    intent="warning"
                    onClick={restartTool}
                  />
                </Tooltip>
                
                <Tooltip content="Stop Tool">
                  <Button
                    icon="stop"
                    intent="danger"
                    onClick={stopTool}
                    loading={['starting', 'stopping'].includes(toolStatus)}
                  />
                </Tooltip>
              </>
            )}
          </ButtonGroup>
          
          <NavbarDivider />
          
          <ButtonGroup>
            <Tooltip content="Show Logs">
              <Button
                icon="console"
                onClick={() => setIsLogsOpen(true)}
              />
            </Tooltip>
            
            {previewUrl && (
              <>
                <Tooltip content="Refresh Preview">
                  <Button
                    icon="refresh"
                    onClick={refreshPreview}
                  />
                </Tooltip>
                
                <Tooltip content="Open in New Tab">
                  <Button
                    icon="share"
                    onClick={openInNewTab}
                  />
                </Tooltip>
              </>
            )}
            
            <Tooltip content="Back to Editor">
              <Button
                icon="code"
                text="Editor"
                onClick={() => navigate(`/tools/${toolId}/edit`)}
              />
            </Tooltip>
          </ButtonGroup>
        </NavbarGroup>
      </Navbar>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Callout intent="danger" style={{ margin: 16 }}>
            {error}
            <Button
              icon="cross"
              minimal
              small
              onClick={() => setError('')}
              style={{ float: 'right' }}
            />
          </Callout>
        )}

        {toolStatus === 'stopped' ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <NonIdealState
              icon="play"
              title="Tool Not Running"
              description="Start the tool to see the preview"
              action={
                <Button
                  icon="play"
                  intent="success"
                  large
                  onClick={startTool}
                  loading={['starting', 'stopping'].includes(toolStatus)}
                >
                  Start {tool.name}
                </Button>
              }
            />
          </div>
        ) : toolStatus === 'starting' ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <NonIdealState
              icon={<Spinner size={50} />}
              title="Starting Tool"
              description="Please wait while the tool starts up..."
            />
          </div>
        ) : previewUrl ? (
          <div style={{ flex: 1, position: 'relative' }}>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'white'
              }}
              title={`${tool.name} Preview`}
            />
          </div>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <NonIdealState
              icon={"error" as any}
              title="Preview Unavailable"
              description="The tool is running but preview is not available"
              action={
                <Button
                  onClick={() => window.open(`/api/apps/${toolId}`, '_blank')}
                >
                  Open in New Tab
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* Logs Drawer */}
      <Drawer
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        title="Tool Logs"
        position={Position.BOTTOM}
        size="50%"
      >
        <div style={{ padding: 16 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16 
          }}>
            <h4>Live Logs</h4>
            <ButtonGroup>
              <Button
                icon="trash"
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
              >
                Clear
              </Button>
              <Button
                icon="download"
                onClick={() => {
                  const logText = logs.join('\n')
                  const blob = new Blob([logText], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${tool.id}-logs.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={logs.length === 0}
              >
                Download
              </Button>
            </ButtonGroup>
          </div>
          
          <Card style={{ 
            height: 400, 
            overflow: 'auto', 
            backgroundColor: 'var(--bp5-dark-gray1)',
            fontFamily: 'monospace',
            fontSize: 12
          }}>
            {logs.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: 'var(--bp5-text-color-muted)'
              }}>
                No logs yet...
              </div>
            ) : (
              <pre style={{ margin: 0, padding: 16, whiteSpace: 'pre-wrap' }}>
                {logs.join('\n')}
              </pre>
            )}
          </Card>
        </div>
      </Drawer>
    </div>
  )
}
