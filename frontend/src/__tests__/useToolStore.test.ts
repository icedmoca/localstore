import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useToolStore } from '../state/useToolStore'

describe('useToolStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useToolStore.getState().setTools([])
    useToolStore.getState().closeAllTabs()
    useToolStore.getState().setCurrentTool(null)
  })

  describe('tool management', () => {
    it('should set and get current tool', () => {
      const { result } = renderHook(() => useToolStore())
      
      const testTool = {
        id: 'test-tool',
        name: 'Test Tool',
        description: 'A test tool'
      }

      act(() => {
        result.current.setCurrentTool(testTool)
      })

      expect(result.current.currentTool).toEqual(testTool)
    })

    it('should update tool in tools list', () => {
      const { result } = renderHook(() => useToolStore())
      
      const testTool = {
        id: 'test-tool',
        name: 'Test Tool',
        description: 'A test tool'
      }

      act(() => {
        result.current.setTools([testTool])
        result.current.updateTool('test-tool', { name: 'Updated Tool' })
      })

      expect(result.current.tools[0].name).toBe('Updated Tool')
    })
  })

  describe('editor tabs', () => {
    it('should add and manage editor tabs', () => {
      const { result } = renderHook(() => useToolStore())
      
      const testTab = {
        id: 'tab-1',
        title: 'test.py',
        path: '/test.py',
        content: 'print("hello")',
        isDirty: false,
        language: 'python'
      }

      act(() => {
        result.current.addTab(testTab)
      })

      expect(result.current.editorTabs).toHaveLength(1)
      expect(result.current.activeTabId).toBe('tab-1')
    })

    it('should not add duplicate tabs with same path', () => {
      const { result } = renderHook(() => useToolStore())
      
      const testTab = {
        id: 'tab-1',
        title: 'test.py',
        path: '/test.py',
        content: 'print("hello")',
        isDirty: false,
        language: 'python'
      }

      const duplicateTab = {
        id: 'tab-2',
        title: 'test.py',
        path: '/test.py',
        content: 'print("world")',
        isDirty: false,
        language: 'python'
      }

      act(() => {
        result.current.addTab(testTab)
        result.current.addTab(duplicateTab)
      })

      expect(result.current.editorTabs).toHaveLength(1)
      expect(result.current.activeTabId).toBe('tab-1')
    })

    it('should remove tabs correctly', () => {
      const { result } = renderHook(() => useToolStore())
      
      const tab1 = {
        id: 'tab-1',
        title: 'test1.py',
        path: '/test1.py',
        content: 'print("hello")',
        isDirty: false,
        language: 'python'
      }

      const tab2 = {
        id: 'tab-2',
        title: 'test2.py',
        path: '/test2.py',
        content: 'print("world")',
        isDirty: false,
        language: 'python'
      }

      act(() => {
        result.current.addTab(tab1)
        result.current.addTab(tab2)
        result.current.removeTab('tab-1')
      })

      expect(result.current.editorTabs).toHaveLength(1)
      expect(result.current.activeTabId).toBe('tab-2')
    })

    it('should update tab content and mark as dirty', () => {
      const { result } = renderHook(() => useToolStore())
      
      const testTab = {
        id: 'tab-1',
        title: 'test.py',
        path: '/test.py',
        content: 'print("hello")',
        isDirty: false,
        language: 'python'
      }

      act(() => {
        result.current.addTab(testTab)
        result.current.updateTabContent('tab-1', 'print("world")')
      })

      const updatedTab = result.current.editorTabs.find(t => t.id === 'tab-1')
      expect(updatedTab?.content).toBe('print("world")')
      expect(updatedTab?.isDirty).toBe(true)
    })
  })

  describe('UI layout', () => {
    it('should manage panel visibility', () => {
      const { result } = renderHook(() => useToolStore())
      
      act(() => {
        result.current.setRightPanelVisible(false)
        result.current.setBottomPanelVisible(false)
      })

      expect(result.current.rightPanelVisible).toBe(false)
      expect(result.current.bottomPanelVisible).toBe(false)
    })

    it('should manage panel tabs', () => {
      const { result } = renderHook(() => useToolStore())
      
      act(() => {
        result.current.setRightPanelTab('git')
        result.current.setBottomPanelTab('problems')
      })

      expect(result.current.rightPanelTab).toBe('git')
      expect(result.current.bottomPanelTab).toBe('problems')
    })

    it('should manage theme', () => {
      const { result } = renderHook(() => useToolStore())
      
      act(() => {
        result.current.setTheme('light')
      })

      expect(result.current.theme).toBe('light')
      expect(localStorage.getItem('theme')).toBe('light')
    })
  })

  describe('run status', () => {
    it('should manage run status and logs', () => {
      const { result } = renderHook(() => useToolStore())
      
      act(() => {
        result.current.setRunStatus('running')
        result.current.setRunPort(8000)
        result.current.addRunLog('Server started')
        result.current.addRunLog('Listening on port 8000')
      })

      expect(result.current.runStatus).toBe('running')
      expect(result.current.runPort).toBe(8000)
      expect(result.current.runLogs).toHaveLength(2)
      expect(result.current.runLogs).toContain('Server started')
    })

    it('should clear logs', () => {
      const { result } = renderHook(() => useToolStore())
      
      act(() => {
        result.current.addRunLog('Log entry 1')
        result.current.addRunLog('Log entry 2')
        result.current.clearRunLogs()
      })

      expect(result.current.runLogs).toHaveLength(0)
    })
  })
})
