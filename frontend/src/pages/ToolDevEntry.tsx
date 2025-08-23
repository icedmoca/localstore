import DevMode from './DevMode'
import { useRoute } from 'wouter-preact'

export default function ToolDevEntry() {
  const [match, params] = useRoute('/dev/:id')
  if (!match) return null
  
  return <DevMode params={params} />
}
