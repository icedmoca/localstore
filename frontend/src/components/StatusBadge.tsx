export default function StatusBadge({ status }: { status?: 'running'|'stopped'|undefined }) {
  if (status === 'running') return <span className="badge running">● Running</span>
  if (status === 'stopped') return <span className="badge installed">● Installed</span>
  return <span className="badge available">● Available</span>
}
