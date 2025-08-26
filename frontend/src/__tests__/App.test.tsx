import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'

// Mock the API
vi.mock('../api', () => ({
  default: {
    health: vi.fn().mockResolvedValue({ ok: true }),
    tools: vi.fn().mockResolvedValue([])
  }
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('App', () => {
  it('renders without crashing', () => {
    renderWithRouter(<App />)
    expect(screen.getByText('LocalStore')).toBeInTheDocument()
  })

  it('shows navigation buttons', () => {
    renderWithRouter(<App />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Runtimes')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows add tool and refresh buttons', () => {
    renderWithRouter(<App />)
    expect(screen.getByText('Add Tool')).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })
})
