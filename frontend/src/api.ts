export type Tool = {
  id: string
  name: string
  description?: string
  status?: 'running' | 'stopped'
  port?: number | null
  path?: string
  venv?: string
  entry?: string
}

export type RegistryItem = {
  id: string
  name: string
  description?: string
  version?: string
  author?: string
  url?: string
}

const api = {
  async registry(): Promise<RegistryItem[]> {
    const r = await fetch('/api/registry')
    return r.json()
  },
  async tools(): Promise<Tool[]> {
    const r = await fetch('/api/tools')
    return r.json()
  },
  async install(id: string): Promise<Tool> {
    const r = await fetch('/api/tools/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async start(id: string): Promise<{ id: string; status: string; port: number | null }> {
    const r = await fetch(`/api/tools/${id}/start`, { 
      method: 'POST'
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async stop(id: string): Promise<{ id: string; status: string; port: number | null }> {
    const r = await fetch(`/api/tools/${id}/stop`, { 
      method: 'POST'
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async uninstall(id: string): Promise<{ ok: boolean }> {
    const r = await fetch(`/api/tools/${id}`, { 
      method: 'DELETE'
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  }
}

export default api
