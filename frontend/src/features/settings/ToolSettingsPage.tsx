import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Button,
  Breadcrumbs,
  NonIdealState,
  Spinner,
  Navbar,
  NavbarGroup,
  NavbarHeading,
  NavbarDivider,
  Alignment
} from '@blueprintjs/core'
import ToolSettingsDialog from './ToolSettingsDialog'
import api from '../../api'
import type { Tool } from '../../types'

export default function ToolSettingsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const toolId = params.toolId || ''
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!toolId) return
    loadTool()
  }, [toolId])

  async function loadTool() {
    try {
      setLoading(true)
      const tools = await api.tools()
      const found = tools.find(t => t.id === toolId)
      if (found) {
        setTool(found)
      } else {
        setError('Tool not found')
      }
    } catch (err: any) {
      setError(`Failed to load tool: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = (updatedTool: Tool) => {
    setTool(updatedTool)
  }

  const handleClose = () => {
    navigate(`/tools/${toolId}/edit`)
  }

  if (!toolId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: 20 
      }}>
        <NonIdealState
          icon="error"
          title="No Tool Selected"
          description="Please select a tool to view settings"
          action={<Link to="/dashboard"><Button intent="primary">Back to Dashboard</Button></Link>}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <Spinner size={50} />
      </div>
    )
  }

  if (error || !tool) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: 20 
      }}>
        <NonIdealState
          icon="error"
          title="Tool Not Found"
          description={error || `Tool with ID "${toolId}" was not found`}
          action={
            <div>
              <Button 
                onClick={() => navigate(-1)} 
                style={{ marginRight: 8 }}
              >
                Go Back
              </Button>
              <Link to="/dashboard">
                <Button intent="primary">Back to Dashboard</Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar>
        <NavbarGroup align={Alignment.LEFT}>
          <NavbarHeading>Tool Settings</NavbarHeading>
          <NavbarDivider />
          <Breadcrumbs
            items={[
              { 
                text: 'Dashboard', 
                onClick: () => navigate('/dashboard')
              },
              { 
                text: tool.name, 
                onClick: () => navigate(`/tools/${toolId}/edit`)
              },
              { 
                text: 'Settings', 
                current: true 
              }
            ]}
          />
        </NavbarGroup>
        <NavbarGroup align={Alignment.RIGHT}>
          <Button
            icon="code"
            text="Back to Editor"
            onClick={() => navigate(`/tools/${toolId}/edit`)}
          />
        </NavbarGroup>
      </Navbar>

      <div style={{ flex: 1, position: 'relative' }}>
        <ToolSettingsDialog
          isOpen={true}
          onClose={handleClose}
          tool={tool}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
