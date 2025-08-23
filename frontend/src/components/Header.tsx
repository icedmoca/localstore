import { Link, useRoute } from 'wouter-preact'
import { useEffect, useState } from 'preact/hooks'

export default function Header() {
  const [matchMarketplace] = useRoute('/')
  const [matchInstalled] = useRoute('/installed')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <header class="header">
      <div class="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,padding:'12px 16px'}}>
        <div class="brand">
          <span style={{fontSize:18}}>🗂️</span>
          <span>LocalStore</span>
        </div>
        <div class="controls" style={{justifyContent:'flex-end',flex:1}}>
          <nav class="nav" style={{marginRight:'auto', marginLeft:16}}>
            <Link href="/" className={matchMarketplace ? 'active' : ''}>Marketplace</Link>
            <Link href="/installed" className={matchInstalled ? 'active' : ''}>Installed</Link>
          </nav>
          <button class="btn ghost" onClick={()=>setDark(v=>!v)}>{dark ? 'Light' : 'Dark'}</button>
        </div>
      </div>
    </header>
  )
}
