import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { 
  Button, 
  Navbar, 
  NavbarGroup, 
  NavbarHeading,
  NavbarDivider,
  Alignment,
  Callout,
  Breadcrumbs,
  BreadcrumbProps
} from '@blueprintjs/core'
import Dashboard from './pages/Dashboard'
import DevMode from './pages/DevMode'
import EditTool from './pages/EditTool'
import ToolWizard from './components/ToolWizard'
import Runtimes from './pages/Runtimes'
import Settings from './pages/Settings'
import Preview from './pages/Preview'
import NotFound from './components/NotFound'
import ToolSettingsPage from './features/settings/ToolSettingsPage'
import api from './api'
import './components/ToastManager'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [darkTheme, setDarkTheme] = useState(localStorage.getItem('theme') === 'dark')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [tools, setTools] = useState(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<Record<string, { progress: number, intent: string }>>({})

  // Clean up completed installations after 3 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    Object.entries(installProgress).forEach(([toolId, state]) => {
      if (state.intent === 'success') {
        const timer = setTimeout(() => {
          setInstallProgress(prev => {
            const newState = { ...prev }
            delete newState[toolId]
            return newState
          })
        }, 3000)
        timers.push(timer)
      }
    })
    return () => timers.forEach(clearTimeout)
  }, [installProgress])

  useEffect(() => {
    // Apply dark theme to both body and html for complete coverage
    if (darkTheme) {
      document.body.classList.add('bp5-dark')
      document.documentElement.classList.add('bp5-dark')
    } else {
      document.body.classList.remove('bp5-dark')
      document.documentElement.classList.remove('bp5-dark')
    }
    localStorage.setItem('theme', darkTheme ? 'dark' : 'light')
  }, [darkTheme])

  const loadTools = async () => {
    try {
      const response = await fetch('/api/tools')
      if (response.ok) {
        const data = await response.json()
        setTools(data)
      } else {
        setError('Failed to load tools')
      }
    } catch (error) {
      console.error('Failed to load tools:', error)
      setError('Failed to connect to backend')
    }
  }

  const toggleTheme = () => {
    setDarkTheme(prev => !prev)
  }

  // Setup keyboard shortcuts
  useKeyboardShortcuts(
    () => setShowAddDialog(true),
    toggleTheme,
    loadTools
  )

  useEffect(() => {
    loadTools()
    // Check backend health
    api.health().catch(() => {
      setError('Backend is not responding. Make sure the server is running.')
    })
  }, [])

  const navButtons = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/runtimes', label: 'Runtimes', icon: 'code-block' },
    { path: '/settings', label: 'Settings', icon: 'cog' }
  ]

  const getBreadcrumbs = (): BreadcrumbProps[] => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      return [
        { text: 'Dashboard', current: true },
        { text: 'Tools', current: true }
      ]
    } else if (location.pathname === '/runtimes') {
      return [
        { text: 'Runtimes', current: true },
        { text: 'List', current: true }
      ]
    } else if (location.pathname === '/settings') {
      return [
        { text: 'Settings', current: true }
      ]
    } else if (location.pathname.startsWith('/dev/')) {
      const toolId = location.pathname.split('/')[2] || 'Tool'
      const toolName = (tools || []).find?.((t:any) => t.id === toolId)?.name || toolId
      return [
        { text: 'Dashboard', href: '/dashboard', onClick: () => navigate('/dashboard') },
        { text: toolName, href: `/tools/${toolId}/edit`, onClick: () => navigate(`/tools/${toolId}/edit`) },
        { text: 'Development Mode', current: true }
      ]
    } else if (location.pathname.startsWith('/tools/')) {
      const pathParts = location.pathname.split('/')
      const toolId = pathParts[2] || 'Tool'
      const page = pathParts[3] || 'edit'
      const toolName = (tools || []).find?.((t:any) => t.id === toolId)?.name || toolId
      return [
        { text: 'Dashboard', href: '/dashboard', onClick: () => navigate('/dashboard') },
        { text: toolName, href: `/tools/${toolId}/edit`, onClick: () => navigate(`/tools/${toolId}/edit`) },
        { text: page === 'edit' ? 'Edit Tool' : page === 'settings' ? 'Settings' : 'Preview', current: true }
      ]
    }
    return []
  }

  return (
    <div>
      <Navbar>
        <NavbarGroup align={Alignment.LEFT}>
          <NavbarHeading>LocalStore</NavbarHeading>
          <NavbarDivider />
          {navButtons.map(btn => (
            <Button
              key={btn.path}
              variant="minimal"
              icon={btn.icon as any}
              text={btn.label}
              active={location.pathname === btn.path || (btn.path !== '/' && location.pathname.startsWith(btn.path))}
              onClick={() => navigate(btn.path)}
            />
          ))}
        </NavbarGroup>
        <NavbarGroup align={Alignment.RIGHT}>
          <Button
            variant="minimal"
            icon="plus"
            text="Add Tool"
            onClick={() => setShowAddDialog(true)}
          />
          <Button
            variant="minimal"
            icon="refresh"
            text="Refresh"
            onClick={loadTools}
          />
        </NavbarGroup>
      </Navbar>

      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bp5-divider-black)' }}>
        <Breadcrumbs items={getBreadcrumbs()} />
      </div>

      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {error && (
          <Callout intent="danger" style={{ marginBottom: 20, position: 'relative' }}>
            {error}
            <Button
              variant="minimal"
              size="small"
              icon="cross"
              onClick={() => setError(null)}
              style={{ position: 'absolute', top: 8, right: 8 }}
            />
          </Callout>
        )}
        
        {info && (
          <Callout intent="primary" style={{ marginBottom: 20, position: 'relative' }}>
            {info}
            <Button
              variant="minimal"
              size="small"
              icon="cross"
              onClick={() => setInfo(null)}
              style={{ position: 'absolute', top: 8, right: 8 }}
            />
          </Callout>
        )}

        <Routes>
          <Route path="/" element={
            <Dashboard 
              tools={tools} 
              onRefresh={loadTools} 
              onAddTool={() => setShowAddDialog(true)}
              darkTheme={darkTheme}
              installProgress={installProgress}
              setInstallProgress={setInstallProgress}
            />
          } />
          <Route path="/dashboard" element={
            <Dashboard 
              tools={tools} 
              onRefresh={loadTools} 
              onAddTool={() => setShowAddDialog(true)}
              darkTheme={darkTheme}
              installProgress={installProgress}
              setInstallProgress={setInstallProgress}
            />
          } />
          <Route path="/tools/:toolId/edit" element={<EditTool />} />
          <Route path="/tools/:toolId/settings" element={<ToolSettingsPage />} />
          <Route path="/tools/:toolId/preview" element={<Preview />} />
          <Route path="/dev/:id" element={<DevMode />} />
          <Route path="/edit/:id" element={<EditTool />} />
          <Route path="/runtimes" element={<Runtimes />} />
          <Route path="/settings" element={
            <Settings 
              darkTheme={darkTheme} 
              setDarkTheme={setDarkTheme} 
            />
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      
      {showAddDialog && <ToolWizard isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onSuccess={loadTools} />}
    </div>
  )
}

export default function App() {
  return <AppContent />
}
