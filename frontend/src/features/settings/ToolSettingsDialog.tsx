import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogStep,
  MultistepDialog,
  Button,
  Classes,
  FormGroup,
  InputGroup,
  TextArea,
  Switch,

  Tag,
  Toaster,
  Position,
  Intent,
  Alert,
  Callout,
  Tabs,
  Tab,
  Card,
  EditableText,
  TagInput,
  FileInput,
  MenuDivider,
  MenuItem,
  Menu
} from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { Table, Column, Cell } from '@blueprintjs/table'
import api from '../../api'
import type { Tool } from '../../types'
import { toast } from '../../components/ToastManager'

interface ToolSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  tool: Tool
  onSave: (updatedTool: Tool) => void
}

interface EnvironmentVariable {
  key: string
  value: string
  isSecret: boolean
  isRevealed: boolean
}

interface RuntimeConfig {
  type: string
  startCommand: string
  workingDirectory: string
  exposedPorts: number[]
  autoRestart: boolean
}

interface PermissionConfig {
  fileAccess: boolean
  networkEgress: boolean
  gpu: boolean
  systemCalls: boolean
}

export default function ToolSettingsDialog({ isOpen, onClose, tool, onSave }: ToolSettingsDialogProps) {
  const [selectedTabId, setSelectedTabId] = useState('general')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // General settings
  const [toolName, setToolName] = useState(tool?.name || '')
  const [toolSlug, setToolSlug] = useState(tool?.id || '')
  const [description, setDescription] = useState(tool?.description || '')
  const [tags, setTags] = useState<string[]>(tool?.tags || [])
  
  // Runtime settings
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    type: 'Python/FastAPI',
    startCommand: tool?.entry || 'app:app',
    workingDirectory: tool?.path || '',
    exposedPorts: [tool?.port || 8000].filter(Boolean),
    autoRestart: tool?.autostart || false
  })
  
  // Environment variables
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([
    { key: '', value: '', isSecret: false, isRevealed: false }
  ])
  
  // Permissions
  const [permissions, setPermissions] = useState<PermissionConfig>({
    fileAccess: true,
    networkEgress: true,
    gpu: false,
    systemCalls: false
  })
  
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)

  useEffect(() => {
    if (tool) {
      setToolName(tool.name || '')
      setToolSlug(tool.id || '')
      setDescription(tool.description || '')
      setTags(tool.tags || [])
      setRuntimeConfig({
        type: 'Python/FastAPI',
        startCommand: tool.entry || 'app:app',
        workingDirectory: tool.path || '',
        exposedPorts: [tool.port || 8000].filter(Boolean),
        autoRestart: tool.autostart || false
      })
    }
  }, [tool])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updatedTool: Tool = {
        ...tool,
        name: toolName,
        description,
        tags,
        entry: runtimeConfig.startCommand,
        autostart: runtimeConfig.autoRestart
      }
      
      await api.updateTool(tool.id, {
        autostart: runtimeConfig.autoRestart
      })
      
      onSave(updatedTool)
      setIsDirty(false)
      
      toast.success('Tool settings saved successfully')
    } catch (error: any) {
      toast.error(`Failed to save settings: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setToolName(tool?.name || '')
    setToolSlug(tool?.id || '')
    setDescription(tool?.description || '')
    setTags(tool?.tags || [])
    setRuntimeConfig({
      type: 'Python/FastAPI',
      startCommand: tool?.entry || 'app:app',
      workingDirectory: tool?.path || '',
      exposedPorts: [tool?.port || 8000].filter(Boolean),
      autoRestart: tool?.autostart || false
    })
    setIsDirty(false)
    setShowResetAlert(false)
  }

  const handleDelete = async () => {
    try {
      await api.uninstall(tool.id)
      toast.success('Tool deleted successfully')
      onClose()
    } catch (error: any) {
      toast.error(`Failed to delete tool: ${error.message}`)
    }
    setShowDeleteAlert(false)
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '', isSecret: false, isRevealed: false }])
    setIsDirty(true)
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  const updateEnvVar = (index: number, field: keyof EnvironmentVariable, value: any) => {
    const updated = [...envVars]
    updated[index] = { ...updated[index], [field]: value }
    setEnvVars(updated)
    setIsDirty(true)
  }

  const exportEnvVars = () => {
    const data = envVars.filter(v => v.key).reduce((acc, v) => {
      acc[v.key] = v.value
      return acc
    }, {} as Record<string, string>)
    
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${tool.id}-env.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importEnvVars = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          const imported = Object.entries(data).map(([key, value]) => ({
            key,
            value: String(value),
            isSecret: false,
            isRevealed: false
          }))
          setEnvVars([...envVars.filter(v => v.key), ...imported])
          setIsDirty(true)
        } catch (error) {
          toast.error('Invalid JSON file')
        }
      }
      reader.readAsText(file)
    }
  }

  if (!tool) return null

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={`Tool Settings - ${tool.name}`}
        icon="cog"
        style={{ width: '80vw', maxWidth: 800, height: '80vh' }}
        canOutsideClickClose={!isDirty}
        canEscapeKeyClose={!isDirty}
      >
        <div className={Classes.DIALOG_BODY} style={{ height: 'calc(80vh - 120px)', overflow: 'hidden' }}>
          <Tabs
            id="tool-settings-tabs"
            selectedTabId={selectedTabId}
            onChange={(tabId) => setSelectedTabId(tabId as string)}
            vertical
            large
          >
            <Tab
              id="general"
              title="General"
              panel={
                <Card style={{ margin: 16, height: 'calc(100% - 32px)', overflow: 'auto' }}>
                  <h3>General Settings</h3>
                  
                  <FormGroup label="Tool Name" labelFor="tool-name">
                    <InputGroup
                      id="tool-name"
                      value={toolName}
                      onChange={(e) => {
                        setToolName(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="Enter tool name"
                    />
                  </FormGroup>
                  
                  <FormGroup label="Tool Slug (ID)" labelFor="tool-slug" helperText="Readonly - cannot be changed">
                    <InputGroup
                      id="tool-slug"
                      value={toolSlug}
                      readOnly
                      disabled
                    />
                  </FormGroup>
                  
                  <FormGroup label="Description" labelFor="tool-description">
                    <TextArea
                      id="tool-description"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="Describe what this tool does"
                      rows={3}
                      fill
                    />
                  </FormGroup>
                  
                  <FormGroup label="Tags" labelFor="tool-tags">
                    <TagInput
                      values={tags}
                      onChange={(values) => {
                        setTags(values as string[])
                        setIsDirty(true)
                      }}
                      placeholder="Add tags (press Enter)"
                      fill
                    />
                  </FormGroup>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                    <FormGroup label="Tool ID" helperText="Readonly">
                      <InputGroup value={tool.id} readOnly disabled />
                    </FormGroup>
                    
                    <FormGroup label="Created At" helperText="Readonly">
                      <InputGroup value={new Date().toLocaleDateString()} readOnly disabled />
                    </FormGroup>
                  </div>
                </Card>
              }
            />
            
            <Tab
              id="runtime"
              title="Runtime"
              panel={
                <Card style={{ margin: 16, height: 'calc(100% - 32px)', overflow: 'auto' }}>
                  <h3>Runtime Configuration</h3>
                  
                  <FormGroup label="Runtime Type" helperText="The runtime environment for this tool">
                    <InputGroup value={runtimeConfig.type} readOnly disabled />
                  </FormGroup>
                  
                  <FormGroup label="Start Command" labelFor="start-command">
                    <InputGroup
                      id="start-command"
                      value={runtimeConfig.startCommand}
                      onChange={(e) => {
                        setRuntimeConfig({ ...runtimeConfig, startCommand: e.target.value })
                        setIsDirty(true)
                      }}
                      placeholder="app:app"
                    />
                  </FormGroup>
                  
                  <FormGroup label="Working Directory" helperText="Path where the tool will run">
                    <InputGroup
                      value={runtimeConfig.workingDirectory}
                      readOnly
                      disabled
                    />
                  </FormGroup>
                  
                  <FormGroup label="Exposed Ports">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {runtimeConfig.exposedPorts.map((port, i) => (
                        <Tag key={i} intent="primary">{port}</Tag>
                      ))}
                      {runtimeConfig.exposedPorts.length === 0 && (
                        <span style={{ color: 'var(--bp5-text-color-muted)' }}>No ports exposed</span>
                      )}
                    </div>
                  </FormGroup>
                  
                  <FormGroup>
                    <Switch
                      checked={runtimeConfig.autoRestart}
                      onChange={(e) => {
                        setRuntimeConfig({ ...runtimeConfig, autoRestart: e.currentTarget.checked })
                        setIsDirty(true)
                      }}
                      label="Auto-restart on crash"
                      innerLabel="off"
                      innerLabelChecked="on"
                    />
                  </FormGroup>
                </Card>
              }
            />
            
            <Tab
              id="environment"
              title="Environment"
              panel={
                <Card style={{ margin: 16, height: 'calc(100% - 32px)', overflow: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3>Environment Variables</h3>
                    <div>
                      <Button icon="plus" onClick={addEnvVar} style={{ marginRight: 8 }}>
                        Add Variable
                      </Button>
                      <Popover2
                        content={
                          <Menu>
                            <MenuItem icon="export" text="Export JSON" onClick={exportEnvVars} />
                            <MenuDivider />
                            <MenuItem icon="import" text="Import JSON">
                              <FileInput
                                text="Choose file..."
                                onInputChange={importEnvVars}
                                inputProps={{ accept: '.json' }}
                              />
                            </MenuItem>
                          </Menu>
                        }
                      >
                        <Button icon="more" />
                      </Popover2>
                    </div>
                  </div>
                  
                  <Table numRows={envVars.length} enableRowHeader={false}>
                    <Column
                      name="Key"
                      cellRenderer={(rowIndex) => (
                        <Cell>
                          <InputGroup
                            value={envVars[rowIndex]?.key || ''}
                            onChange={(e) => updateEnvVar(rowIndex, 'key', e.target.value)}
                            placeholder="VARIABLE_NAME"
                            small
                          />
                        </Cell>
                      )}
                    />
                    <Column
                      name="Value"
                      cellRenderer={(rowIndex) => (
                        <Cell>
                          <InputGroup
                            value={envVars[rowIndex]?.value || ''}
                            onChange={(e) => updateEnvVar(rowIndex, 'value', e.target.value)}
                            placeholder="value"
                            type={envVars[rowIndex]?.isSecret && !envVars[rowIndex]?.isRevealed ? 'password' : 'text'}
                            rightElement={
                              envVars[rowIndex]?.isSecret ? (
                                <Button
                                  icon={(envVars[rowIndex]?.isRevealed ? 'eye-off' : 'eye-open') as any}
                                  minimal
                                  small
                                  onClick={() => updateEnvVar(rowIndex, 'isRevealed', !envVars[rowIndex]?.isRevealed)}
                                />
                              ) : undefined
                            }
                            small
                          />
                        </Cell>
                      )}
                    />
                    <Column
                      name="Secret"
                      cellRenderer={(rowIndex) => (
                        <Cell>
                          <Switch
                            checked={envVars[rowIndex]?.isSecret || false}
                            onChange={(e) => updateEnvVar(rowIndex, 'isSecret', e.currentTarget.checked)}
                            innerLabel="no"
                            innerLabelChecked="yes"
                          />
                        </Cell>
                      )}
                    />
                    <Column
                      name="Actions"
                      cellRenderer={(rowIndex) => (
                        <Cell>
                          <Button
                            icon="trash"
                            intent="danger"
                            minimal
                            small
                            onClick={() => removeEnvVar(rowIndex)}
                          />
                        </Cell>
                      )}
                    />
                  </Table>
                </Card>
              }
            />
            
            <Tab
              id="permissions"
              title="Permissions"
              panel={
                <Card style={{ margin: 16, height: 'calc(100% - 32px)', overflow: 'auto' }}>
                  <h3>Tool Permissions</h3>
                  <p style={{ color: 'var(--bp5-text-color-muted)', marginBottom: 16 }}>
                    Configure what resources this tool can access
                  </p>
                  
                  <FormGroup>
                    <Switch
                      checked={permissions.fileAccess}
                      onChange={(e) => {
                        setPermissions({ ...permissions, fileAccess: e.currentTarget.checked })
                        setIsDirty(true)
                      }}
                      label="File System Access"
                      innerLabel="deny"
                      innerLabelChecked="allow"
                    />
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Allow the tool to read and write files
                    </p>
                  </FormGroup>
                  
                  <FormGroup>
                    <Switch
                      checked={permissions.networkEgress}
                      onChange={(e) => {
                        setPermissions({ ...permissions, networkEgress: e.currentTarget.checked })
                        setIsDirty(true)
                      }}
                      label="Network Access"
                      innerLabel="deny"
                      innerLabelChecked="allow"
                    />
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Allow the tool to make outbound network requests
                    </p>
                  </FormGroup>
                  
                  <FormGroup>
                    <Switch
                      checked={permissions.gpu}
                      onChange={(e) => {
                        setPermissions({ ...permissions, gpu: e.currentTarget.checked })
                        setIsDirty(true)
                      }}
                      label="GPU Access"
                      innerLabel="deny"
                      innerLabelChecked="allow"
                    />
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Allow the tool to access GPU resources
                    </p>
                  </FormGroup>
                  
                  <FormGroup>
                    <Switch
                      checked={permissions.systemCalls}
                      onChange={(e) => {
                        setPermissions({ ...permissions, systemCalls: e.currentTarget.checked })
                        setIsDirty(true)
                      }}
                      label="System Calls"
                      innerLabel="deny"
                      innerLabelChecked="allow"
                    />
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Allow the tool to make system calls
                    </p>
                  </FormGroup>
                </Card>
              }
            />
            
            <Tab
              id="advanced"
              title="Advanced"
              panel={
                <Card style={{ margin: 16, height: 'calc(100% - 32px)', overflow: 'auto' }}>
                  <h3>Advanced Settings</h3>
                  
                  <Callout intent="warning" style={{ marginBottom: 16 }}>
                    <strong>Danger Zone</strong>
                    <br />
                    These actions cannot be undone. Please proceed with caution.
                  </Callout>
                  
                  <FormGroup label="Reset Configuration">
                    <Button
                      icon="refresh"
                      intent="warning"
                      onClick={() => setShowResetAlert(true)}
                    >
                      Reset to Defaults
                    </Button>
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Reset all settings to their default values
                    </p>
                  </FormGroup>
                  
                  <FormGroup label="Delete Tool">
                    <Button
                      icon="trash"
                      intent="danger"
                      onClick={() => setShowDeleteAlert(true)}
                    >
                      Delete Tool
                    </Button>
                    <p style={{ fontSize: 12, color: 'var(--bp5-text-color-muted)', marginTop: 4 }}>
                      Permanently delete this tool and all its data
                    </p>
                  </FormGroup>
                </Card>
              }
            />
          </Tabs>
        </div>
        
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              intent="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={!isDirty}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </Dialog>

      <Alert
        isOpen={showDeleteAlert}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        intent="danger"
        onCancel={() => setShowDeleteAlert(false)}
        onConfirm={handleDelete}
      >
        <p>
          Are you sure you want to delete <strong>{tool.name}</strong>? 
          This action cannot be undone and will permanently remove the tool and all its data.
        </p>
      </Alert>

      <Alert
        isOpen={showResetAlert}
        confirmButtonText="Reset"
        cancelButtonText="Cancel"
        intent="warning"
        onCancel={() => setShowResetAlert(false)}
        onConfirm={handleReset}
      >
        <p>
          Are you sure you want to reset all settings to their default values? 
          This will discard any unsaved changes.
        </p>
      </Alert>
    </>
  )
}
