// Blueprint components work natively with React
import { useState } from 'react'
import { Dialog, Tab, Tabs, FormGroup, InputGroup, Button, FileInput } from '@blueprintjs/core'
import api from '../api'

interface AddToolDialogProps {
  onClose: () => void;
}

export default function AddToolDialog({ onClose }: AddToolDialogProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [entry, setEntry] = useState('')
  const [path, setPath] = useState('')
  const [repo, setRepo] = useState('')
  const [subdir, setSubdir] = useState('')
  const [ref, setRef] = useState('main')
  const [spec, setSpec] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('local')

  async function validateId() {
    if (!id.trim()) {
      setErrors(prev => ({ ...prev, id: 'ID is required' }))
      return false
    }
    // Future: Check ID uniqueness via API call
    setErrors(prev => ({ ...prev, id: '' }))
    return true
  }

  async function createTool() {
    if (!(await validateId())) return

    try {
      if (activeTab === 'local') {
        await api.createFromFolder({ id, name, path, entry })
      } else if (activeTab === 'git') {
        await api.createFromGit({ id, name, repo, ref, subdir, entry })
      } else if (activeTab === 'pip') {
        await api.createFromPip({ id, name, spec, entry })
      }

      window.__toast?.('Tool created successfully!')
      onClose()
    } catch (e: any) {
      window.__toast?.(e.message || 'Failed to create tool')
    }
  }

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Add New Tool"
      style={{ width: 600 }}
    >
      <div className="bp5-dialog-body">
        <Tabs
          id="create-tool-tabs"
          selectedTabId={activeTab}
          onChange={(newTabId) => setActiveTab(newTabId as string)}
        >
          <Tab id="local" title="Local Folder" panel={
            <div style={{ padding: '16px 0' }}>
              <FormGroup label="Tool ID" labelFor="local-id" intent={errors.id ? 'danger' : 'none'}>
                <InputGroup
                  id="local-id"
                  value={id}
                  onChange={(e) => setId(e.currentTarget.value)}
                  placeholder="unique-tool-id"
                />
                {errors.id && <div style={{ color: 'var(--bp5-intent-danger)', fontSize: 12 }}>{errors.id}</div>}
              </FormGroup>
              
              <FormGroup label="Display Name" labelFor="local-name">
                <InputGroup
                  id="local-name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="My Tool"
                />
              </FormGroup>
              
              <FormGroup label="Entry Point" labelFor="local-entry">
                <InputGroup
                  id="local-entry"
                  value={entry}
                  onChange={(e) => setEntry(e.currentTarget.value)}
                  placeholder="app:app"
                />
              </FormGroup>
              
              <FormGroup label="Source Directory" labelFor="local-path">
                <InputGroup
                  id="local-path"
                  value={path}
                  onChange={(e) => setPath(e.currentTarget.value)}
                  placeholder="/path/to/tool/directory"
                />
              </FormGroup>
            </div>
          } />
          
          <Tab id="git" title="Git Repository" panel={
            <div style={{ padding: '16px 0' }}>
              <FormGroup label="Tool ID" labelFor="git-id">
                <InputGroup
                  id="git-id"
                  value={id}
                  onChange={(e) => setId(e.currentTarget.value)}
                  placeholder="unique-tool-id"
                />
              </FormGroup>
              
              <FormGroup label="Display Name" labelFor="git-name">
                <InputGroup
                  id="git-name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="My Tool"
                />
              </FormGroup>
              
              <FormGroup label="Entry Point" labelFor="git-entry">
                <InputGroup
                  id="git-entry"
                  value={entry}
                  onChange={(e) => setEntry(e.currentTarget.value)}
                  placeholder="app:app"
                />
              </FormGroup>
              
              <FormGroup label="Repository URL" labelFor="git-repo">
                <InputGroup
                  id="git-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.currentTarget.value)}
                  placeholder="https://github.com/user/repo.git"
                />
              </FormGroup>
              
              <FormGroup label="Branch/Tag" labelFor="git-ref">
                <InputGroup
                  id="git-ref"
                  value={ref}
                  onChange={(e) => setRef(e.currentTarget.value)}
                  placeholder="main"
                />
              </FormGroup>
              
              <FormGroup label="Subdirectory (optional)" labelFor="git-subdir">
                <InputGroup
                  id="git-subdir"
                  value={subdir}
                  onChange={(e) => setSubdir(e.currentTarget.value)}
                  placeholder="path/to/tool"
                />
              </FormGroup>
            </div>
          } />
          
          <Tab id="pip" title="Package" panel={
            <div style={{ padding: '16px 0' }}>
              <FormGroup label="Tool ID" labelFor="pip-id">
                <InputGroup
                  id="pip-id"
                  value={id}
                  onChange={(e) => setId(e.currentTarget.value)}
                  placeholder="unique-tool-id"
                />
              </FormGroup>
              
              <FormGroup label="Display Name" labelFor="pip-name">
                <InputGroup
                  id="pip-name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="My Tool"
                />
              </FormGroup>
              
              <FormGroup label="Entry Point" labelFor="pip-entry">
                <InputGroup
                  id="pip-entry"
                  value={entry}
                  onChange={(e) => setEntry(e.currentTarget.value)}
                  placeholder="module:app"
                />
              </FormGroup>
              
              <FormGroup label="Package Specification" labelFor="pip-spec">
                <InputGroup
                  id="pip-spec"
                  value={spec}
                  onChange={(e) => setSpec(e.currentTarget.value)}
                  placeholder="fastapi uvicorn"
                />
              </FormGroup>
            </div>
          } />
        </Tabs>
      </div>
      
      <div className="bp5-dialog-footer">
        <div className="bp5-dialog-footer-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button intent="primary" onClick={createTool}>Create Tool</Button>
        </div>
      </div>
    </Dialog>
  )
}
