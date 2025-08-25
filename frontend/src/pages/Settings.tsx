// Blueprint components work natively with React
import { useState } from 'react'
import { Card, Switch, FormGroup, InputGroup, Tab, Tabs, Button, Menu, MenuItem, Popover } from '@blueprintjs/core'

interface SettingsProps {
  darkTheme: boolean
  setDarkTheme: (value: boolean) => void
}

interface ThemeColor {
  name: string
  colors: string[]
  primary: string
}

const themeColors: ThemeColor[] = [
  { name: 'Default Blue', primary: '#2563eb', colors: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93bbfc'] },
  { name: 'Vermilion', primary: '#EB6847', colors: ['#96290D', '#B83211', '#D33D17', '#EB6847', '#FF9980'] },
  { name: 'Rose', primary: '#F5498B', colors: ['#A82255', '#C22762', '#DB2C6F', '#F5498B', '#FF66A1'] },
  { name: 'Violet', primary: '#BD6BBD', colors: ['#5C255C', '#7C327C', '#9D3F9D', '#BD6BBD', '#D69FD6'] },
  { name: 'Indigo', primary: '#9881F3', colors: ['#5642A6', '#634DBF', '#7961DB', '#9881F3', '#BDADFF'] },
  { name: 'Cerulean', primary: '#3FA6DA', colors: ['#0C5174', '#0F6894', '#147EB3', '#3FA6DA', '#68C1EE'] },
  { name: 'Turquoise', primary: '#13C9BA', colors: ['#004D46', '#007067', '#00A396', '#13C9BA', '#7AE1D8'] },
  { name: 'Forest', primary: '#43BF4D', colors: ['#1D7324', '#238C2C', '#29A634', '#43BF4D', '#62D96B'] },
  { name: 'Lime', primary: '#B6D94C', colors: ['#43501B', '#5A701A', '#8EB125', '#B6D94C', '#D4F17E'] },
  { name: 'Gold', primary: '#F0B726', colors: ['#5C4405', '#866103', '#D1980B', '#F0B726', '#FBD065'] },
  { name: 'Sepia', primary: '#AF855A', colors: ['#5E4123', '#7A542E', '#946638', '#AF855A', '#D0B090'] }
]

export default function Settings({ darkTheme, setDarkTheme }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general')
  const [selectedTheme, setSelectedTheme] = useState(localStorage.getItem('themeColor') || 'Default Blue')

  const handleThemeChange = (checked: boolean) => {
    setDarkTheme(checked)
    // Reapply current theme with dark mode adjustments
    const currentTheme = themeColors.find(t => t.name === selectedTheme)
    if (currentTheme) {
      setTimeout(() => applyThemeColor(currentTheme), 50)
    }
  }

  const applyThemeColor = (theme: ThemeColor) => {
    // Apply theme colors to CSS variables
    const root = document.documentElement
    root.style.setProperty('--primary-color', theme.primary)
    root.style.setProperty('--primary-color-dark', theme.colors[0])
    root.style.setProperty('--primary-color-light', theme.colors[4])
    
    // Always set dark-mode variants as well so toggling is instant
    root.style.setProperty('--primary-color-darkmode', theme.colors[3])
    root.style.setProperty('--primary-color-darkmode-light', theme.colors[4])
    
    // Save theme preference
    localStorage.setItem('themeColor', theme.name)
    setSelectedTheme(theme.name)
    window.__toast?.(`Applied ${theme.name} theme`)
  }

  // Apply saved theme on load
  useState(() => {
    const savedTheme = localStorage.getItem('themeColor') || 'Default Blue'
    const theme = themeColors.find(t => t.name === savedTheme)
    if (theme) {
      applyThemeColor(theme)
    }
  })

  const themeMenu = (
    <Menu>
      {themeColors.map(theme => (
        <MenuItem
          key={theme.name}
          text={theme.name}
          active={selectedTheme === theme.name}
          onClick={() => applyThemeColor(theme)}
          labelElement={
            <div style={{ display: 'flex', gap: 2 }}>
              {theme.colors.slice(0, 3).map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: color,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}
                />
              ))}
            </div>
          }
        />
      ))}
    </Menu>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
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

            <FormGroup label="Color Theme" helperText="Choose a color scheme for the interface">
              <Popover content={themeMenu} placement="bottom-start">
                <Button 
                  rightIcon="caret-down"
                  text={selectedTheme}
                  style={{ marginTop: 10 }}
                />
              </Popover>
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
