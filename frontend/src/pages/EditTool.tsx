import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
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
  Tab,
  Navbar,
  NavbarGroup,
  NavbarHeading,
  NavbarDivider,
  ButtonGroup,
  Tag,
  Breadcrumbs,
  Tree,
  TreeNodeInfo,
  Menu,
  MenuItem,
  MenuDivider,
  ProgressBar,
  Dialog,
  Toaster,
  Position,
  Intent,
  Icon,
  Tooltip,
  HotkeysTarget2,
  Drawer,
  PanelStack2,
  Classes
} from '@blueprintjs/core'
import { Select, Omnibar } from '@blueprintjs/select'
import { ContextMenu2, Popover2 } from '@blueprintjs/popover2'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Editor from '../components/Editor'
import api from '../api'
import type { Tool } from '../types'
import type { IconName } from '@blueprintjs/core'

// Create a global toaster instance
const AppToaster = Toaster.create({ position: Position.TOP })

interface FileNode extends TreeNodeInfo {
  id: string
  label: string
  icon?: IconName
  isExpanded?: boolean
  childNodes?: FileNode[]
  nodeData?: {
    path: string
    type: 'file' | 'directory'
    gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked'
  }
}

interface EditorTab {
  id: string
  title: string
  path: string
  content: string
  isDirty: boolean
  language: string
}

interface Problem {
  severity: 'error' | 'warning' | 'info'
  message: string
  line: number
  column: number
  file: string
}

export default function EditTool() {
  const params = useParams()
  const navigate = useNavigate()
  const toolId = params.toolId || params.id || ''
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  
  // IDE State
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<string>('')
  const [fileFilter, setFileFilter] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  
  // Editor State
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()
  
  // Right Panel State
  const [rightPanelTab, setRightPanelTab] = useState('search')
  const [rightPanelVisible, setRightPanelVisible] = useState(true)
  
  // Bottom Panel State
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal')
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300)
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  // Problems State
  const [problems, setProblems] = useState<Problem[]>([])
  
  // Terminal State
  const [terminalOutput, setTerminalOutput] = useState('')
  const [terminalInput, setTerminalInput] = useState('')
  
  // Command Palette State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  
  // Tool State
  const [toolStatus, setToolStatus] = useState<'stopped' | 'running' | 'starting' | 'stopping'>('stopped')
  const [toolPort, setToolPort] = useState<number | null>(null)

  useEffect(() => {
    if (!toolId) return
    loadTool()
    loadFileTree()
  }, [toolId])

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled) return
    
    const activeTab = editorTabs.find(tab => tab.id === activeTabId)
    if (!activeTab?.isDirty) return
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    
    // Set new timer for 2 seconds
    autoSaveTimerRef.current = setTimeout(() => {
      saveFile(activeTab.path, activeTab.content)
    }, 2000)
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [editorTabs, activeTabId, autoSaveEnabled])

  async function loadTool() {
    try {
      setLoading(true)
      const tools = await api.tools()
      const found = tools.find(t => t.id === toolId)
      if (found) {
        setTool(found)
        setToolStatus(found.status === 'running' ? 'running' : 'stopped')
        setToolPort(found.port || null)
      } else {
        setError('Tool not found')
      }
    } catch (err: any) {
      setError(`Failed to load tool: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadFileTree() {
    try {
      const response = await fetch(`/api/tools/${toolId}/files`)
      const data = await response.json()
      setFileTree(convertToTreeNodes(data))
    } catch (err) {
      console.error('Failed to load file tree:', err)
    }
  }

  function convertToTreeNodes(node: any, path: string = ''): FileNode[] {
    if (!node?.children) return []
    
    return node.children.map((child: any) => ({
      id: child.path || `${path}/${child.name}`,
      label: child.name,
      icon: child.type === 'dir' ? 'folder-close' : getFileIcon(child.name),
      isExpanded: expandedNodes.includes(child.path || `${path}/${child.name}`),
      childNodes: child.type === 'dir' ? convertToTreeNodes(child, child.path) : undefined,
      nodeData: {
        path: child.path || `${path}/${child.name}`,
        type: child.type === 'dir' ? 'directory' : 'file',
        gitStatus: getGitStatus(child.path || `${path}/${child.name}`)
      }
    }))
  }

  function getFileIcon(filename: string): IconName {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'py': return 'code'
      case 'js': case 'ts': case 'jsx': case 'tsx': return 'code'
      case 'json': return 'properties'
      case 'md': return 'document'
      case 'txt': return 'document'
      case 'yml': case 'yaml': return 'cog'
      default: return 'document'
    }
  }

  function getGitStatus(path: string): 'modified' | 'added' | 'deleted' | 'untracked' | undefined {
    // Mock git status - in a real app, this would come from git status API
    return Math.random() > 0.8 ? 'modified' : undefined
  }

  async function openFile(path: string) {
    // Check if file is already open
    const existingTab = editorTabs.find(tab => tab.path === path)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    try {
      const response = await fetch(`/api/tools/${toolId}/file?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      
      const newTab: EditorTab = {
        id: Date.now().toString(),
        title: path.split('/').pop() || 'Untitled',
        path,
        content: data.content || '',
        isDirty: false,
        language: getLanguageFromPath(path)
      }
      
      setEditorTabs(prev => [...prev, newTab])
      setActiveTabId(newTab.id)
      setBreadcrumbs(path.split('/'))
    } catch (err) {
      AppToaster.show({
        message: `Failed to open file: ${path}`,
        intent: Intent.DANGER
      })
    }
  }

  function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'py': return 'python'
      case 'js': return 'javascript'
      case 'ts': return 'typescript'
      case 'jsx': return 'javascript'
      case 'tsx': return 'typescript'
      case 'json': return 'json'
      case 'md': return 'markdown'
      case 'yml': case 'yaml': return 'yaml'
      case 'html': return 'html'
      case 'css': return 'css'
      default: return 'plaintext'
    }
  }

  async function saveFile(path: string, content: string) {
    try {
      await fetch(`/api/tools/${toolId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      })
      
      // Update tab to mark as not dirty
      setEditorTabs(prev => 
        prev.map(tab => 
          tab.path === path ? { ...tab, isDirty: false } : tab
        )
      )
      
      AppToaster.show({
        message: `Saved ${path.split('/').pop()}`,
        intent: Intent.SUCCESS,
        timeout: 2000
      })
    } catch (err) {
      AppToaster.show({
        message: `Failed to save ${path}`,
        intent: Intent.DANGER
      })
    }
  }

  function closeTab(tabId: string) {
    const tab = editorTabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      // In a real app, show confirmation dialog
      if (!confirm(`${tab.title} has unsaved changes. Close anyway?`)) {
        return
      }
    }
    
    setEditorTabs(prev => prev.filter(t => t.id !== tabId))
    
    // If closing active tab, switch to another tab
    if (activeTabId === tabId) {
      const remainingTabs = editorTabs.filter(t => t.id !== tabId)
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[0].id : '')
    }
  }

  function updateTabContent(tabId: string, content: string) {
    setEditorTabs(prev =>
      prev.map(tab =>
        tab.id === tabId
          ? { ...tab, content, isDirty: content !== tab.content }
          : tab
      )
    )
  }

  const handleNodeClick = useCallback((nodeData: TreeNodeInfo) => {
    const data = nodeData.nodeData as FileNode['nodeData']
    if (data?.type === 'file') {
      openFile(data.path)
    }
  }, [toolId])

  const handleNodeCollapse = useCallback((nodeData: TreeNodeInfo) => {
    setExpandedNodes(prev => prev.filter(id => id !== nodeData.id))
  }, [])

  const handleNodeExpand = useCallback((nodeData: TreeNodeInfo) => {
    setExpandedNodes(prev => [...prev, nodeData.id as string])
  }, [])

  async function runTool() {
    setToolStatus('starting')
    try {
      await fetch(`/api/tools/${toolId}/start`, { method: 'POST' })
      setToolStatus('running')
      setToolPort(8000) // Default port
      AppToaster.show({
        message: 'Tool started successfully',
        intent: Intent.SUCCESS
      })
    } catch (err) {
      setToolStatus('stopped')
      AppToaster.show({
        message: 'Failed to start tool',
        intent: Intent.DANGER
      })
    }
  }

  async function stopTool() {
    setToolStatus('stopping')
    try {
      await fetch(`/api/tools/${toolId}/stop`, { method: 'POST' })
      setToolStatus('stopped')
      setToolPort(null)
      AppToaster.show({
        message: 'Tool stopped',
        intent: Intent.PRIMARY
      })
    } catch (err) {
      setToolStatus('running')
      AppToaster.show({
        message: 'Failed to stop tool',
        intent: Intent.DANGER
      })
    }
  }

  if (!toolId) {
    return (
      <NonIdealState
        icon="error"
        title="No Tool Selected"
        description="Please select a tool to edit"
        action={<Link to="/dashboard"><Button intent="primary">Back to Dashboard</Button></Link>}
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
        action={<Link to="/dashboard"><Button intent="primary">Back to Dashboard</Button></Link>}
      />
    )
  }

  const activeTab = editorTabs.find(tab => tab.id === activeTabId)
  const filteredFileTree = fileFilter 
    ? fileTree.filter(node => 
        node.label.toLowerCase().includes(fileFilter.toLowerCase())
      ) 
    : fileTree

  return (
    <HotkeysTarget2
      hotkeys={[
        {
          combo: "cmd+p",
          global: true,
          label: "Open Command Palette",
          onKeyDown: () => setCommandPaletteOpen(true),
        },
        {
          combo: "cmd+s",
          global: true,
          label: "Save File",
          onKeyDown: () => {
            if (activeTab) {
              saveFile(activeTab.path, activeTab.content)
            }
          },
        },
        {
          combo: "cmd+w",
          global: true,
          label: "Close Tab",
          onKeyDown: () => {
            if (activeTab) {
              closeTab(activeTab.id)
            }
          },
        },
        {
          combo: "f5",
          global: true,
          label: "Run Tool",
          onKeyDown: () => runTool(),
        }
      ]}
    >
      <div className="ide-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top Navbar */}
        <Navbar className="bp5-dark">
          <NavbarGroup>
            <NavbarHeading>LocalStore IDE</NavbarHeading>
            <NavbarDivider />
            <Tag intent="primary">main</Tag>
            <ButtonGroup minimal>
              <Tooltip content="Save All">
                <Button icon="floppy-disk" />
              </Tooltip>
              <Tooltip content="Settings">
                <Button 
                  icon="cog" 
                  onClick={() => navigate(`/tools/${toolId}/settings`)}
                />
              </Tooltip>
            </ButtonGroup>
          </NavbarGroup>
          <NavbarGroup align="right">
            <Select<Tool>
              items={[tool]}
              itemRenderer={(item: Tool, { handleClick }) => (
                <MenuItem
                  key={item.id}
                  text={item.name}
                  onClick={handleClick}
                />
              )}
              onItemSelect={() => {}}
              filterable={false}
            >
              <Button
                text={tool.name}
                rightIcon="caret-down"
                fill
              />
            </Select>
            <NavbarDivider />
            <ButtonGroup>
              <Tooltip content={toolStatus === 'running' ? 'Stop Tool' : 'Start Tool'}>
                <Button
                  icon={toolStatus === 'running' ? 'stop' : 'play'}
                  intent={toolStatus === 'running' ? 'danger' : 'success'}
                  loading={toolStatus === 'starting' || toolStatus === 'stopping'}
                  onClick={toolStatus === 'running' ? stopTool : runTool}
                />
              </Tooltip>
              {toolStatus === 'running' && toolPort && (
                <>
                  <Tooltip content="Preview">
                    <Button
                      icon="eye-open"
                      onClick={() => navigate(`/tools/${toolId}/preview`)}
                    />
                  </Tooltip>
                  <Tooltip content="Open in Browser">
                    <Button
                      icon="share"
                      onClick={() => window.open(`/api/apps/${tool.id}/`, '_blank')}
                    />
                  </Tooltip>
                </>
              )}
            </ButtonGroup>
          </NavbarGroup>
        </Navbar>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PanelGroup direction="horizontal">
            {/* Left Panel - File Tree */}
            <Panel defaultSize={25} minSize={15} maxSize={40}>
              <div className="left-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 8 }}>
            <InputGroup
                    leftIcon="search"
                    placeholder="Filter files..."
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    small
                  />
                </div>
                
                <div style={{ padding: '0 8px' }}>
                  <Breadcrumbs
                    items={breadcrumbs.map(crumb => ({ text: crumb }))}
                  />
                </div>
                
                <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                  <Tree
                    contents={filteredFileTree}
                    onNodeClick={handleNodeClick}
                    onNodeCollapse={handleNodeCollapse}
                    onNodeExpand={handleNodeExpand}
                    className={Classes.ELEVATION_0}
                  />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle style={{ width: 2, backgroundColor: 'var(--bp5-divider-black)' }} />

            {/* Center Panel - Editor */}
            <Panel defaultSize={50}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={bottomPanelVisible ? 70 : 100}>
                  <div className="editor-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Editor Tabs */}
                    {editorTabs.length > 0 && (
                      <Tabs
                        id="editor-tabs"
                        selectedTabId={activeTabId}
                        onChange={(tabId) => setActiveTabId(tabId as string)}
                        renderActiveTabPanelOnly
                      >
                        {editorTabs.map(tab => (
                          <Tab
                            key={tab.id}
                            id={tab.id}
                            title={
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Icon icon={getFileIcon(tab.title)} size={12} />
                                <span>{tab.title}</span>
                                {tab.isDirty && <span style={{ color: 'orange' }}>●</span>}
                                <Button
                                  icon="cross"
                                  minimal
                                  small
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    closeTab(tab.id)
                                  }}
                                />
                              </div>
                            }
                            panel={
                              <div style={{ height: 'calc(100vh - 150px)' }}>
                                <Editor
                                  value={tab.content}
                                  language={tab.language}
                                  onChange={(content) => updateTabContent(tab.id, content)}
                                />
                              </div>
                            }
                          />
                        ))}
                      </Tabs>
                    )}

                    {/* Editor Toolbar */}
                    <div style={{ padding: 8, borderBottom: '1px solid var(--bp5-divider-black)' }}>
                      <ButtonGroup minimal>
                        <Tooltip content="Format Document">
                          <Button icon="clean" />
                        </Tooltip>
                        <Tooltip content="Find">
                          <Button icon="search" />
                        </Tooltip>
                        <Tooltip content="Replace">
                          <Button icon="swap-horizontal" />
                        </Tooltip>
                      </ButtonGroup>
                      
                      <div style={{ float: 'right', fontSize: 12, color: 'var(--bp5-text-color-muted)' }}>
                        Auto-save: 
            <Switch
                          checked={autoSaveEnabled}
                          onChange={(e) => setAutoSaveEnabled(e.currentTarget.checked)}
                          style={{ marginLeft: 8 }}
                          innerLabel="off"
                          innerLabelChecked="on"
                        />
                      </div>
                    </div>

                    {/* Empty State */}
                    {editorTabs.length === 0 && (
                      <NonIdealState
                        icon="code"
                        title="No Files Open"
                        description="Select a file from the explorer to start editing"
                      />
                    )}
            </div>
                </Panel>

                {/* Bottom Panel */}
                {bottomPanelVisible && (
                  <>
                    <PanelResizeHandle style={{ height: 2, backgroundColor: 'var(--bp5-divider-black)' }} />
                    <Panel defaultSize={30} minSize={20}>
                      <div className="bottom-panel" style={{ height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--bp5-divider-black)' }}>
                          <Tabs
                            id="bottom-tabs"
                            selectedTabId={bottomPanelTab}
                            onChange={(tabId) => setBottomPanelTab(tabId as string)}
                            large={false}
                          >
                            <Tab id="terminal" title="Terminal" />
                            <Tab id="problems" title={`Problems ${problems.length > 0 ? `(${problems.length})` : ''}`} />
                            <Tab id="output" title="Output" />
                            <Tab id="debug" title="Debug Console" />
                          </Tabs>
                          
                          <div style={{ marginLeft: 'auto' }}>
              <Button 
                              icon="chevron-down"
                              minimal
                              small
                              onClick={() => setBottomPanelVisible(false)}
                            />
                          </div>
                        </div>
                        
                        <div style={{ height: 'calc(100% - 40px)', padding: 8, overflow: 'auto' }}>
                          {bottomPanelTab === 'terminal' && (
                            <div>
                              <pre style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                {terminalOutput || 'Terminal ready...'}
                              </pre>
                              <InputGroup
                                placeholder="Type command..."
                                value={terminalInput}
                                onChange={(e) => setTerminalInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setTerminalOutput(prev => `${prev}\n$ ${terminalInput}\n`)
                                    setTerminalInput('')
                                  }
                                }}
                              />
                            </div>
                          )}
                          
                          {bottomPanelTab === 'problems' && (
                            <div>
                              {problems.length === 0 ? (
                                <NonIdealState
                                  icon="tick-circle"
                                  title="No Problems"
                                  description="All looks good!"
                                />
                              ) : (
                                problems.map((problem, i) => (
                                  <Callout
                                    key={i}
                                    intent={problem.severity === 'error' ? 'danger' : problem.severity === 'warning' ? 'warning' : 'primary'}
                                    style={{ marginBottom: 8 }}
                                  >
                                    <strong>{problem.file}:{problem.line}:{problem.column}</strong> - {problem.message}
                                  </Callout>
                                ))
            )}
          </div>
                          )}
                          
                          {bottomPanelTab === 'output' && (
                            <pre style={{ fontSize: 12, fontFamily: 'monospace' }}>
                              Build output will appear here...
                            </pre>
                          )}
                          
                          {bottomPanelTab === 'debug' && (
        <div>
                              <InputGroup placeholder="Debug command..." />
        </div>
                          )}
      </div>
    </div>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            <PanelResizeHandle style={{ width: 2, backgroundColor: 'var(--bp5-divider-black)' }} />

            {/* Right Panel */}
            {rightPanelVisible && (
              <Panel defaultSize={25} minSize={15} maxSize={40}>
                <div className="right-panel" style={{ height: '100%' }}>
                  <Tabs
                    id="right-tabs"
                    selectedTabId={rightPanelTab}
                    onChange={(tabId) => setRightPanelTab(tabId as string)}
                    vertical
                    large={false}
                  >
                    <Tab
                      id="search"
                      title="Search"
                      panel={
                        <Card style={{ margin: 8 }}>
                          <InputGroup
                            leftIcon="search"
                            placeholder="Search in files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          <div style={{ marginTop: 8 }}>
                            {searchResults.map((result, i) => (
                              <div key={i} style={{ padding: 4, borderBottom: '1px solid var(--bp5-divider-black)' }}>
                                <strong>{result.file}</strong>
                                <Tag minimal>{result.matches}</Tag>
                              </div>
                            ))}
                          </div>
                        </Card>
                      }
                    />
                    <Tab
                      id="git"
                      title="Git"
                      panel={
                        <Card style={{ margin: 8 }}>
                          <h5>Source Control</h5>
                          <div>
                            <h6>Changes</h6>
                            <div>No changes</div>
                          </div>
                        </Card>
                      }
                    />
                    <Tab
                      id="outline"
                      title="Outline"
                      panel={
                        <Card style={{ margin: 8 }}>
                          <h5>Outline</h5>
                          <Tree
                            contents={[
                              { id: '1', label: 'function main()', icon: 'function' },
                              { id: '2', label: 'class MyClass', icon: 'cube' }
                            ]}
                          />
                        </Card>
                      }
                    />
                    <Tab
                      id="extensions"
                      title="Extensions"
                      panel={
                        <Card style={{ margin: 8 }}>
                          <h5>Extensions</h5>
                          <div>No extensions installed</div>
                        </Card>
                      }
                    />
                    <Tab
                      id="debug"
                      title="Debug"
                      panel={
                        <Card style={{ margin: 8 }}>
                          <h5>Debug</h5>
                          <ButtonGroup vertical fill>
                            <Button icon="play" text="Start Debugging" />
                            <Button icon="stop" text="Stop" disabled />
                          </ButtonGroup>
                        </Card>
                      }
                    />
                  </Tabs>
      </div>
              </Panel>
            )}
          </PanelGroup>
            </div>

        {/* Bottom Panel Toggle */}
        {!bottomPanelVisible && (
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
            <Button
              icon="chevron-up"
              minimal
              small
              onClick={() => setBottomPanelVisible(true)}
            />
          </div>
        )}

        {/* Command Palette */}
        <Omnibar
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          items={[
            { id: 'save', text: 'Save File', icon: 'floppy-disk' as IconName },
            { id: 'open', text: 'Open File', icon: 'document-open' as IconName },
            { id: 'run', text: 'Run Tool', icon: 'play' as IconName },
            { id: 'stop', text: 'Stop Tool', icon: 'stop' as IconName },
            { id: 'settings', text: 'Open Settings', icon: 'cog' as IconName }
          ]}
          onItemSelect={(item) => {
            setCommandPaletteOpen(false)
            switch (item.id) {
              case 'save':
                if (activeTab) saveFile(activeTab.path, activeTab.content)
                break
              case 'run':
                runTool()
                break
              case 'stop':
                stopTool()
                break
            }
          }}
          itemRenderer={(item, { handleClick }) => (
            <MenuItem
              key={item.id}
              icon={item.icon}
              text={item.text}
              onClick={handleClick}
            />
          )}
        />
      </div>
    </HotkeysTarget2>
  )
}