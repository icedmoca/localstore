import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import ToolCard from './ToolCard'

test('renders ToolCard', () => {
  const { getByText } = render(<ToolCard t={{id: 'test', name: 'Test'}} onChange={() => {}} />)
  expect(getByText('Test')).toBeDefined()
})
