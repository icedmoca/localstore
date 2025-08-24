import { useState, useEffect } from 'react'
import { Button, Card, Tree, TreeNodeInfo, ContextMenu, Menu, MenuItem, Tab, Tabs, NonIdealState } from '@blueprintjs/core'
import { ContextMenu2 } from '@blueprintjs/popover2'
import { useRoute, Link } from 'wouter'
import Editor from '../components/Editor'
import type { FileNode } from '../types'

async function j(url:string, init?:RequestInit){
  const r = await fetch(url, init); 
  if(!r.ok) {
    const error = await r.text()
    throw new Error(error)
  }
  return r.json()
}

export default function DevMode(){
  const [match, params] = useRoute('/dev/:id')
  // @ts-ignore - params can be null but we handle it gracefully
  const toolId = params?.id ?? ''
  if (!toolId) {
    return (
      <NonIdealState
        icon="folder-open"
        title="Select a Tool for Development"
        description="Choose a tool from the Installed tab to start developing"
        action={<Link href="/installed"><Button intent="primary" text="Go to Installed Tools" /></Link>}
      />
    )
  }
  const [files, setFiles] = useState<FileNode | null>(null)
  const [current, setCurrent] = useState<string>('')
  const [treeData, setTreeData] = useState<TreeNodeInfo[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [content, setContent] = useState<string>('')
  const [dirty, setDirty] = useState(false)
  const [running, setRunning] = useState(false)
  const [port, setPort] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('logs')
  const [hasWorkspace, setHasWorkspace] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  async function fork() { 
    try {
      setLoading(true)
      setError('')
      await j(`/api/dev/${toolId}/fork`, {method:'POST'})
      setHasWorkspace(true)
      await loadFiles()
    } catch (err: any) {
      setError(`Fork failed: ${err.message}`)
      ;(window as any).__toast?.(`Fork failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadFiles() { 
    try {
      setLoading(true)
      setError('')
      const f = await j(`/api/dev/${toolId}/files`)
      setFiles(f)
      setTreeData(buildTreeData(f))
      setHasWorkspace(true)
    } catch (err: any) {
      if (err.message.includes('No workspace')) {
        setHasWorkspace(false)
        setError('No workspace found. Click Fork to create a development workspace.')
      } else {
        setError(`Failed to load files: ${err.message}`)
        ;(window as any).__toast?.(`Failed to load files: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }
  async function openFile(p:string){ 
    const f = await j(`/api/dev/${toolId}/file?path=${encodeURIComponent(p)}`); 
    setCurrent(p); 
    setContent(f.content); 
    setDirty(false) 
  }
  async function save(){ 
    await j(`/api/dev/${toolId}/file`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({path: current, content})}); 
    setDirty(false) 
  }

  function buildTreeData(node: FileNode): TreeNodeInfo[] {
    if (!node?.children) return []
    
    return node.children.map(child => ({
      id: child.path || child.name,
      label: child.name,
      icon: child.type === 'dir' ? 'folder-close' : 'document',
      isExpanded: false,
      childNodes: child.type === 'dir' ? buildTreeData(child) : undefined,
      nodeData: child
    }))
  }

  async function start(){ 
    const r = await j(`/api/dev/${toolId}/run`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'start'})}); 
    setRunning(true); 
    setPort(r.port);
    tail() 
  }
  async function stop(){ 
    await j(`/api/dev/${toolId}/run`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'stop'})}); 
    setRunning(false);
    setPort(null);
  }

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

  useEffect(() => {
    if (toolId) {
      // Try to load files first to check if workspace exists
      loadFiles()
    }
  }, [toolId])

  const handleNodeClick = (node: TreeNodeInfo) => {
    const fileNode = node.nodeData as FileNode
    if (fileNode.type === 'file' && fileNode.path) {
      openFile(fileNode.path)
    }
  }

  const handleNodeExpand = (node: TreeNodeInfo) => {
    setTreeData(prevData => updateNodeExpansion(prevData, node.id, true))
  }

  const handleNodeCollapse = (node: TreeNodeInfo) => {
    setTreeData(prevData => updateNodeExpansion(prevData, node.id, false))
  }

  function updateNodeExpansion(nodes: TreeNodeInfo[], nodeId: any, isExpanded: boolean): TreeNodeInfo[] {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, isExpanded }
      }
      if (node.childNodes) {
        return { ...node, childNodes: updateNodeExpansion(node.childNodes, nodeId, isExpanded) }
      }
      return node
    })
  }

  const handleDrop = (e: any) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer) {
      const file = e.dataTransfer.files[0]
      // Future: Implement file upload to /api/dev/:id/upload
    }
  }

  const handleDragOver = (e: any) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  // Show tool selection if no tool ID
  if (!toolId) {
    return (
      <NonIdealState
        icon="folder-open"
        title="Select a Tool for Development"
        description="Choose a tool from the Installed tab to start developing"
        action={<Link href="/installed"><Button intent="primary" text="Go to Installed Tools" /></Link>}
      />
    )
  }

  // Show fork prompt if no workspace
  if (!hasWorkspace && !loading) {
    return (
      <NonIdealState
        icon="git-branch"
        title="Create Development Workspace"
        description={error || `Create a development workspace for ${toolId} to start editing files`}
        action={
          <Button 
            intent="primary" 
            text="Fork Tool" 
            onClick={fork}
            loading={loading}
            icon="git-branch"
          />
        }
      />
    )
  }

  // Show loading
  if (loading) {
    return (
      <NonIdealState
        icon="refresh"
        title="Loading..."
        description="Setting up development workspace"
      />
    )
  }

  return (
    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '300px 1fr 400px', gap: 16, height: '80vh' }}>
      {/* Files Panel */}
      <Card style={{ overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4>Project Files</h4>
          <div style={{ fontSize: '12px', color: 'var(--bp5-text-color-muted)' }}>
            {toolId}
          </div>
        </div>
        {!files ? (
          <div style={{ color: 'var(--bp5-text-color-muted)' }}>Loading...</div>
        ) : (
          <ContextMenu2
            content={
              <Menu>
                <MenuItem text="New File" icon="document" />
                <MenuItem text="New Folder" icon="folder-new" />
                <MenuItem text="Upload Files" icon="upload" />
              </Menu>
            }
          >
            <Tree
              contents={treeData}
              onNodeClick={handleNodeClick}
              onNodeExpand={handleNodeExpand}
              onNodeCollapse={handleNodeCollapse}
            />
          </ContextMenu2>
        )}
      </Card>

      {/* Editor Panel */}
      <Card 
        style={{ display: 'flex', flexDirection: 'column' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>
            {current || 'No file selected'} {dirty && '*'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {running && port && (
              <Button 
                small 
                icon="share" 
                onClick={() => window.open(`/api/apps/dev-${toolId}/`, '_blank')}
              >
                Open
              </Button>
            )}
            <Button small icon="floppy-disk" onClick={save} disabled={!dirty}>
              Save
            </Button>
            {!running ? (
              <Button small intent="success" icon="play" onClick={start}>
                Start
              </Button>
            ) : (
              <Button small intent="danger" icon="stop" onClick={stop}>
                Stop
              </Button>
            )}
            <Button small icon="chat" onClick={askChat}>
              AI Patch
            </Button>
          </div>
        </div>
        <div style={{ flex: 1, border: dragOver ? '2px dashed var(--bp5-intent-primary)' : '1px solid var(--bp5-gray5)' }}>
          <Editor value={content} onChange={(v) => { setContent(v); setDirty(true) }} />
        </div>
      </Card>

      {/* Logs/Patches Panel */}
      <Card style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Tabs 
          id="dev-tabs" 
          selectedTabId={activeTab} 
          onChange={(newTabId) => setActiveTab(newTabId as string)}
        >
          <Tab id="logs" title="Logs" panel={
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              fontFamily: 'monospace', 
              fontSize: 12, 
              padding: 8,
              background: 'var(--bp5-dark-gray5)',
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto'
            }}>
              {logs.length === 0 ? 'No logs yet...' : logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          } />
          <Tab id="patches" title="Patches" panel={
            <div style={{ padding: 8 }}>
              <p style={{ color: 'var(--bp5-text-color-muted)' }}>AI-generated patches will appear here.</p>
            </div>
          } />
        </Tabs>
      </Card>
    </div>
  )
}

function FileTree({ node, onSelect }: { node: any; onSelect: (path: string) => void }) {
  return (
    <ul>
      {node.children.map((child: any) => (
        <li key={child.name}>
          {child.type === 'dir' ? (
            <>
              <span>{child.name}/</span>
              <FileTree node={child} onSelect={onSelect} />
            </>
          ) : (
            <span style={{cursor: 'pointer'}} onClick={() => onSelect(child.path)}>{child.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
