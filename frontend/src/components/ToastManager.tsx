import { Position, Toaster, Intent } from '@blueprintjs/core'

// Create a singleton toaster instance
const toaster = Toaster.create({
  position: Position.TOP,
  maxToasts: 3,
})

// Export toast functions for easy access
export const toast = {
  show: (message: string, intent?: Intent, timeout?: number) => {
    toaster.show({ message, intent, timeout })
  },
  success: (message: string, timeout = 3000) => {
    toaster.show({ message, intent: Intent.SUCCESS, icon: 'tick' as any, timeout })
  },
  error: (message: string, timeout = 5000) => {
    toaster.show({ message, intent: Intent.DANGER, icon: 'error' as any, timeout })
  },
  warning: (message: string, timeout = 4000) => {
    toaster.show({ message, intent: Intent.WARNING, icon: 'warning-sign' as any, timeout })
  },
  info: (message: string, timeout = 3000) => {
    toaster.show({ message, intent: Intent.PRIMARY, icon: 'info-sign' as any, timeout })
  },
  loading: (message: string): string => {
    return toaster.show({ 
      message, 
      intent: Intent.NONE, 
      icon: 'refresh' as any,
      timeout: 0  // No auto-dismiss
    })
  },
  dismiss: (key: string) => {
    toaster.dismiss(key)
  },
  clear: () => {
    toaster.clear()
  }
}

// Make toast globally available
if (typeof window !== 'undefined') {
  (window as any).__toast = toast.show
  ;(window as any).toast = toast
}
