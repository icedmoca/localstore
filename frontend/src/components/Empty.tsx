export default function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
      <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
      {subtitle && (
        <p style={{ color: 'var(--muted)', margin: 0 }}>{subtitle}</p>
      )}
    </div>
  )
}
