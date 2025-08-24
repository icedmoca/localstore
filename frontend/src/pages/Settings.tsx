// Blueprint components work natively with React
import { useState } from 'react'
import { Card, Switch, FormGroup, InputGroup, Tab, Tabs } from '@blueprintjs/core'

interface SettingsProps {
  darkTheme: boolean
  setDarkTheme: (value: boolean) => void
}

export default function Settings({ darkTheme, setDarkTheme }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general')

  const handleThemeChange = (checked: boolean) => {
    setDarkTheme(checked)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2>Settings</h2>
      
      <Tabs
        id="settings-tabs"
        selectedTabId={activeTab}
        onChange={(newTabId) => setActiveTab(newTabId as string)}
      >
        <Tab id="general" title="General" panel={
          <Card style={{ marginTop: 20 }}>
            <FormGroup label="Theme">
              <Switch
                checked={darkTheme}
                label="Dark Mode"
                onChange={(e) => handleThemeChange(e.currentTarget.checked)}
              />
            </FormGroup>
            
            <FormGroup label="Autostart">
              <Switch
                defaultChecked
                label="Start tools automatically on backend boot"
              />
            </FormGroup>
          </Card>
        } />
        
        <Tab id="network" title="Network" panel={
          <Card style={{ marginTop: 20 }}>
            <FormGroup label="Backend Host" labelFor="backend-host">
              <InputGroup 
                id="backend-host"
                placeholder="127.0.0.1" 
                disabled
              />
            </FormGroup>
            
            <FormGroup label="Backend Port" labelFor="backend-port">
              <InputGroup 
                id="backend-port"
                placeholder="8000" 
                disabled
              />
            </FormGroup>
          </Card>
        } />
        
        <Tab id="security" title="Security" panel={
          <Card style={{ marginTop: 20 }}>
            <FormGroup 
              label="API Key" 
              labelFor="api-key"
              helperText="Optional authentication for API access"
            >
              <InputGroup 
                id="api-key"
                type="password" 
                placeholder="Enter API key"
              />
            </FormGroup>
          </Card>
        } />
      </Tabs>
    </div>
  )
}
