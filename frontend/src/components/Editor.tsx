import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'

export default function Editor({ value, language, onChange }: { value: string; language?: string; onChange?: (v:string)=>void }) {
  const el = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()

  useEffect(() => {
    if (!el.current) return
    
    // Determine theme based on Blueprint dark mode class
    const isDarkMode = document.body.classList.contains('bp5-dark')
    
    const ed = monaco.editor.create(el.current, {
      value: value || '',
      language: language || 'python',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      theme: isDarkMode ? 'vs-dark' : 'vs',
    })
    editorRef.current = ed
    const sub = ed.onDidChangeModelContent(() => onChange?.(ed.getValue()))
    return () => { sub.dispose(); ed.dispose() }
  }, [])

  useEffect(() => {
    const ed = editorRef.current
    if (ed && value !== ed.getValue()) ed.setValue(value)
  }, [value])

  // Update theme when dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDarkMode = document.body.classList.contains('bp5-dark')
      if (editorRef.current) {
        monaco.editor.setTheme(isDarkMode ? 'vs-dark' : 'vs')
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return <div style={{height:'60vh', border:'1px solid var(--bp5-divider-black)', borderRadius:8}} ref={el} />
}
