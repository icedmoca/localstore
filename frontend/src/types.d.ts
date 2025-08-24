export interface Tool {
  id: string
  name: string
  description?: string
  status?: 'running' | 'stopped'
  port?: number | null
  path?: string
  venv?: string
  entry?: string
  autostart?: boolean
  python?: string
}

export interface RegistryItem {
  id: string
  name: string
  description?: string
  version?: string
  author?: string
  url?: string
  path?: string
  entry?: string
}

export interface Runtime {
  version: string
  path: string
  default: boolean
  managed: boolean
}

export interface FileNode {
  type: 'file' | 'dir'
  name: string
  path?: string
  children?: FileNode[]
}

export interface ToastItem {
  id: number
  text: string
}

declare global {
  interface HTMLInputElement {
    webkitdirectory?: boolean
  }
  
  interface Window {
    __toast?: (text: string) => void
  }
}

// Blueprint works natively with React 18+
