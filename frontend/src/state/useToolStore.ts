import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Tool } from '../types'

// File system state
interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
}

interface EditorTab {
  id: string
  title: string
  path: string
  content: string
  isDirty: boolean
  language: string
}

// Simple store with basic state management
interface ToolStore {
  // Tool slice
  currentTool: Tool | null
  tools: Tool[]
  setCurrentTool: (tool: Tool | null) => void
  setTools: (tools: Tool[]) => void
  updateTool: (toolId: string, updates: Partial<Tool>) => void

  // Files slice
  fileTree: FileNode[]
  expandedNodes: string[]
  selectedNode: string
  setFileTree: (tree: FileNode[]) => void
  toggleNodeExpansion: (nodeId: string) => void
  setSelectedNode: (nodeId: string) => void

  // Editor slice
  editorTabs: EditorTab[]
  activeTabId: string
  autoSaveEnabled: boolean
  addTab: (tab: EditorTab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  markTabClean: (tabId: string) => void
  setAutoSave: (enabled: boolean) => void
  closeAllTabs: () => void

  // Run status slice
  runStatus: 'stopped' | 'running' | 'starting' | 'stopping'
  runPort: number | null
  runLogs: string[]
  setRunStatus: (status: 'stopped' | 'running' | 'starting' | 'stopping') => void
  setRunPort: (port: number | null) => void
  addRunLog: (log: string) => void
  clearRunLogs: () => void

  // UI Layout slice
  leftPanelWidth: number
  rightPanelWidth: number
  bottomPanelHeight: number
  rightPanelVisible: boolean
  bottomPanelVisible: boolean
  rightPanelTab: string
  bottomPanelTab: string
  theme: 'light' | 'dark'
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setBottomPanelHeight: (height: number) => void
  setRightPanelVisible: (visible: boolean) => void
  setBottomPanelVisible: (visible: boolean) => void
  setRightPanelTab: (tab: string) => void
  setBottomPanelTab: (tab: string) => void
  setTheme: (theme: 'light' | 'dark') => void
}

// Create the store
export const useToolStore = create<ToolStore>()(
  persist(
    (set, get) => ({
      // Tool slice
      currentTool: null,
      tools: [],
      setCurrentTool: (tool) => set({ currentTool: tool }),
      setTools: (tools) => set({ tools }),
      updateTool: (toolId, updates) => set((state) => {
        const newTools = state.tools.map(t => 
          t.id === toolId ? { ...t, ...updates } : t
        )
        return {
          tools: newTools,
          currentTool: state.currentTool?.id === toolId 
            ? { ...state.currentTool, ...updates } 
            : state.currentTool
        }
      }),

      // Files slice
      fileTree: [],
      expandedNodes: [],
      selectedNode: '',
      setFileTree: (tree) => set({ fileTree: tree }),
      toggleNodeExpansion: (nodeId) => set((state) => ({
        expandedNodes: state.expandedNodes.includes(nodeId)
          ? state.expandedNodes.filter(id => id !== nodeId)
          : [...state.expandedNodes, nodeId]
      })),
      setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

      // Editor slice
      editorTabs: [],
      activeTabId: '',
      autoSaveEnabled: true,
      addTab: (tab) => set((state) => {
        const existingIndex = state.editorTabs.findIndex(t => t.path === tab.path)
        if (existingIndex !== -1) {
          return { activeTabId: state.editorTabs[existingIndex].id }
        }
        return {
          editorTabs: [...state.editorTabs, tab],
          activeTabId: tab.id
        }
      }),
      removeTab: (tabId) => set((state) => {
        const newTabs = state.editorTabs.filter(t => t.id !== tabId)
        let newActiveTabId = state.activeTabId
        
        if (state.activeTabId === tabId && newTabs.length > 0) {
          newActiveTabId = newTabs[0].id
        } else if (newTabs.length === 0) {
          newActiveTabId = ''
        }
        
        return {
          editorTabs: newTabs,
          activeTabId: newActiveTabId
        }
      }),
      setActiveTab: (tabId) => set({ activeTabId: tabId }),
      updateTabContent: (tabId, content) => set((state) => ({
        editorTabs: state.editorTabs.map(tab =>
          tab.id === tabId
            ? { ...tab, content, isDirty: true }
            : tab
        )
      })),
      markTabClean: (tabId) => set((state) => ({
        editorTabs: state.editorTabs.map(tab =>
          tab.id === tabId ? { ...tab, isDirty: false } : tab
        )
      })),
      setAutoSave: (enabled) => set({ autoSaveEnabled: enabled }),
      closeAllTabs: () => set({ editorTabs: [], activeTabId: '' }),

      // Run status slice
      runStatus: 'stopped',
      runPort: null,
      runLogs: [],
      setRunStatus: (status) => set({ runStatus: status }),
      setRunPort: (port) => set({ runPort: port }),
      addRunLog: (log) => set((state) => ({
        runLogs: [...state.runLogs, log].slice(-1000) // Keep last 1000 logs
      })),
      clearRunLogs: () => set({ runLogs: [] }),

      // UI Layout slice
      leftPanelWidth: 250,
      rightPanelWidth: 250,
      bottomPanelHeight: 300,
      rightPanelVisible: true,
      bottomPanelVisible: true,
      rightPanelTab: 'search',
      bottomPanelTab: 'terminal',
      theme: 'dark',
      setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
      setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),
      setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
      setTheme: (theme) => set((state) => {
        // Apply theme to document
        if (theme === 'dark') {
          document.body.classList.add('bp5-dark')
          document.documentElement.classList.add('bp5-dark')
        } else {
          document.body.classList.remove('bp5-dark')
          document.documentElement.classList.remove('bp5-dark')
        }
        localStorage.setItem('theme', theme)
        return { theme }
      })
    }),
    {
      name: 'localstore-tool-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist UI layout and theme settings
      partialize: (state) => ({
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        bottomPanelHeight: state.bottomPanelHeight,
        rightPanelVisible: state.rightPanelVisible,
        bottomPanelVisible: state.bottomPanelVisible,
        rightPanelTab: state.rightPanelTab,
        bottomPanelTab: state.bottomPanelTab,
        theme: state.theme,
        autoSaveEnabled: state.autoSaveEnabled,
        expandedNodes: state.expandedNodes
      })
    }
  )
)

// Selectors for common use cases
export const useCurrentTool = () => useToolStore(state => state.currentTool)
export const useEditorTabs = () => useToolStore(state => state.editorTabs)
export const useActiveTab = () => useToolStore(state => {
  const tabs = state.editorTabs
  const activeId = state.activeTabId
  return tabs.find(tab => tab.id === activeId) || null
})
export const useRunStatus = () => useToolStore(state => ({
  status: state.runStatus,
  port: state.runPort,
  logs: state.runLogs
}))
export const useUILayout = () => useToolStore(state => ({
  leftPanelWidth: state.leftPanelWidth,
  rightPanelWidth: state.rightPanelWidth,
  bottomPanelHeight: state.bottomPanelHeight,
  rightPanelVisible: state.rightPanelVisible,
  bottomPanelVisible: state.bottomPanelVisible,
  rightPanelTab: state.rightPanelTab,
  bottomPanelTab: state.bottomPanelTab,
  theme: state.theme
}))

// Utility functions
export const getDirtyTabs = () => {
  const tabs = useToolStore.getState().editorTabs
  return tabs.filter(tab => tab.isDirty)
}

export const hasUnsavedChanges = () => {
  return getDirtyTabs().length > 0
}