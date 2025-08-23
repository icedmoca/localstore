import { useEffect, useRef } from 'preact/hooks'
import * as monaco from 'monaco-editor'

export default function Editor({ value, language, onChange }: { value: string; language?: string; onChange?: (v:string)=>void }) {
  const el = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()

  useEffect(() => {
    if (!el.current) return
    const ed = monaco.editor.create(el.current, {
      value: value || '',
      language: language || 'python',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs',
    })
    editorRef.current = ed
    const sub = ed.onDidChangeModelContent(() => onChange?.(ed.getValue()))
    return () => { sub.dispose(); ed.dispose() }
  }, [])

  useEffect(() => {
    const ed = editorRef.current
    if (ed && value !== ed.getValue()) ed.setValue(value)
  }, [value])

  return <div style={{height:'60vh', border:'1px solid var(--border)', borderRadius:12}} ref={el} />
}
