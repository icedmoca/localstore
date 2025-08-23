export default function StatusBadge({ status }: { status?: 'running'|'stopped'|undefined }) {
  if (status === 'running') return <span class="badge running">● Running</span>
  if (status === 'stopped') return <span class="badge installed">● Installed</span>
  return <span class="badge available">● Available</span>
}
