import { useEffect, useState } from 'react'
import { Button, Card, Spinner, NonIdealState } from '@blueprintjs/core'
import api from '../api'
import type { Tool } from '../types'
import ToolCard from '../components/ToolCard'

interface DashboardProps {
  tools: Tool[] | null
  onRefresh: () => void
  onAddTool: () => void
  darkTheme: boolean
}

export default function Dashboard({ tools, onRefresh, onAddTool, darkTheme }: DashboardProps) {
  const [localTools, setLocalTools] = useState<Tool[] | null>(tools)

  useEffect(() => {
    if (!localTools) {
      loadTools()
    }
  }, [localTools])

  async function loadTools() {
    try {
      const data = await api.tools()
      setLocalTools(data)
    } catch (error) {
      console.error('Failed to load tools:', error)
      setLocalTools([])
    }
  }

  const handleToolChange = () => {
    loadTools()
    onRefresh()
  }

  if (localTools === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {/* Create Tool Card */}
        <Card 
          className="bp5-elevation-0 create-tool-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '200px',
            cursor: 'pointer',
            border: '2px dashed #137CBD',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease',
          }}
          onClick={onAddTool}
        >
          <div 
            className="create-tool-icon"
            style={{ 
              fontSize: '48px', 
              color: '#137CBD', 
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
              color: '#137CBD',
              textAlign: 'center',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            Create Tool
          </h3>
          <p 
            className="create-tool-description"
            style={{ 
              margin: '8px 0 0 0', 
              color: '#5C7080',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            Add a new tool to your dashboard
          </p>
        </Card>

        {/* Existing Tools */}
        {localTools.map(tool => (
          <ToolCard 
            key={tool.id} 
            t={tool} 
            onChange={handleToolChange} 
          />
        ))}
      </div>

      {localTools.length === 0 && (
        <div style={{ marginTop: '40px' }}>
          <NonIdealState
            icon="applications"
            title="No tools installed"
            description="Click the 'Create Tool' card above to add your first tool, or install tools from the marketplace."
            action={
              <Button
                intent="primary"
                icon="plus"
                onClick={onAddTool}
              >
                Create Your First Tool
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}
