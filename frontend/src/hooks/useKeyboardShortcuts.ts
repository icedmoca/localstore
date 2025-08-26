import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../components/ToastManager'

interface ShortcutHandler {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  handler: () => void
}

export function useKeyboardShortcuts(
  showAddDialog?: () => void,
  toggleTheme?: () => void,
  refreshTools?: () => void
) {
  const navigate = useNavigate()

  useEffect(() => {
    const shortcuts: ShortcutHandler[] = [
      {
        key: 'n',
        ctrl: true,
        description: 'Create new tool',
        handler: () => {
          if (showAddDialog) {
            showAddDialog()
            toast.info('Opening new tool dialog...')
          }
        }
      },
      {
        key: 'd',
        ctrl: true,
        description: 'Go to Dashboard',
        handler: () => {
          navigate('/')
          toast.info('Navigating to Dashboard')
        }
      },
      {
        key: 'i',
        ctrl: true,
        description: 'Go to Installed Tools',
        handler: () => {
          navigate('/installed')
          toast.info('Navigating to Installed Tools')
        }
      },
      {
        key: 'm',
        ctrl: true,
        description: 'Go to Marketplace',
        handler: () => {
          navigate('/marketplace')
          toast.info('Navigating to Marketplace')
        }
      },
      {
        key: 's',
        ctrl: true,
        description: 'Go to Settings',
        handler: () => {
          navigate('/settings')
          toast.info('Navigating to Settings')
        }
      },
      {
        key: 'r',
        ctrl: true,
        shift: true,
        description: 'Refresh tools',
        handler: () => {
          if (refreshTools) {
            refreshTools()
            toast.info('Refreshing tools...')
          }
        }
      },
      {
        key: 't',
        ctrl: true,
        shift: true,
        description: 'Toggle theme',
        handler: () => {
          if (toggleTheme) {
            toggleTheme()
            toast.info('Theme toggled')
          }
        }
      },
      {
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        handler: () => {
          const shortcutList = shortcuts
            .map(s => {
              const keys = []
              if (s.ctrl) keys.push('Ctrl')
              if (s.shift) keys.push('Shift')
              if (s.alt) keys.push('Alt')
              keys.push(s.key.toUpperCase())
              return `${keys.join('+')} - ${s.description}`
            })
            .join('\n')
          
          toast.show(`Keyboard Shortcuts:\n${shortcutList}`, undefined, 10000)
        }
      }
    ]

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          (e.target as any)?.contentEditable === 'true') {
        return
      }

      const shortcut = shortcuts.find(s => {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const ctrlMatch = !s.ctrl || e.ctrlKey || e.metaKey
        const shiftMatch = !s.shift || e.shiftKey
        const altMatch = !s.alt || e.altKey
        
        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (shortcut) {
        e.preventDefault()
        shortcut.handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, showAddDialog, toggleTheme, refreshTools])
}
