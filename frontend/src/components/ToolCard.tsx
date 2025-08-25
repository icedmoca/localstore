import { useState, useEffect } from 'react'
import { Button, Card, Tag, Dialog, Spinner, Intent, ProgressBar } from '@blueprintjs/core'
import { Link } from 'wouter'
import api from '../api'
import type { Tool } from '../types'
import StatusBadge from './StatusBadge'

interface ToolCardProps {
  t: Tool
  onChange: () => void
  installProgress?: { progress: number, intent: string }
  setInstallProgress?: (progress: number | null, intent: string) => void
}

export default function ToolCard({ t, onChange, installProgress, setInstallProgress }: ToolCardProps) {
  const [busy, setBusy] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  
  // Use global progress state if available, otherwise local state
  const hasGlobalProgress = installProgress !== undefined && setInstallProgress !== undefined
  const [localInstallProgress, setLocalInstallProgress] = useState(0)
  const [localShowProgress, setLocalShowProgress] = useState(false)
  const [localProgressIntent, setLocalProgressIntent] = useState<Intent>(Intent.PRIMARY)
  
  const progress = hasGlobalProgress ? installProgress?.progress || 0 : localInstallProgress
  const showProgress = hasGlobalProgress ? !!installProgress : localShowProgress
  const progressIntent = hasGlobalProgress ? (installProgress?.intent || 'primary') as Intent : localProgressIntent

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

  async function doAction(f: ()=>Promise<any>, okMsg: string, isInstall = false) {
    try {
      setBusy(true)
      if (isInstall) {
        // Use global progress if available
        if (hasGlobalProgress && setInstallProgress) {
          setInstallProgress(0, 'primary')
        } else {
          setLocalShowProgress(true)
          setLocalProgressIntent(Intent.PRIMARY)
          setLocalInstallProgress(0)
        }
        
        // Simulate installation progress
        let currentProgress = 0
        const progressInterval = setInterval(() => {
          currentProgress += Math.random() * 15
          if (currentProgress >= 90) {
            clearInterval(progressInterval)
            currentProgress = 90
          }
          
          if (hasGlobalProgress && setInstallProgress) {
            setInstallProgress(currentProgress, 'primary')
          } else {
            setLocalInstallProgress(currentProgress)
          }
        }, 300)
        
        await f()
        
        clearInterval(progressInterval)
        
        if (hasGlobalProgress && setInstallProgress) {
          setInstallProgress(100, 'success')
        } else {
          setLocalInstallProgress(100)
          setLocalProgressIntent(Intent.SUCCESS)
          
          // Hide local progress bar after 3 seconds of success
          setTimeout(() => {
            setLocalShowProgress(false)
            setLocalInstallProgress(0)
          }, 3000)
        }
      } else {
        await f()
      }
      onChange()
      ;(window as any).__toast?.(okMsg)
    } catch (e:any) {
      if (isInstall) {
        if (hasGlobalProgress && setInstallProgress) {
          setInstallProgress(null, 'primary')
        } else {
          setLocalShowProgress(false)
          setLocalInstallProgress(0)
        }
      }
      ;(window as any).__toast?.(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  // Check if tool is installed (has a status)
  const isInstalled = t.status !== undefined

  return (
    <>
      <Card className="bp5-elevation-0" style={{ margin: '10px 0', overflow: 'hidden' }}>
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
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {t.port && (
              <Button 
                size="small" 
                icon="share" 
                onClick={() => window.open(`/api/apps/${t.id}/`, '_blank')}
                text="Open"
              />
            )}
            {t.status === 'running' && (
              <Button 
                size="small" 
                icon="document" 
                onClick={() => setShowLogs(true)}
                text="Logs"
              />
            )}
            {t.status === 'running' && t.port && (
              <Tag minimal>Port: {t.port}</Tag>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isInstalled && (
              <>
                <Link href={`/edit/${t.id}`}>
                  <Button 
                    size="small" 
                    icon="edit"
                    text="Edit"
                  />
                </Link>
              </>
            )}
            
            {!isInstalled ? (
              <Button 
                size="small" 
                intent="primary" 
                icon="download" 
                loading={busy}
                onClick={() => doAction(() => api.install(t.id), 'Installed', true)}
                text="Install"
              />
            ) : (
              <Button 
                size="small" 
                intent="danger" 
                icon="trash" 
                loading={busy}
                onClick={() => doAction(() => api.uninstall(t.id), 'Uninstalled')}
                text="Delete"
              />
            )}
            
            {isInstalled && t.status !== 'running' && (
              <Button 
                size="small" 
                intent="success" 
                icon="play" 
                loading={busy}
                onClick={() => doAction(() => api.start(t.id), 'Started')}
                text="Start"
              />
            )}
            
            {t.status === 'running' && (
              <Button 
                size="small" 
                icon="stop" 
                loading={busy}
                onClick={() => doAction(() => api.stop(t.id), 'Stopped')}
                text="Stop"
              />
            )}
          </div>
        </div>
        
        {showProgress && (
          <ProgressBar
            intent={progressIntent}
            value={installProgress / 100}
            animate={progressIntent === Intent.PRIMARY}
            stripes={progressIntent === Intent.PRIMARY}
            style={{ marginTop: 12 }}
          />
        )}
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
