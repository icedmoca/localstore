import type { Tool, RegistryItem, Runtime } from './types'

const api = {
  async health(): Promise<{ ok: boolean }> {
    const r = await fetch('/api/health')
    if (!r.ok) throw new Error('Backend not healthy')
    return r.json()
  },
  
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
  },
  async runtimes(): Promise<Runtime[]> {
    const r = await fetch('/api/runtimes')
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async setDefaultRuntime(path: string): Promise<{ ok: boolean }> {
    const r = await fetch('/api/runtimes/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async updateTool(id: string, updates: Partial<Tool>): Promise<{ ok: boolean }> {
    const r = await fetch(`/api/tools/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  
  async addRuntime(data: { path: string; type: string }): Promise<Runtime> {
    const r = await fetch('/api/runtimes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  
  async downloadRuntime(data: { url: string; type: string }): Promise<{ ok: boolean }> {
    const r = await fetch('/api/runtimes/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async createFromFolder(data: { id: string; name: string; path: string; entry?: string }): Promise<Tool> {
    const r = await fetch('/api/tools/create/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async createFromGit(data: { id: string; name: string; repo: string; ref?: string; subdir?: string; entry?: string }): Promise<Tool> {
    const r = await fetch('/api/tools/create/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async createFromPip(data: { id: string; name: string; spec: string; entry: string }): Promise<Tool> {
    const r = await fetch('/api/tools/create/pip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async createFromTemplate(data: any): Promise<{ ok: boolean }> {
    const r = await fetch('/api/tools/create/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  }
}

export default api
