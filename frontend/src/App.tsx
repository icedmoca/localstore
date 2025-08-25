import { useState, useEffect, useRef } from 'react'
import { Router, Route, useLocation } from 'wouter'
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
import AddToolDialog from './pages/AddToolDialog'
import Runtimes from './pages/Runtimes'
import Settings from './pages/Settings'
import api from './api'

function AppContent() {
  const [location, setLocation] = useLocation()
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

  useEffect(() => {
    loadTools()
    // Check backend health
    api.health().catch(() => {
      setError('Backend is not responding. Make sure the server is running.')
    })
  }, [])

  const navButtons = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/runtimes', label: 'Runtimes', icon: 'code-block' },
    { path: '/settings', label: 'Settings', icon: 'cog' }
  ]

  const getBreadcrumbs = (): BreadcrumbProps[] => {
    if (location === '/') {
      return [
        { text: 'Dashboard', current: true },
        { text: 'Tools', current: true }
      ]
    } else if (location === '/runtimes') {
      return [
        { text: 'Runtimes', current: true },
        { text: 'List', current: true }
      ]
    } else if (location === '/settings') {
      return [
        { text: 'Settings', current: true }
      ]
    } else if (location.startsWith('/dev/')) {
      const toolId = location.split('/')[2] || 'Tool'
      const toolName = (tools || []).find?.((t:any) => t.id === toolId)?.name || toolId
      return [
        { text: 'Dashboard', href: '/', onClick: () => setLocation('/') },
        { text: toolName, href: `/edit/${toolId}`, onClick: () => setLocation(`/edit/${toolId}`) },
        { text: 'Development Mode', current: true }
      ]
    } else if (location.startsWith('/edit/')) {
      const toolId = location.split('/')[2] || 'Tool'
      const toolName = (tools || []).find?.((t:any) => t.id === toolId)?.name || toolId
      return [
        { text: 'Dashboard', href: '/', onClick: () => setLocation('/') },
        { text: toolName, href: `/edit/${toolId}`, onClick: () => setLocation(`/edit/${toolId}`) },
        { text: 'Edit Tool', current: true }
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
              active={location === btn.path || (btn.path !== '/' && location.startsWith(btn.path))}
              onClick={() => setLocation(btn.path)}
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

        <Route path="/">
          <Dashboard 
            tools={tools} 
            onRefresh={loadTools} 
            onAddTool={() => setShowAddDialog(true)}
            darkTheme={darkTheme}
            installProgress={installProgress}
            setInstallProgress={setInstallProgress}
          />
        </Route>
        <Route path="/dev/:id">
          <DevMode />
        </Route>
        <Route path="/edit/:id">
          <EditTool />
        </Route>
        <Route path="/runtimes">
          <Runtimes />
        </Route>
        <Route path="/settings">
          <Settings 
            darkTheme={darkTheme} 
            setDarkTheme={setDarkTheme} 
          />
        </Route>
      </div>
      
      {showAddDialog && <AddToolDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}
