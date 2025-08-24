import { useEffect, useMemo, useState } from 'react'
import { Button, InputGroup, Card, Tag, Spinner, NonIdealState } from '@blueprintjs/core'
import api from '../api'
import type { RegistryItem, Tool } from '../types'
import ToolCard from '../components/ToolCard'

type Filter = 'all' | 'available' | 'installed' | 'running'

interface MergedTool extends RegistryItem {
  status?: string
  port?: number | null
}

export default function Marketplace() {
  const [registry, setRegistry] = useState<RegistryItem[]|null>(null)
  const [installed, setInstalled] = useState<Tool[]|null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  async function load() {
    const [reg, inst] = await Promise.all([api.registry(), api.tools()])
    setRegistry(reg); setInstalled(inst)
  }
  useEffect(() => { load() }, [])

  const merged = useMemo(() => {
    if (!registry || !installed) return null
    
    // Create a map of installed tools by ID
    const installedMap = new Map(installed.map(t => [t.id, t]))
    
    // Merge registry with installed status
    const merged: MergedTool[] = registry.map(item => ({
      ...item,
      status: installedMap.get(item.id)?.status,
      port: installedMap.get(item.id)?.port
    }))
    
    return merged
  }, [registry, installed])

  const filtered = useMemo(() => {
    if (!merged) return null
    let out = merged
    const s = q.trim().toLowerCase()
    if (s) out = out.filter(t =>
      (t.name||'').toLowerCase().includes(s) ||
      (t.id||'').toLowerCase().includes(s) ||
      (t.description||'').toLowerCase().includes(s)
    )
    if (filter === 'available') out = out.filter(t => t.status === undefined)
    if (filter === 'installed') out = out.filter(t => t.status === 'stopped')
    if (filter === 'running') out = out.filter(t => t.status === 'running')
    return out
  }, [merged, q, filter])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <InputGroup
          leftIcon="search"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search tools (name, id, description)..."
          style={{ maxWidth: 400 }}
        />
        <Button icon="refresh" onClick={load}>Refresh</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'available', 'installed', 'running'] as Filter[]).map(f => (
          <Button
            key={f}
            small
            minimal={filter !== f}
            intent={filter === f ? 'primary' : 'none'}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {!filtered && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <Card key={i} style={{ height: 200 }}>
              <Spinner />
            </Card>
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <NonIdealState
          icon="search"
          title="No tools match"
          description="Try clearing filters or typing a different search."
        />
      )}

      {filtered && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {filtered.map(t => (
            <ToolCard key={t.id} t={t as Tool} onChange={load} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 30, textAlign: 'center', color: 'var(--bp5-text-color-muted)' }}>
        Running locally — open tools via "Open" once started.
      </div>
    </div>
  )
}
