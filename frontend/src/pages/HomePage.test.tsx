import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomePage from './HomePage'

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('健康检查成功时显示 API 正常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok' }),
      }),
    )

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('后端状态：检测中...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('后端状态：API 正常')).toBeInTheDocument()
    })
  })
})
