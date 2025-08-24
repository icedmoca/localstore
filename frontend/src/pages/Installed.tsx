import { useEffect, useState } from 'react'
import { Button, Spinner, NonIdealState } from '@blueprintjs/core'
import api from '../api'
import type { Tool } from '../types'
import ToolCard from '../components/ToolCard'

export default function Installed() {
  const [tools, setTools] = useState<Tool[] | null>(null)

  async function load() {
    try {
      const t = await api.tools()
      setTools(t)
    } catch (error) {
      console.error('Failed to load installed tools:', error)
      window.__toast?.('Failed to load installed tools')
    }
  }
  
  useEffect(() => { load() }, [])

  if (!tools) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Spinner />
      </div>
    )
  }
  
  if (tools.length === 0) {
    return (
      <NonIdealState
        icon="applications"
        title="No tools installed"
        description="Install tools from the Marketplace to get started."
      />
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Installed Tools</h2>
        <Button icon="refresh" onClick={load}>Refresh</Button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {tools.map(t => (
          <ToolCard key={t.id} t={t} onChange={load} />
        ))}
      </div>
    </div>
  )
}
