import { useState, useEffect, useRef } from 'react'
import { Router, Route, useLocation } from 'wouter'
import { 
  Button, 
  Navbar, 
  NavbarGroup, 
  NavbarHeading, 
  Tab, 
  Tabs
} from '@blueprintjs/core'
import Dashboard from './pages/Dashboard'
import AddToolDialog from './pages/AddToolDialog'
import Runtimes from './pages/Runtimes'
import Settings from './pages/Settings'

function AppContent() {
  const [location, setLocation] = useLocation()
  const [darkTheme, setDarkTheme] = useState(localStorage.getItem('theme') === 'dark')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [tools, setTools] = useState(null)

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
      }
    } catch (error) {
      console.error('Failed to load tools:', error)
    }
  }

  useEffect(() => {
    loadTools()
  }, [])

  const getActiveTabFromPath = (path: string) => {
    if (path.startsWith('/runtimes')) return 'runtimes'
    if (path.startsWith('/settings')) return 'settings'
    return 'dashboard'
  }

  const activeTab = getActiveTabFromPath(location)

  const handleTabChange = (newTabId: string) => {
    const routes = {
      dashboard: '/',
      runtimes: '/runtimes',
      settings: '/settings'
    }
    setLocation(routes[newTabId as keyof typeof routes] || '/')
  }

  return (
    <div>
      <Navbar>
        <NavbarGroup>
          <NavbarHeading>LocalStore</NavbarHeading>
        </NavbarGroup>
        <NavbarGroup align="right">
          <Button
            icon="refresh"
            text="Refresh"
            onClick={loadTools}
          />
        </NavbarGroup>
      </Navbar>

      <div style={{ padding: '20px' }}>
        <Tabs
          id="main-tabs"
          selectedTabId={activeTab}
          onChange={handleTabChange}
        >
          <Tab id="dashboard" title="Dashboard" />
          <Tab id="runtimes" title="Runtimes" />
          <Tab id="settings" title="Settings" />
        </Tabs>

        <div style={{ marginTop: '20px' }}>
          <Route path="/">
            <Dashboard 
              tools={tools} 
              onRefresh={loadTools} 
              onAddTool={() => setShowAddDialog(true)}
              darkTheme={darkTheme}
            />
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
