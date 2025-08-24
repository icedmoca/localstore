import { useState, useEffect } from 'react'
import { Button, Card, Tag, Dialog, Spinner, Intent } from '@blueprintjs/core'
import { Link } from 'wouter'
import api from '../api'
import type { Tool } from '../types'
import StatusBadge from './StatusBadge'

export default function ToolCard({ t, onChange }: { t: Tool; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])

  useEffect(() => {
    if (!showLogs || t.status !== 'running') return
    const es = new EventSource(`/api/tools/${t.id}/logs`)
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.line) setLogLines(l => [...l, d.line])
      } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [showLogs, t.status, t.id])

  async function doAction(f: ()=>Promise<any>, okMsg: string) {
    try {
      setBusy(true)
      await f()
      onChange()
      ;(window as any).__toast?.(okMsg)
    } catch (e:any) {
      ;(window as any).__toast?.(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  // Check if tool is installed (has a status)
  const isInstalled = t.status !== undefined

  return (
    <>
      <Card className="bp5-elevation-0" style={{ margin: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🧩</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
              <div style={{ color: 'var(--bp5-text-color-muted)', fontSize: 13 }}>{t.id}</div>
            </div>
          </div>
          <StatusBadge status={t.status} />
        </div>
        
        {t.description && (
          <div style={{ color: 'var(--bp5-text-color-muted)', fontSize: 14, marginBottom: 15 }}>
            {t.description}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {t.port && (
              <Button 
                small 
                icon="share" 
                onClick={() => window.open(`/api/apps/${t.id}/`, '_blank')}
              >
                Open
              </Button>
            )}
            {t.status === 'running' && (
              <Button small icon="document" onClick={() => setShowLogs(true)}>
                Logs
              </Button>
            )}
            {t.status === 'running' && t.port && (
              <Tag minimal>Port: {t.port}</Tag>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {isInstalled && (
              <Link href={`/dev/${t.id}`}>
                <Button small icon="code">
                  Dev
                </Button>
              </Link>
            )}
            
            {!isInstalled ? (
              <Button 
                small 
                intent="primary" 
                icon="download" 
                loading={busy}
                onClick={() => doAction(() => api.install(t.id), 'Installed')}
              >
                Install
              </Button>
            ) : (
              <Button 
                small 
                intent="danger" 
                icon="trash" 
                loading={busy}
                onClick={() => doAction(() => api.uninstall(t.id), 'Uninstalled')}
              >
                Delete
              </Button>
            )}
            
            {isInstalled && t.status !== 'running' && (
              <Button 
                small 
                intent="success" 
                icon="play" 
                loading={busy}
                onClick={() => doAction(() => api.start(t.id), 'Started')}
              >
                Start
              </Button>
            )}
            
            {t.status === 'running' && (
              <Button 
                small 
                icon="stop" 
                loading={busy}
                onClick={() => doAction(() => api.stop(t.id), 'Stopped')}
              >
                Stop
              </Button>
            )}
          </div>
        </div>
      </Card>
      
      <Dialog
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
        title={`Logs for ${t.name}`}
        style={{ width: '80vw', maxWidth: 800 }}
      >
        <div className="bp5-dialog-body">
          <pre style={{ 
            background: 'var(--bp5-dark-gray5)', 
            padding: 15, 
            borderRadius: 5, 
            fontSize: 12, 
            maxHeight: 400, 
            overflow: 'auto' 
          }}>
            {logLines.join('\n')}
          </pre>
        </div>
        <div className="bp5-dialog-footer">
          <div className="bp5-dialog-footer-actions">
            <Button onClick={() => setShowLogs(false)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
