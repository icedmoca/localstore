import { useState } from 'react'
import {
  Dialog,
  Button,
  FormGroup,
  InputGroup,
  TextArea,
  RadioGroup,
  Radio,
  Tabs,
  Tab,
  Card,
  HTMLSelect,
  Checkbox,
  Intent,
  Tag,
  ProgressBar,
  NonIdealState,
  Icon
} from '@blueprintjs/core'
import { toast } from './ToastManager'
import api from '../api'

interface ToolWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface WizardFormData {
  // Basic Info
  id: string
  name: string
  description: string
  
  // Tool Type
  type: 'web' | 'cli' | 'api' | 'notebook'
  framework: string
  
  // Features
  features: {
    database: boolean
    authentication: boolean
    fileUpload: boolean
    realtime: boolean
    ai: boolean
  }
  
  // Configuration
  port: number
  envVars: Array<{ key: string; value: string }>
  dependencies: string[]
}

const FRAMEWORKS = {
  web: ['Flask', 'FastAPI', 'Django', 'Express', 'React', 'Vue', 'Svelte'],
  cli: ['Click', 'Argparse', 'Fire', 'Typer'],
  api: ['FastAPI', 'Flask-RESTful', 'Django REST', 'Express'],
  notebook: ['Jupyter', 'Streamlit', 'Gradio', 'Panel']
}

const TEMPLATES = {
  'Flask': `from flask import Flask, render_template, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)`,
  
  'FastAPI': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)`,

  'Streamlit': `import streamlit as st
import pandas as pd
import numpy as np

st.set_page_config(
    page_title="My Tool",
    page_icon="🚀",
    layout="wide"
)

st.title("Welcome to My Tool!")
st.write("This is a Streamlit application.")

# Add your components here
if st.button("Click me!"):
    st.success("Button clicked!")

# Example data visualization
data = pd.DataFrame(
    np.random.randn(20, 3),
    columns=['A', 'B', 'C']
)
st.line_chart(data)`,

  'Click': `import click

@click.command()
@click.option('--name', prompt='Your name', help='The person to greet.')
@click.option('--count', default=1, help='Number of greetings.')
def hello(name, count):
    """Simple CLI tool example."""
    for _ in range(count):
        click.echo(f'Hello, {name}!')

if __name__ == '__main__':
    hello()`
}

export default function ToolWizard({ isOpen, onClose, onSuccess }: ToolWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<WizardFormData>({
    id: '',
    name: '',
    description: '',
    type: 'web',
    framework: 'Flask',
    features: {
      database: false,
      authentication: false,
      fileUpload: false,
      realtime: false,
      ai: false
    },
    port: 5000,
    envVars: [],
    dependencies: []
  })

  const steps = [
    { title: 'Basic Information', icon: 'info-sign' as any },
    { title: 'Tool Type', icon: 'application' as any },
    { title: 'Features', icon: 'properties' as any },
    { title: 'Configuration', icon: 'cog' as any },
    { title: 'Review & Create', icon: 'tick-circle' as any }
  ]

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!formData.id || !formData.name) {
          toast.error('Please fill in all required fields')
          return false
        }
        if (!/^[a-z0-9-]+$/.test(formData.id)) {
          toast.error('Tool ID must contain only lowercase letters, numbers, and hyphens')
          return false
        }
        return true
      case 1:
        return true
      case 2:
        return true
      case 3:
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const generateRequirements = (): string => {
    const deps = [...formData.dependencies]
    
    // Add framework dependencies
    if (formData.framework === 'Flask') {
      deps.push('flask>=3.0.0', 'flask-cors>=4.0.0')
    } else if (formData.framework === 'FastAPI') {
      deps.push('fastapi>=0.104.0', 'uvicorn[standard]>=0.24.0')
    } else if (formData.framework === 'Streamlit') {
      deps.push('streamlit>=1.29.0')
    } else if (formData.framework === 'Click') {
      deps.push('click>=8.1.0')
    }

    // Add feature dependencies
    if (formData.features.database) {
      deps.push('sqlalchemy>=2.0.0', 'alembic>=1.13.0')
    }
    if (formData.features.authentication) {
      deps.push('python-jose[cryptography]>=3.3.0', 'passlib[bcrypt]>=1.7.4')
    }
    if (formData.features.fileUpload) {
      deps.push('python-multipart>=0.0.6')
    }
    if (formData.features.realtime) {
      deps.push('websockets>=12.0', 'python-socketio>=5.10.0')
    }
    if (formData.features.ai) {
      deps.push('openai>=1.3.0', 'langchain>=0.0.340')
    }

    return deps.join('\n')
  }

  const createTool = async () => {
    setIsCreating(true)
    const loadingToast = toast.loading('Creating your tool...')

    try {
      // Create the tool directory structure
      const toolData = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        entry: 'app.py',
        template: {
          type: formData.type,
          framework: formData.framework,
          code: TEMPLATES[formData.framework] || TEMPLATES['Flask'],
          requirements: generateRequirements(),
          port: formData.port,
          envVars: formData.envVars
        }
      }

      await api.createFromTemplate(toolData)
      
      toast.dismiss(loadingToast)
      toast.success(`Tool "${formData.name}" created successfully!`)
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error(error.message || 'Failed to create tool')
    } finally {
      setIsCreating(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="wizard-step">
            <FormGroup label="Tool ID" labelInfo="(required)" helperText="Unique identifier (lowercase, no spaces)">
              <InputGroup
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="my-awesome-tool"
              />
            </FormGroup>
            
            <FormGroup label="Tool Name" labelInfo="(required)" helperText="Display name for your tool">
              <InputGroup
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Tool"
              />
            </FormGroup>
            
            <FormGroup label="Description" helperText="Brief description of what your tool does">
              <TextArea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A powerful tool that helps users..."
                fill
                rows={3}
              />
            </FormGroup>
          </div>
        )

      case 1:
        return (
          <div className="wizard-step">
            <FormGroup label="Tool Type">
              <RadioGroup
                onChange={(e) => setFormData({ 
                  ...formData, 
                  type: e.currentTarget.value as any,
                  framework: FRAMEWORKS[e.currentTarget.value as keyof typeof FRAMEWORKS][0]
                })}
                selectedValue={formData.type}
              >
                <Radio label="Web Application" value="web" />
                <Radio label="Command Line Tool" value="cli" />
                <Radio label="REST API" value="api" />
                <Radio label="Data Science Notebook" value="notebook" />
              </RadioGroup>
            </FormGroup>

            <FormGroup label="Framework">
              <HTMLSelect
                value={formData.framework}
                onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                fill
              >
                {FRAMEWORKS[formData.type].map(fw => (
                  <option key={fw} value={fw}>{fw}</option>
                ))}
              </HTMLSelect>
            </FormGroup>
          </div>
        )

      case 2:
        return (
          <div className="wizard-step">
            <h3>Select Features</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Checkbox
                checked={formData.features.database}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, database: e.currentTarget.checked }
                })}
              >
                Database Integration (SQLAlchemy + Alembic)
              </Checkbox>
              
              <Checkbox
                checked={formData.features.authentication}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, authentication: e.currentTarget.checked }
                })}
              >
                User Authentication (JWT + bcrypt)
              </Checkbox>
              
              <Checkbox
                checked={formData.features.fileUpload}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, fileUpload: e.currentTarget.checked }
                })}
              >
                File Upload Support
              </Checkbox>
              
              <Checkbox
                checked={formData.features.realtime}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, realtime: e.currentTarget.checked }
                })}
              >
                Real-time Communication (WebSockets)
              </Checkbox>
              
              <Checkbox
                checked={formData.features.ai}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, ai: e.currentTarget.checked }
                })}
              >
                AI Integration (OpenAI + LangChain)
              </Checkbox>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="wizard-step">
            <FormGroup label="Port Number">
              <InputGroup
                type="number"
                value={formData.port.toString()}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 5000 })}
              />
            </FormGroup>

            <FormGroup label="Environment Variables">
              <Button
                icon="add"
                text="Add Variable"
                onClick={() => setFormData({
                  ...formData,
                  envVars: [...formData.envVars, { key: '', value: '' }]
                })}
              />
              {formData.envVars.map((env, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <InputGroup
                    placeholder="KEY"
                    value={env.key}
                    onChange={(e) => {
                      const newEnvVars = [...formData.envVars]
                      newEnvVars[idx].key = e.target.value
                      setFormData({ ...formData, envVars: newEnvVars })
                    }}
                  />
                  <InputGroup
                    placeholder="VALUE"
                    value={env.value}
                    onChange={(e) => {
                      const newEnvVars = [...formData.envVars]
                      newEnvVars[idx].value = e.target.value
                      setFormData({ ...formData, envVars: newEnvVars })
                    }}
                  />
                  <Button
                    icon="trash"
                    variant="minimal"
                    intent={Intent.DANGER}
                    onClick={() => {
                      const newEnvVars = formData.envVars.filter((_, i) => i !== idx)
                      setFormData({ ...formData, envVars: newEnvVars })
                    }}
                  />
                </div>
              ))}
            </FormGroup>

            <FormGroup label="Additional Dependencies">
              <TextArea
                value={formData.dependencies.join('\n')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  dependencies: e.target.value.split('\n').filter(d => d.trim())
                })}
                placeholder="package-name>=1.0.0"
                rows={3}
              />
            </FormGroup>
          </div>
        )

      case 4:
        return (
          <div className="wizard-step">
            <h3>Review Your Tool</h3>
            <Card style={{ marginBottom: 16 }}>
              <h4>{formData.name}</h4>
              <p>{formData.description || 'No description provided'}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Tag>ID: {formData.id}</Tag>
                <Tag intent={Intent.PRIMARY}>{formData.type}</Tag>
                <Tag intent={Intent.SUCCESS}>{formData.framework}</Tag>
                <Tag>Port: {formData.port}</Tag>
              </div>
            </Card>

            {Object.entries(formData.features).some(([_, enabled]) => enabled) && (
              <Card style={{ marginBottom: 16 }}>
                <h4>Features</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(formData.features)
                    .filter(([_, enabled]) => enabled)
                    .map(([feature]) => (
                      <Tag key={feature} icon="tick" intent={Intent.SUCCESS}>
                        {feature.charAt(0).toUpperCase() + feature.slice(1)}
                      </Tag>
                    ))}
                </div>
              </Card>
            )}

            <Card>
              <h4>Generated Files</h4>
              <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                <div>📁 {formData.id}/</div>
                <div>&nbsp;&nbsp;📄 app.py</div>
                <div>&nbsp;&nbsp;📄 requirements.txt</div>
                {formData.type === 'web' && <div>&nbsp;&nbsp;📁 templates/</div>}
                {formData.type === 'web' && <div>&nbsp;&nbsp;📁 static/</div>}
                <div>&nbsp;&nbsp;📄 README.md</div>
                {formData.envVars.length > 0 && <div>&nbsp;&nbsp;📄 .env.example</div>}
              </div>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Tool"
      style={{ width: 700, paddingBottom: 0 }}
    >
      <div className="bp5-dialog-body" style={{ position: 'relative' }}>
        {/* Progress Bar */}
        <ProgressBar
          value={(currentStep + 1) / steps.length}
          intent={Intent.PRIMARY}
          stripes={false}
          style={{ marginBottom: 20 }}
        />

        {/* Step Indicators */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: idx <= currentStep ? 1 : 0.5,
                cursor: idx < currentStep ? 'pointer' : 'default'
              }}
              onClick={() => idx < currentStep && setCurrentStep(idx)}
            >
              <Icon
                icon={step.icon as any}
                size={24}
                intent={idx <= currentStep ? Intent.PRIMARY : Intent.NONE}
              />
              <span style={{ fontSize: 12, marginTop: 4 }}>{step.title}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ minHeight: 300 }}>
          {renderStepContent()}
        </div>
      </div>

      <div className="bp5-dialog-footer">
        <div className="bp5-dialog-footer-actions">
          <Button
            text="Cancel"
            onClick={onClose}
            disabled={isCreating}
          />
          <Button
            text="Previous"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isCreating}
          />
          {currentStep < steps.length - 1 ? (
            <Button
              text="Next"
              intent={Intent.PRIMARY}
              onClick={handleNext}
              disabled={isCreating}
            />
          ) : (
            <Button
              text="Create Tool"
              intent={Intent.SUCCESS}
              onClick={createTool}
              loading={isCreating}
              disabled={isCreating}
            />
          )}
        </div>
      </div>

      <style>{`
        .wizard-step {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Dialog>
  )
}
