import api, { Tool } from '../api'
import { useState } from 'preact/hooks'
import StatusBadge from './StatusBadge'

export default function ToolCard({ t, onChange }: { t: Tool; onChange: () => void }) {
  const [busy, setBusy] = useState(false)

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
    <div class="card">
      <div class="row" style={{justifyContent:'space-between'}}>
        <div class="row">
          <div style={{fontSize:22}}>🧩</div>
          <div>
            <div style={{fontWeight:700}}>{t.name}</div>
            <div class="kv">{t.id}</div>
          </div>
        </div>
        <StatusBadge status={t.status}/>
      </div>
      
      {t.description ? <div style={{color:'var(--muted)', fontSize:14}}>{t.description}</div> : null}
      
      <div class="row" style={{justifyContent:'space-between'}}>
        <div class="row" style={{gap:6}}>
          {t.port ? <a href={`/api/apps/${t.id}/`} target="_blank" rel="noreferrer" class="btn">Open</a> : null}
          {t.status === 'running' && <span class="kv">Port: {t.port}</span>}
        </div>
        
        <div class="row">
          {isInstalled && (
            <a class="btn" href={`/dev/${t.id}`}>Dev</a>
          )}
          
          {!isInstalled ? (
            <button disabled={busy} class="btn" onClick={() => doAction(()=>api.install(t.id), 'Installed')}>
              Install
            </button>
          ) : (
            <button disabled={busy} class="btn" onClick={() => doAction(()=>api.uninstall(t.id), 'Uninstalled')}>
              Delete
            </button>
          )}
          
          {isInstalled && t.status !== 'running' && (
            <button disabled={busy} class="btn primary" onClick={() => doAction(()=>api.start(t.id), 'Started')}>
              Start
            </button>
          )}
          
          {t.status === 'running' && (
            <button disabled={busy} class="btn" onClick={() => doAction(()=>api.stop(t.id), 'Stopped')}>
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
