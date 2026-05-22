// @vitest-environment jsdom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ClonePhaseLoader,
  CloneSearchModeToggle,
  CloneShellHeader
} from '../view/shell/CloneShell'

describe('bom/CloneShell', () => {
  it('renders the shell header and fires expand toggle', () => {
    const onToggleExpanded = vi.fn()

    render(<CloneShellHeader title="Advanced BOM Clone" isExpanded={false} onToggleExpanded={onToggleExpanded} />)

    expect(screen.getByText('Advanced BOM Clone')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand view' }))
    expect(onToggleExpanded).toHaveBeenCalledTimes(1)
  })

  it('renders search mode toggle and switches modes', () => {
    const onToggleAdvancedMode = vi.fn()

    render(<CloneSearchModeToggle advancedMode={false} onToggleAdvancedMode={onToggleAdvancedMode} />)

    fireEvent.click(screen.getByRole('button', { name: 'Basic Mode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Mode' }))

    expect(onToggleAdvancedMode).toHaveBeenNthCalledWith(1, false)
    expect(onToggleAdvancedMode).toHaveBeenNthCalledWith(2, true)
  })

  it('renders the phase loader label', () => {
    render(<ClonePhaseLoader label="Validating selection..." />)
    expect(screen.getByText('Validating selection...')).toBeInTheDocument()
  })
})
