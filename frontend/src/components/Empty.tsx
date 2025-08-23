export default function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div class="card" style={{textAlign:'center', padding:'32px'}}>
      <div style={{fontSize:28}}>✨</div>
      <div style={{fontWeight:700, marginTop:8}}>{title}</div>
      {subtitle ? <div class="kv" style={{marginTop:6}}>{subtitle}</div> : null}
    </div>
  )
}
