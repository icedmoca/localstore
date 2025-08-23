import { useEffect, useMemo, useState } from 'preact/hooks'
import api, { RegistryItem, Tool } from '../api'
import ToolCard from '../components/ToolCard'
import Empty from '../components/Empty'

type Filter = 'all' | 'available' | 'installed' | 'running'

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
    if (!registry) return null
    const mapInstalled = new Map((installed||[]).map(t => [t.id, t]))
    return registry.map(r => ({ ...r, ...(mapInstalled.get(r.id)||{}) })) as Tool[]
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
    <div class="container" style={{paddingTop:16}}>
      <div class="row" style={{justifyContent:'space-between', marginBottom:12}}>
        <div class="search">
          <span>🔎</span>
          <input
            value={q}
            onInput={(e:any)=>setQ(e.currentTarget.value)}
            placeholder="Search tools (name, id, description)…"
            style={{flex:1, border:'none', outline:'none', background:'transparent', color:'var(--fg)'}}
          />
        </div>
        <button class="btn" onClick={load}>Refresh</button>
      </div>

      <div class="filters" style={{marginBottom:12}}>
        {(['all','available','installed','running'] as Filter[]).map(f =>
          <button key={f} class={'filter-chip ' + (filter===f?'active':'')} onClick={()=>setFilter(f)}>
            {f[0].toUpperCase()+f.slice(1)}
          </button>
        )}
      </div>

      {!filtered && (
        <div class="grid">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <Empty title="No tools match" subtitle="Try clearing filters or typing a different search." />
      )}

      {filtered && filtered.length > 0 && (
        <div class="grid">
          {filtered.map(t => <ToolCard key={t.id} t={t} onChange={load} />)}
        </div>
      )}

      <div style={{marginTop:18}} class="kv">Running locally — open tools via "Open" once started.</div>
    </div>
  )
}
