import { useEffect, useState, useMemo } from 'react'
import { Button, Card, Spinner, NonIdealState, InputGroup } from '@blueprintjs/core'
import api from '../api'
import type { Tool, RegistryItem } from '../types'
import ToolCard from '../components/ToolCard'

interface DashboardProps {
  tools: Tool[] | null
  onRefresh: () => void
  onAddTool: () => void
  darkTheme: boolean
  installProgress: Record<string, { progress: number, intent: string }>
  setInstallProgress: React.Dispatch<React.SetStateAction<Record<string, { progress: number, intent: string }>>>
}

interface MergedTool extends RegistryItem {
  status?: 'running' | 'stopped'
  port?: number | null
  path?: string
  venv?: string
  entry?: string
  autostart?: boolean
  python?: string
}

export default function Dashboard({ tools, onRefresh, onAddTool, darkTheme, installProgress, setInstallProgress }: DashboardProps) {
  const [localTools, setLocalTools] = useState<Tool[] | null>(tools)
  const [registry, setRegistry] = useState<RegistryItem[] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [toolsData, registryData] = await Promise.all([
        api.tools(),
        api.registry()
      ])
      setLocalTools(toolsData)
      setRegistry(registryData)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLocalTools([])
      setRegistry([])
    }
  }

  const handleToolChange = () => {
    loadData()
    onRefresh()
  }

  const mergedTools = useMemo(() => {
    if (!registry || !localTools) return null
    
    // Create a map of installed tools by ID
    const installedMap = new Map(localTools.map(t => [t.id, t]))
    
    // Merge registry with installed status
    const merged: MergedTool[] = registry.map(item => ({
      ...item,
      ...installedMap.get(item.id)
    }))
    
    // Add any installed tools not in registry
    localTools.forEach(tool => {
      if (!registry.find(r => r.id === tool.id)) {
        merged.push(tool as MergedTool)
      }
    })
    
    return merged
  }, [registry, localTools])

  const filteredTools = useMemo(() => {
    if (!mergedTools) return null
    if (!searchQuery.trim()) return mergedTools
    
    const query = searchQuery.toLowerCase()
    return mergedTools.filter(t => 
      (t.name || '').toLowerCase().includes(query) ||
      (t.id || '').toLowerCase().includes(query) ||
      (t.description || '').toLowerCase().includes(query)
    )
  }, [mergedTools, searchQuery])

  if (!filteredTools) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <InputGroup
          leftIcon="search"
          placeholder="Search tools by name, ID, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 500 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {/* Add Tool Card */}
        <Card 
          className="bp5-elevation-0 create-tool-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '200px',
            cursor: 'pointer',
            border: '2px dashed var(--primary-color)',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease',
          }}
          onClick={onAddTool}
        >
          <div 
            className="create-tool-icon"
            style={{ 
              fontSize: '48px', 
              color: 'var(--primary-color)', 
              marginBottom: '16px',
              fontWeight: 'bold'
            }}
          >
            +
          </div>
          <h3 
            className="create-tool-title"
            style={{ 
              margin: 0, 
              color: 'var(--primary-color)',
              textAlign: 'center',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            Add Tool
          </h3>
          <p 
            className="create-tool-description"
            style={{ 
              margin: '8px 0 0 0', 
              color: 'var(--bp5-text-color-muted)',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            Add a new tool to your dashboard
          </p>
        </Card>

        {/* All Tools (Registry + Installed) */}
        {filteredTools.map(tool => (
          <ToolCard 
            key={tool.id} 
            t={tool as Tool} 
            onChange={handleToolChange}
            installProgress={installProgress[tool.id]}
            setInstallProgress={(progress, intent) => {
              if (progress === null) {
                setInstallProgress(prev => {
                  const newState = { ...prev }
                  delete newState[tool.id]
                  return newState
                })
              } else {
                setInstallProgress(prev => ({
                  ...prev,
                  [tool.id]: { progress, intent }
                }))
              }
            }}
          />
        ))}
      </div>

      {filteredTools.length === 0 && searchQuery && (
        <div style={{ marginTop: '40px' }}>
          <NonIdealState
            icon="search"
            title="No tools found"
            description={`No tools match "${searchQuery}". Try a different search term.`}
            action={
              <Button onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}
