import { useEffect, useMemo, useState } from 'preact/hooks'
import Editor from '../components/Editor'

async function j(url:string, init?:RequestInit){
  const r = await fetch(url, init); if(!r.ok) throw new Error(await r.text()); return r.json()
}

export default function DevMode({ params }: { params: { id: string } }){
  const toolId = params.id
  const [files, setFiles] = useState<{path:string}[]|null>(null)
  const [current, setCurrent] = useState<string>('app.py')
  const [content, setContent] = useState<string>('')
  const [dirty, setDirty] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  async function fork(){ await j(`/api/dev/${toolId}/fork`, {method:'POST'}); await loadFiles() }
  async function loadFiles(){ const f = await j(`/api/dev/${toolId}/files`); setFiles(f) }
  async function openFile(p:string){ const f = await j(`/api/dev/${toolId}/file?path=${encodeURIComponent(p)}`); setCurrent(p); setContent(f.content); setDirty(false) }
  async function save(){ await j(`/api/dev/${toolId}/file`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({path: current, content})}); setDirty(false) }

  async function start(){ await j(`/api/dev/${toolId}/run`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'start'})}); setRunning(true); tail() }
  async function stop(){ await j(`/api/dev/${toolId}/run`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'stop'})}); setRunning(false) }

  function tail(){
    const es = new EventSource(`/api/dev/${toolId}/logs`)
    es.onmessage = (e)=>{ try{ const d = JSON.parse(e.data); if(d.line) setLogs(l=>[...l, d.line]) }catch{} }
    es.onerror = ()=> es.close()
  }

  async function askChat(){
    const msg = prompt('Describe the change you want:') || ''
    const r = await j(`/api/dev/${toolId}/chat`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message: msg})})
    if(r.patch){
      const ok = confirm('Apply proposed patch?')
      if(ok){ await j(`/api/dev/${toolId}/patch`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({patch: r.patch})}); await loadFiles(); if(current) await openFile(current) }
    }
  }

  useEffect(()=>{ fork().catch(()=>{}).then(()=>loadFiles()) }, [])
  useEffect(()=>{ if(files && files.length && current) openFile(current) }, [files])

  return (
    <div class="container" style={{paddingTop:16, display:'grid', gridTemplateColumns:'260px 1fr 360px', gap:12}}>
      {/* Files */}
      <div class="card" style={{height:'70vh', overflow:'auto'}}>
        <div style={{fontWeight:700, marginBottom:8}}>Files</div>
        {!files && <div class="kv">—</div>}
        {files && files.map(f => (
          <div key={f.path} style={{padding:'6px 8px', borderRadius:8, cursor:'pointer', background: f.path===current? 'var(--border)':'transparent'}} onClick={()=>openFile(f.path)}>{f.path}</div>
        ))}
      </div>

      {/* Editor */}
      <div class="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div style={{fontWeight:700}}>{current || '—'} {dirty? '*':''}</div>
          <div class="row">
            <button class="btn" onClick={save} disabled={!dirty}>Save</button>
            {!running && <button class="btn primary" onClick={start}>Start</button>}
            {running && <button class="btn" onClick={stop}>Stop</button>}
            <button class="btn" onClick={askChat}>Chat → Patch</button>
          </div>
        </div>
        <Editor value={content} onChange={(v)=>{ setContent(v); setDirty(true) }} />
      </div>

      {/* Logs */}
      <div class="card" style={{height:'70vh', overflow:'auto'}}>
        <div style={{fontWeight:700, marginBottom:8}}>Logs</div>
        <div style={{whiteSpace:'pre-wrap', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize:12}}>
          {logs.map((l, i)=>(<div key={i}>{l}</div>))}
        </div>
      </div>
    </div>
  )
}
