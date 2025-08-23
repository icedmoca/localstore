import { Link, Route } from 'wouter-preact'
import Header from './components/Header'
import Marketplace from './pages/Marketplace'
import Installed from './pages/Installed'
import ToolDevEntry from './pages/ToolDevEntry'
import { useEffect, useState } from 'preact/hooks'
import Toast, { ToastItem } from './components/Toast'

export function App() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    (window as any).__toast = (text:string) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t, { id, text }])
    }
  }, [])
  const dismiss = (id:number) => setToasts(t => t.filter(x=>x.id!==id))

  return (
    <div>
      <Header />
      <Route path="/"><Marketplace /></Route>
      <Route path="/installed"><Installed /></Route>
      <Route path="/dev/:id"><ToolDevEntry /></Route>
      <Toast items={toasts} onDismiss={dismiss} />
    </div>
  )
}
