// Blueprint components work natively with React
import { useState, useEffect } from 'react'
import { Button, HTMLTable, Card, Dialog, FormGroup, InputGroup, Tag, RadioGroup, Radio, Callout } from '@blueprintjs/core'
import api from '../api'
import type { Runtime } from '../types'

export default function Runtimes() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [addMethod, setAddMethod] = useState<'path' | 'download'>('path')
  const [runtimeType, setRuntimeType] = useState('python')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRuntimes()
  }, [])

  async function loadRuntimes() {
    try {
      setLoading(true)
      const data = await api.runtimes()
      setRuntimes(data)
    } catch (error) {
      console.error('Failed to load runtimes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function setDefault(path: string) {
    try {
      await api.setDefaultRuntime(path)
      await loadRuntimes()
      window.__toast?.('Default runtime updated')
    } catch (error) {
      window.__toast?.('Failed to set default runtime')
    }
  }

  async function addRuntime() {
    try {
      if (addMethod === 'path' && newPath.trim()) {
        // Add runtime by path
        await api.addRuntime({ path: newPath, type: runtimeType })
        window.__toast?.('Runtime added successfully')
      } else if (addMethod === 'download' && downloadUrl.trim()) {
        // Add runtime by download URL
        await api.downloadRuntime({ url: downloadUrl, type: runtimeType })
        window.__toast?.('Runtime download started')
      }
      
      setNewPath('')
      setDownloadUrl('')
      setShowAdd(false)
      await loadRuntimes()
    } catch (error: any) {
      window.__toast?.(error.message || 'Failed to add runtime')
    }
  }

  const getRuntimeIcon = (type?: string) => {
    switch (type) {
      case 'python': return '🐍'
      case 'node': return '🟢'
      case 'ruby': return '💎'
      case 'go': return '🐹'
      case 'rust': return '🦀'
      case 'java': return '☕'
      default: return '💻'
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Language Runtimes</h2>
        <Button icon="plus" intent="primary" onClick={() => setShowAdd(true)}>
          Add Runtime
        </Button>
      </div>

      <Callout intent="primary" style={{ marginBottom: 20 }}>
        Manage language runtimes for running tools. Each tool can specify which runtime it needs.
      </Callout>
      
      <Card>
        <HTMLTable striped style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Version</th>
              <th>Path</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runtimes.map(r => (
              <tr key={r.path}>
                <td>
                  <span style={{ fontSize: 20, marginRight: 8 }}>{getRuntimeIcon(r.type)}</span>
                  {r.type || 'Unknown'}
                </td>
                <td>{r.version}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.path}</td>
                <td>
                  {r.default && <Tag intent="success">Default</Tag>}
                  {r.managed && <Tag>Managed</Tag>}
                </td>
                <td>
                  {!r.default && (
                    <Button size="small" onClick={() => setDefault(r.path)}>
                      Set Default
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Card>
      
      <Dialog
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Language Runtime"
        style={{ width: 600 }}
      >
        <div className="bp5-dialog-body">
          <FormGroup label="Runtime Type" labelFor="runtime-type">
            <div className="bp5-html-select">
              <select 
                id="runtime-type"
                value={runtimeType} 
                onChange={(e) => setRuntimeType(e.target.value)}
              >
                <option value="python">Python</option>
                <option value="node">Node.js</option>
                <option value="ruby">Ruby</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="java">Java</option>
                <option value="other">Other</option>
              </select>
            </div>
          </FormGroup>

          <RadioGroup
            label="Add Method"
            onChange={(e) => setAddMethod(e.currentTarget.value as 'path' | 'download')}
            selectedValue={addMethod}
          >
            <Radio label="Specify interpreter path" value="path" />
            <Radio label="Download from URL" value="download" />
          </RadioGroup>

          {addMethod === 'path' ? (
            <FormGroup 
              label="Interpreter Path" 
              labelFor="runtime-path"
              helperText="Full path to the language interpreter executable"
            >
              <InputGroup
                id="runtime-path"
                value={newPath} 
                onChange={(e) => setNewPath(e.currentTarget.value)} 
                placeholder={
                  runtimeType === 'python' ? '/usr/bin/python3' :
                  runtimeType === 'node' ? '/usr/bin/node' :
                  '/path/to/interpreter'
                }
              />
            </FormGroup>
          ) : (
            <FormGroup 
              label="Download URL" 
              labelFor="download-url"
              helperText="Direct download link to runtime installer or archive"
            >
              <InputGroup
                id="download-url"
                value={downloadUrl} 
                onChange={(e) => setDownloadUrl(e.currentTarget.value)} 
                placeholder="https://example.com/runtime-installer.exe"
              />
            </FormGroup>
          )}
        </div>
        <div className="bp5-dialog-footer">
          <div className="bp5-dialog-footer-actions">
            <Button onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button 
              intent="primary" 
              onClick={addRuntime}
              disabled={addMethod === 'path' ? !newPath.trim() : !downloadUrl.trim()}
            >
              Add Runtime
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
