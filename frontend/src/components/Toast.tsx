import { useEffect } from 'preact/hooks'

export type ToastItem = { id: number; text: string }
export default function Toast({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id:number)=>void }) {
  useEffect(() => {
    const timers = items.map(i => setTimeout(() => onDismiss(i.id), 2400))
    return () => { timers.forEach(clearTimeout) }
  }, [items])
  return (
    <div class="toast">
      {items.map(i => <div key={i.id} class="toast-item">{i.text}</div>)}
    </div>
  )
}
