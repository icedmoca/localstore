import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
// Blueprint v5 CSS imports as per documentation
import "normalize.css"
import "@blueprintjs/core/lib/css/blueprint.css"
import "@blueprintjs/icons/lib/css/blueprint-icons.css"
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css"
import './styles.css'

// Preload Berkeley Mono TX font for better performance
const fontLink = document.createElement('link')
fontLink.rel = 'preload'
fontLink.href = '/fonts/TX-03-Regular.woff2'
fontLink.as = 'font'
fontLink.type = 'font/woff2'
fontLink.crossOrigin = 'anonymous'
document.head.appendChild(fontLink)

const base = (import.meta as any).env?.VITE_PUBLIC_BASE || '/'
const container = document.getElementById('app')!
const root = createRoot(container)

root.render(
  <BrowserRouter basename={base}>
    <App />
  </BrowserRouter>
)
