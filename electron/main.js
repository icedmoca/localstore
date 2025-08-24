const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')


let backend


function createWindow() {
const win = new BrowserWindow({ width: 1200, height: 800 })
win.loadURL('http://127.0.0.1:8000')
}


app.whenReady().then(() => {
  const python = process.platform === 'win32' ? 'python' : 'python3'
  const backendPath = path.join(__dirname, '..', 'backend', 'app.py')
  backend = spawn(python, [backendPath], { stdio: 'inherit' })

  // Poll health
  const checkHealth = setInterval(() => {
    fetch('http://127.0.0.1:8000/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          clearInterval(checkHealth)
          createWindow()
        }
      })
      .catch(() => {})
  }, 1000)
})


app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit()
if (backend) backend.kill()
})
