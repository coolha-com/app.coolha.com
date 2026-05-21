import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwapCard } from '../SwapCard'

describe('SwapCard', () => {
  it('renders connect state and amount input', () => {
    render(
      <SwapCard
        amount="0"
        isConnected={false}
        onAmountChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        primaryLabel="Connect Wallet"
      />,
    )

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sell amount')).toHaveValue('0')
  })

  it('forwards amount changes', () => {
    const onAmountChange = vi.fn()

    render(
      <SwapCard
        amount="1"
        isConnected
        onAmountChange={onAmountChange}
        onPrimaryAction={vi.fn()}
        primaryLabel="Get Quote"
      />,
    )

    fireEvent.change(screen.getByLabelText('Sell amount'), { target: { value: '2.5' } })

    expect(onAmountChange).toHaveBeenCalledWith('2.5')
  })
})
