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
        primaryLabel="连接钱包"
      />,
    )

    expect(screen.getByRole('button', { name: '连接钱包' })).toBeInTheDocument()
    expect(screen.getByLabelText('卖出数量')).toHaveValue('0')
  })

  it('forwards amount changes', () => {
    const onAmountChange = vi.fn()

    render(
      <SwapCard
        amount="1"
        isConnected
        onAmountChange={onAmountChange}
        onPrimaryAction={vi.fn()}
        primaryLabel="获取报价"
      />,
    )

    fireEvent.change(screen.getByLabelText('卖出数量'), { target: { value: '2.5' } })

    expect(onAmountChange).toHaveBeenCalledWith('2.5')
  })
})
