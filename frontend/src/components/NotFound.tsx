import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { 
  NonIdealState, 
  Button, 
  ButtonGroup, 
  Intent 
} from '@blueprintjs/core'

export default function NotFound() {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  
  const toolId = params.toolId || params.id
  
  const handleGoBack = () => {
    navigate(-1)
  }
  
  const handleGoToTool = () => {
    if (toolId) {
      navigate(`/tools/${toolId}/edit`)
    } else {
      navigate('/dashboard')
    }
  }
  
  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }
  
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
        title="Page Not Found"
        description={`The page "${location.pathname}" could not be found.`}
        action={
          <ButtonGroup>
            <Button 
              icon="arrow-left" 
              text="Go Back"
              onClick={handleGoBack}
            />
            {toolId && (
              <Button 
                icon="code"
                text="Go to Tool Editor"
                intent={Intent.PRIMARY}
                onClick={handleGoToTool}
              />
            )}
            <Button 
              icon="dashboard"
              text="Go to Dashboard"
              intent={Intent.SUCCESS}
              onClick={handleGoToDashboard}
            />
          </ButtonGroup>
        }
      />
    </div>
  )
}
