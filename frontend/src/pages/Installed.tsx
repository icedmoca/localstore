import { useEffect, useMemo, useState } from 'preact/hooks'
import api, { Tool } from '../api'
import ToolCard from '../components/ToolCard'
import Empty from '../components/Empty'

export default function Installed() {
  const [items, setItems] = useState<Tool[]|null>(null)
  const load = () => api.tools().then(setItems)
  useEffect(() => { load() }, [])

  const running = useMemo(()=> (items||[]).filter(t=>t.status==='running').length, [items])

  return (
    <div class="container" style={{paddingTop:16}}>
      <div class="row" style={{justifyContent:'space-between', marginBottom:12}}>
        <div class="kv">{items ? `${items.length} installed • ${running} running` : '—'}</div>
        <button class="btn" onClick={load}>Refresh</button>
      </div>

      {!items && (
        <div class="grid">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      )}

      {items && items.length === 0 && <Empty title="Nothing installed yet" subtitle="Go to Marketplace to install your first tool." />}

      {items && items.length > 0 && (
        <div class="grid">
          {items.map(t => <ToolCard key={t.id} t={t} onChange={load} />)}
        </div>
      )}
    </div>
  )
}
