import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import NotFound from '../components/NotFound'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ toolId: 'test-tool' }),
    useLocation: () => ({ pathname: '/some/invalid/path' })
  }
})

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('NotFound', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders not found message', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
    expect(screen.getByText(/The page.*could not be found/)).toBeInTheDocument()
  })

  it('shows navigation buttons', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('Go Back')).toBeInTheDocument()
    expect(screen.getByText('Go to Tool Editor')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
  })

  it('navigates back when Go Back is clicked', () => {
    renderWithRouter(<NotFound />)
    fireEvent.click(screen.getByText('Go Back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('navigates to tool editor when tool ID is available', () => {
    renderWithRouter(<NotFound />)
    fireEvent.click(screen.getByText('Go to Tool Editor'))
    expect(mockNavigate).toHaveBeenCalledWith('/tools/test-tool/edit')
  })

  it('navigates to dashboard', () => {
    renderWithRouter(<NotFound />)
    fireEvent.click(screen.getByText('Go to Dashboard'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
