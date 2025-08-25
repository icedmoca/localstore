import { useState, useEffect } from 'react'
import { Link, useRoute } from 'wouter'
import { 
  Button, 
  Card, 
  FormGroup, 
  InputGroup, 
  TextArea,
  Switch,
  NonIdealState,
  Spinner,
  Callout,
  Tabs,
  Tab
} from '@blueprintjs/core'
import Editor from '../components/Editor'
import api from '../api'
import type { Tool } from '../types'

export default function EditTool() {
  const [match, params] = useRoute('/edit/:id')
  // @ts-ignore
  const toolId = params?.id ?? ''
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  
  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entry, setEntry] = useState('')
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    if (!toolId) return
    loadTool()
  }, [toolId])

  async function loadTool() {
    try {
      setLoading(true)
      const tools = await api.tools()
      const found = tools.find(t => t.id === toolId)
      if (found) {
        setTool(found)
        setName(found.name || '')
        setDescription(found.description || '')
        setEntry(found.entry || '')
        setAutostart(found.autostart || false)
      } else {
        setError('Tool not found')
      }
    } catch (err: any) {
      setError(`Failed to load tool: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!toolId) return
    
    try {
      setSaving(true)
      setError('')
      setSuccess(false)
      
      await api.updateTool(toolId, {
        name,
        description,
        entry,
        autostart
      })
      
      setSuccess(true)
      window.__toast?.('Tool updated successfully')
      
      // Reload to get updated data
      await loadTool()
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!toolId) {
    return (
      <NonIdealState
        icon="error"
        title="No Tool Selected"
        description="Please select a tool to edit"
        action={<Link href="/"><Button intent="primary">Back to Dashboard</Button></Link>}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spinner />
      </div>
    )
  }

  if (!tool) {
    return (
      <NonIdealState
        icon="error"
        title="Tool Not Found"
        description={`Tool with ID "${toolId}" was not found`}
        action={<Link href="/"><Button intent="primary">Back to Dashboard</Button></Link>}
      />
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Edit Tool: {tool.name}</h2>
        <Link href="/">
          <Button icon="arrow-left">Back to Dashboard</Button>
        </Link>
      </div>

      {error && (
        <Callout intent="danger" style={{ marginBottom: 20 }}>
          {error}
        </Callout>
      )}

      {success && (
        <Callout intent="success" style={{ marginBottom: 20 }}>
          Tool updated successfully!
        </Callout>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
        {/* Tool Editor Card - Narrower */}
        <Card style={{ height: 'fit-content' }}>
          <FormGroup label="Tool ID" labelFor="tool-id">
            <InputGroup
              id="tool-id"
              value={tool.id}
              disabled
              readOnly
            />
          </FormGroup>

          <FormGroup label="Name" labelFor="tool-name" labelInfo="(required)">
            <InputGroup
              id="tool-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tool name"
            />
          </FormGroup>

          <FormGroup label="Description" labelFor="tool-description">
            <TextArea
              id="tool-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter tool description"
              style={{ width: '100%', minHeight: 100 }}
            />
          </FormGroup>

          <FormGroup label="Entry Point" labelFor="tool-entry" helperText="Python module:app format (e.g., app:app)">
            <InputGroup
              id="tool-entry"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="app:app"
            />
          </FormGroup>

          <FormGroup label="Settings">
            <Switch
              checked={autostart}
              label="Autostart on backend boot"
              onChange={(e) => setAutostart(e.currentTarget.checked)}
            />
          </FormGroup>

          <FormGroup label="Tool Information">
            <div style={{ padding: 10, background: 'var(--bp5-gray5)', borderRadius: 5 }}>
              <div><strong>Path:</strong> {tool.path}</div>
              <div><strong>Virtual Environment:</strong> {tool.venv}</div>
              <div><strong>Python:</strong> {tool.python || 'Default'}</div>
              <div><strong>Status:</strong> {tool.status || 'Unknown'}</div>
              {tool.port && <div><strong>Port:</strong> {tool.port}</div>}
            </div>
          </FormGroup>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Button
              intent="primary"
              icon="floppy-disk"
              loading={saving}
              onClick={save}
            >
              Save Changes
            </Button>
            {tool.status === 'running' && tool.port && (
              <Button 
                icon="share" 
                onClick={() => window.open(`/api/apps/${tool.id}/`, '_blank')}
              >
                Open App
              </Button>
            )}
          </div>
        </Card>

        {/* File Tree and Code Editor - To the right */}
        <div>
          <IntegratedDev toolId={tool.id} />
        </div>
      </div>
    </div>
  )
}

function IntegratedDev({ toolId }: { toolId: string }){
  const [tree, setTree] = useState<any>(null)
  const [current, setCurrent] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [port, setPort] = useState<number | null>(null)
  const [logs, setLogs] = useState<string>('')

  async function loadTree(){
    const r = await fetch(`/api/tools/${toolId}/files`)
    const j = await r.json()
    setTree(j)
  }
  async function openFile(p: string){
    const r = await fetch(`/api/tools/${toolId}/file?path=${encodeURIComponent(p)}`)
    const j = await r.json()
    setCurrent(p); setContent(j.content); setDirty(false)
  }
  async function saveFile(){
    setSaving(true)
    await fetch(`/api/tools/${toolId}/file`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({path: current, content})})
    setDirty(false); setSaving(false)
  }
  async function restart(){
    await fetch(`/api/tools/${toolId}/restart`, {method:'POST'})
    setRunning(true)
  }
  async function start(){
    await fetch(`/api/tools/${toolId}/start`, {method:'POST'})
    setRunning(true)
    setPort(8000) // Default port, you might want to get this from the response
  }
  
  async function stop(){
    await fetch(`/api/tools/${toolId}/stop`, {method:'POST'})
    setRunning(false)
    setPort(null)
  }
  
  async function fork(){
    await fetch(`/api/tools/${toolId}/restart`, {method:'POST'})
    setRunning(true)
  }
  
  async function exec(cmd: string, py=false){
    const r = await fetch(`/api/tools/${toolId}/exec`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({command: cmd, python: py})})
    const j = await r.json()
    setLogs(o => o + (j.stdout||'') + (j.stderr||''))
  }

  useEffect(()=>{ loadTree() }, [toolId])

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div style={{ overflow:'auto' }}>
        <h4>Project Files</h4>
        {tree ? <FileTree node={tree} onSelect={openFile} /> : <div>Loading...</div>}
      </div>
      <div style={{ overflow:'auto' }}>
        <h4>Code Editor</h4>
        <Card>
          <div style={{ display:'grid', gridTemplateRows:'1fr auto auto', gap:8 }}>
            <div style={{ border:'1px solid var(--bp5-divider-black)', borderRadius:8, height:400 }}>
              <Editor value={content} onChange={(v)=>{ setContent(v); setDirty(true) }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
              <div>
                <span>Status: </span>
                {running ? <span style={{ color:'green' }}>Running on port {port}</span> : <span style={{ color:'red' }}>Stopped</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <Button intent="success" onClick={start}>Start</Button>
                <Button intent="danger" onClick={stop}>Stop</Button>
                <Button intent="primary" onClick={fork}>Restart tool</Button>
              </div>
            </div>
            <div style={{ border:'1px solid var(--bp5-divider-black)', borderRadius:8, padding:8, maxHeight:200, overflow:'auto' }}>
              <h5>Terminal Output</h5>
              <pre>{logs}</pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function FileTree({ node, onSelect }: { node: any; onSelect: (path: string) => void }){
  if (!node || !node.children) return null
  return (
    <ul style={{ listStyle: 'none', paddingLeft: 12 }}>
      {node.children.map((child: any) => (
        <li key={child.path || child.name}>
          {child.type === 'dir' ? (
            <details>
              <summary>{child.name}/</summary>
              <FileTree node={child} onSelect={onSelect} />
            </details>
          ) : (
            <span style={{ cursor: 'pointer' }} onClick={() => onSelect(child.path)}>{child.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
