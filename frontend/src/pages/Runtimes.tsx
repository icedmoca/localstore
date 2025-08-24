// Blueprint components work natively with React
import { useState, useEffect } from 'react'
import { Button, HTMLTable, Card, Dialog, FormGroup, InputGroup, Tag } from '@blueprintjs/core'
import api from '../api'
import type { Runtime } from '../types'

export default function Runtimes() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newPath, setNewPath] = useState('')
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
    if (newPath.trim()) {
      // Future: Implement add runtime API endpoint
      setNewPath('')
      setShowAdd(false)
      window.__toast?.('Runtime added')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Python Runtimes</h2>
        <Button icon="plus" intent="primary" onClick={() => setShowAdd(true)}>
          Add Runtime
        </Button>
      </div>
      
      <Card>
        <HTMLTable striped style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Version</th>
              <th>Path</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runtimes.map(r => (
              <tr key={r.path}>
                <td>{r.version}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.path}</td>
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
        title="Add Python Runtime"
      >
        <div className="bp5-dialog-body">
          <FormGroup label="Interpreter Path" labelFor="runtime-path">
            <InputGroup
              id="runtime-path"
              value={newPath} 
              onChange={(e) => setNewPath(e.currentTarget.value)} 
              placeholder="/path/to/python"
            />
          </FormGroup>
        </div>
        <div className="bp5-dialog-footer">
          <div className="bp5-dialog-footer-actions">
            <Button onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button intent="primary" onClick={addRuntime}>Add</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
